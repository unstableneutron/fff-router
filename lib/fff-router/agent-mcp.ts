import path from "node:path";
import { stdin as processStdin } from "node:process";
import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ensureDaemonRunning as defaultEnsureDaemonRunning } from "./daemon-autostart";
import { callPublicToolOverHttp as defaultCallPublicToolOverHttp } from "./http-client";
import { expandHomePath } from "./home-path";
import { normalizePublicToolInput } from "./public-api";
import type {
  PublicCompactFindFilesResult,
  PublicCompactGrepResult,
  PublicCompactRenderedTextResult,
  PublicCompactSearchTermsResult,
  PublicToolRequest,
  PublicToolResult,
  SearchCoordinatorResult,
} from "./types";

export type AgentMcpToolName = "find_files" | "grep" | "multi_grep";

type AgentMcpResponse = {
  isError: boolean;
  content: Array<{ type: "text"; text: string }>;
};

type AgentMcpToolDefinition = {
  name: AgentMcpToolName;
  description: string;
  inputSchema: unknown;
  zodInputShape: z.ZodRawShape;
};

type ConstraintParts = {
  glob?: string;
  excludePaths: string[];
};

const agentMcpInputShapes = {
  find_files: {
    query: z
      .string()
      .min(1)
      .describe("Fuzzy search query. Keep it short; glob/exclude tokens are allowed."),
    within: z
      .string()
      .min(1)
      .optional()
      .describe("Optional path to search within. Defaults to the MCP process cwd."),
    glob: z.string().min(1).optional().describe("Optional include glob relative to within."),
    exclude_paths: z
      .array(z.string().min(1))
      .optional()
      .describe("Optional relative paths/globs to exclude."),
    extensions: z
      .array(z.string().min(1))
      .optional()
      .describe("Optional file extensions without leading dots."),
    maxResults: z.number().int().min(0).optional().describe("Max results (default 20)."),
    cursor: z
      .union([z.string(), z.null()])
      .optional()
      .describe("Opaque pagination cursor returned by a previous result; omit for first page."),
  },
  grep: {
    query: z
      .string()
      .min(1)
      .describe(
        "Regex search query with optional constraint prefixes, e.g. '*.ts createMcpServer'.",
      ),
    within: z
      .string()
      .min(1)
      .optional()
      .describe("Optional path to search within. Defaults to the MCP process cwd."),
    glob: z.string().min(1).optional().describe("Optional include glob relative to within."),
    exclude_paths: z
      .array(z.string().min(1))
      .optional()
      .describe("Optional relative paths/globs to exclude."),
    extensions: z
      .array(z.string().min(1))
      .optional()
      .describe("Optional file extensions without leading dots."),
    maxResults: z.number().int().min(0).optional().describe("Max matching lines (default 20)."),
    cursor: z
      .union([z.string(), z.null()])
      .optional()
      .describe("Opaque pagination cursor returned by a previous result; omit for first page."),
  },
  multi_grep: {
    patterns: z
      .array(z.string().min(1))
      .min(1)
      .describe("Literal patterns to match with OR semantics."),
    constraints: z
      .string()
      .min(1)
      .optional()
      .describe("Optional file constraints, e.g. '*.{ts,tsx} !test/'."),
    within: z
      .string()
      .min(1)
      .optional()
      .describe("Optional path to search within. Defaults to the MCP process cwd."),
    glob: z.string().min(1).optional().describe("Optional include glob relative to within."),
    exclude_paths: z
      .array(z.string().min(1))
      .optional()
      .describe("Optional relative paths/globs to exclude."),
    extensions: z
      .array(z.string().min(1))
      .optional()
      .describe("Optional file extensions without leading dots."),
    context: z.number().int().min(0).optional().describe("Context lines before/after each match."),
    maxResults: z.number().int().min(0).optional().describe("Max matching lines (default 20)."),
    cursor: z
      .union([z.string(), z.null()])
      .optional()
      .describe("Opaque pagination cursor returned by a previous result; omit for first page."),
  },
} as const satisfies Record<AgentMcpToolName, z.ZodRawShape>;

const AGENT_MCP_TOOLS: AgentMcpToolDefinition[] = [
  {
    name: "find_files",
    description:
      "Fuzzy file search by name. Searches file names, not file contents. Keep queries short; use glob, within, extensions, and exclude_paths to narrow results.",
    inputSchema: z.toJSONSchema(z.object(agentMcpInputShapes.find_files)),
    zodInputShape: agentMcpInputShapes.find_files,
  },
  {
    name: "grep",
    description:
      "Search file contents with a regex-style query. Put optional file constraints before the pattern, e.g. '*.ts createMcpServer'. Use multi_grep for literal OR searches.",
    inputSchema: z.toJSONSchema(z.object(agentMcpInputShapes.grep)),
    zodInputShape: agentMcpInputShapes.grep,
  },
  {
    name: "multi_grep",
    description:
      "Search file contents for lines matching ANY literal pattern. Patterns are literal text; use constraints, glob, extensions, and exclude_paths to prefilter files.",
    inputSchema: z.toJSONSchema(z.object(agentMcpInputShapes.multi_grep)),
    zodInputShape: agentMcpInputShapes.multi_grep,
  },
];

function errorResponse(message: string): AgentMcpResponse {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function textResponse(text: string): AgentMcpResponse {
  return { isError: false, content: [{ type: "text", text }] };
}

export function listAgentMcpTools() {
  return AGENT_MCP_TOOLS.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}

function normalizeOptionalNonNegativeInt(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

function normalizeStringArray(value: unknown, field: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string" || entry.trim() === "")
  ) {
    throw new Error(`${field} must be an array of non-empty strings`);
  }
  return value;
}

function normalizeCursor(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  throw new Error("cursor must be a non-empty string when provided");
}

function resolveAgentWithin(value: unknown, cwd: string, env: NodeJS.ProcessEnv): string {
  if (value === undefined || value === null) {
    return cwd;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("within must be a non-empty string when provided");
  }
  const expanded = expandHomePath(value, env);
  if (!expanded.ok) {
    throw new Error(expanded.error.message);
  }
  return path.isAbsolute(expanded.value) ? expanded.value : path.resolve(cwd, expanded.value);
}

const GLOB_META_PATTERN = /[*?[\]{}!]/;

function isConstraintToken(token: string): boolean {
  return (
    token.startsWith("!") ||
    token.endsWith("/") ||
    token.includes("/") ||
    GLOB_META_PATTERN.test(token)
  );
}

function normalizeExcludeToken(token: string): string {
  return token
    .replace(/^!/, "")
    .replace(/^\.\//, "")
    .replace(/\/\*\*$/, "")
    .replace(/\/+$/, "");
}

function normalizeIncludeToken(token: string): string {
  const normalized = token.replace(/^\.\//, "");
  if (normalized.endsWith("/")) {
    return `${normalized}**`;
  }
  return normalized;
}

function mergeGlobTokens(tokens: string[]): string | undefined {
  const unique = Array.from(new Set(tokens.filter(Boolean)));
  if (unique.length === 0) {
    return undefined;
  }
  if (unique.length === 1) {
    return unique[0];
  }
  return `{${unique.join(",")}}`;
}

function parseConstraints(text: string | undefined): ConstraintParts {
  const includeTokens: string[] = [];
  const excludePaths: string[] = [];
  for (const token of text?.trim().split(/\s+/).filter(Boolean) ?? []) {
    if (token.startsWith("!")) {
      excludePaths.push(normalizeExcludeToken(token));
      continue;
    }
    includeTokens.push(normalizeIncludeToken(token));
  }
  return { glob: mergeGlobTokens(includeTokens), excludePaths };
}

function combineGlobs(left: string | undefined, right: string | undefined): string | undefined {
  return mergeGlobTokens([left, right].filter((value): value is string => Boolean(value)));
}

function parseFindFilesQuery(query: string): { query: string; constraints: ConstraintParts } {
  const queryTokens: string[] = [];
  const constraintTokens: string[] = [];
  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    if (isConstraintToken(token)) {
      constraintTokens.push(token);
    } else {
      queryTokens.push(token);
    }
  }
  return {
    query: queryTokens.length > 0 ? queryTokens.join(" ") : query.trim(),
    constraints: parseConstraints(constraintTokens.join(" ")),
  };
}

function parseGrepQuery(query: string): { pattern: string; constraints: ConstraintParts } {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const pattern = tokens.pop();
  if (!pattern) {
    throw new Error("query must include a search pattern");
  }
  return { pattern, constraints: parseConstraints(tokens.join(" ")) };
}

function normalizePublicRequest(
  tool: "fff_find_files" | "fff_grep",
  input: Record<string, unknown>,
) {
  const normalized = normalizePublicToolInput(tool, input);
  if (!normalized.ok) {
    throw new Error(`${normalized.error.code}: ${normalized.error.message}`);
  }
  return normalized.value;
}

function buildFindFilesRequest(
  input: Record<string, unknown>,
  cwd: string,
  env: NodeJS.ProcessEnv,
): PublicToolRequest {
  if (typeof input.query !== "string" || input.query.trim() === "") {
    throw new Error("query must be a non-empty string");
  }
  const parsed = parseFindFilesQuery(input.query);
  const explicitGlob = typeof input.glob === "string" ? input.glob : undefined;
  return normalizePublicRequest("fff_find_files", {
    query: parsed.query,
    within: resolveAgentWithin(input.within, cwd, env),
    glob: combineGlobs(parsed.constraints.glob, explicitGlob),
    extensions: normalizeStringArray(input.extensions, "extensions"),
    exclude_paths: [
      ...parsed.constraints.excludePaths,
      ...normalizeStringArray(input.exclude_paths, "exclude_paths"),
    ],
    limit: normalizeOptionalNonNegativeInt(input.maxResults, "maxResults"),
    cursor: normalizeCursor(input.cursor),
    output_mode: "compact",
  });
}

function buildGrepRequest(
  input: Record<string, unknown>,
  cwd: string,
  env: NodeJS.ProcessEnv,
): PublicToolRequest {
  if (typeof input.query !== "string" || input.query.trim() === "") {
    throw new Error("query must be a non-empty string");
  }
  const parsed = parseGrepQuery(input.query);
  const explicitGlob = typeof input.glob === "string" ? input.glob : undefined;
  return normalizePublicRequest("fff_grep", {
    patterns: [parsed.pattern],
    literal: false,
    within: resolveAgentWithin(input.within, cwd, env),
    glob: combineGlobs(parsed.constraints.glob, explicitGlob),
    extensions: normalizeStringArray(input.extensions, "extensions"),
    exclude_paths: [
      ...parsed.constraints.excludePaths,
      ...normalizeStringArray(input.exclude_paths, "exclude_paths"),
    ],
    limit: normalizeOptionalNonNegativeInt(input.maxResults, "maxResults"),
    cursor: normalizeCursor(input.cursor),
    output_mode: "compact",
  });
}

function buildMultiGrepRequest(
  input: Record<string, unknown>,
  cwd: string,
  env: NodeJS.ProcessEnv,
): PublicToolRequest {
  const patterns = normalizeStringArray(input.patterns, "patterns");
  if (patterns.length === 0) {
    throw new Error("patterns must contain at least one entry");
  }
  const constraints = parseConstraints(
    typeof input.constraints === "string" ? input.constraints : undefined,
  );
  const explicitGlob = typeof input.glob === "string" ? input.glob : undefined;
  return normalizePublicRequest("fff_grep", {
    patterns,
    literal: true,
    within: resolveAgentWithin(input.within, cwd, env),
    glob: combineGlobs(constraints.glob, explicitGlob),
    extensions: normalizeStringArray(input.extensions, "extensions"),
    exclude_paths: [
      ...constraints.excludePaths,
      ...normalizeStringArray(input.exclude_paths, "exclude_paths"),
    ],
    context_lines: normalizeOptionalNonNegativeInt(input.context, "context"),
    limit: normalizeOptionalNonNegativeInt(input.maxResults, "maxResults"),
    cursor: normalizeCursor(input.cursor),
    output_mode: "compact",
  });
}

function formatFindFilesResult(result: PublicCompactFindFilesResult): string {
  const body =
    result.items.length > 0 ? result.items.map((item) => item.path).join("\n") : "(no files found)";
  return `base_path: ${result.base_path}\n\n${body}`;
}

function formatStructuredGrepResult(
  result: PublicCompactGrepResult | PublicCompactSearchTermsResult,
): string {
  const body =
    result.items.length > 0
      ? result.items.map((item) => `${item.path}\n  ${item.line}: ${item.text}`).join("\n--\n")
      : "(no matches found)";
  return `base_path: ${result.base_path}\n\n${body}`;
}

function formatJsonResult(result: PublicToolResult): string {
  return JSON.stringify(result, null, 2);
}

function formatAgentResult(result: PublicToolResult): string {
  if (result.mode === "compact" && "text" in result) {
    return (result as PublicCompactRenderedTextResult).text;
  }
  if (result.mode === "compact" && "items" in result) {
    const first = result.items[0];
    if (!first || "line" in first) {
      return formatStructuredGrepResult(
        result as PublicCompactGrepResult | PublicCompactSearchTermsResult,
      );
    }
    return formatFindFilesResult(result as PublicCompactFindFilesResult);
  }
  return formatJsonResult(result);
}

function buildRequest(
  name: AgentMcpToolName,
  input: Record<string, unknown>,
  cwd: string,
  env: NodeJS.ProcessEnv,
): PublicToolRequest {
  switch (name) {
    case "find_files":
      return buildFindFilesRequest(input, cwd, env);
    case "grep":
      return buildGrepRequest(input, cwd, env);
    case "multi_grep":
      return buildMultiGrepRequest(input, cwd, env);
  }
}

export async function executeAgentMcpTool(args: {
  name: AgentMcpToolName;
  input: unknown;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  ensureDaemonRunning?: (env?: NodeJS.ProcessEnv) => Promise<void>;
  callPublicToolOverHttp?: (
    request: PublicToolRequest,
    env?: NodeJS.ProcessEnv,
  ) => Promise<SearchCoordinatorResult>;
}): Promise<AgentMcpResponse> {
  if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) {
    return errorResponse("request must be an object");
  }
  const env = args.env ?? process.env;
  const cwd = args.cwd ?? process.cwd();
  const ensureDaemonRunning = args.ensureDaemonRunning ?? defaultEnsureDaemonRunning;
  const callPublicToolOverHttp = args.callPublicToolOverHttp ?? defaultCallPublicToolOverHttp;

  try {
    const request = buildRequest(args.name, args.input as Record<string, unknown>, cwd, env);
    await ensureDaemonRunning(env);
    const result = await callPublicToolOverHttp(request, env);
    if (!result.ok) {
      return errorResponse(`${result.error.code}: ${result.error.message}`);
    }
    return textResponse(formatAgentResult(result.value));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error));
  }
}

export function createAgentMcpServer(
  args: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    ensureDaemonRunning?: (env?: NodeJS.ProcessEnv) => Promise<void>;
    callPublicToolOverHttp?: (
      request: PublicToolRequest,
      env?: NodeJS.ProcessEnv,
    ) => Promise<SearchCoordinatorResult>;
  } = {},
) {
  const server = new McpServer({ name: "fff-router-agent-mcp", version: "1.0.0" });

  for (const tool of AGENT_MCP_TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.zodInputShape,
      },
      async (input: unknown) =>
        await executeAgentMcpTool({
          name: tool.name,
          input,
          cwd: args.cwd,
          env: args.env,
          ensureDaemonRunning: args.ensureDaemonRunning,
          callPublicToolOverHttp: args.callPublicToolOverHttp,
        }),
    );
  }

  return server;
}

export async function runAgentMcpServer(
  args: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdin?: NodeJS.ReadStream;
  } = {},
): Promise<void> {
  const server = createAgentMcpServer({ cwd: args.cwd, env: args.env });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  await new Promise<void>((resolve, reject) => {
    const stdin = args.stdin ?? processStdin;
    stdin.once("end", resolve);
    stdin.once("close", resolve);
    stdin.once("error", reject);
  }).finally(async () => {
    await server.close().catch(() => {});
  });
}
