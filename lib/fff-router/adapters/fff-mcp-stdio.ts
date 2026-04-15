import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { filterItems } from "./common";
import type {
  BackendSearchResult,
  BackendSearchSummary,
  SearchBackendAdapter,
  SearchBackendRuntime,
} from "./types";

type FffMcpRuntime = SearchBackendRuntime & {
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>;
};

function backendUnavailable(message: string): BackendSearchResult {
  return {
    ok: false,
    error: {
      code: "BACKEND_UNAVAILABLE",
      backendId: "fff-mcp",
      message,
    },
  };
}

function searchFailed(message: string): BackendSearchResult {
  return {
    ok: false,
    error: {
      code: "SEARCH_FAILED",
      backendId: "fff-mcp",
      message,
    },
  };
}

function discoverFffMcpCommand(): string {
  return process.env.FFF_ROUTER_FFF_MCP_BIN || "fff-mcp";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inheritedStringEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function normalizeRelative(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function formatExcludeConstraint(excludePath: string): string {
  return excludePath.includes(".") || excludePath.endsWith("/")
    ? `!${excludePath}`
    : `!${excludePath}/`;
}

function buildConstraintTokens(request: {
  persistenceRoot: string;
  basePath: string;
  fileRestriction?: string;
  glob?: string;
  extensions: string[];
  excludePaths: string[];
}): string[] {
  const tokens: string[] = [];
  if (request.fileRestriction) {
    const relativeFile = normalizeRelative(
      path.relative(request.persistenceRoot, request.fileRestriction),
    );
    if (relativeFile && relativeFile !== ".") {
      tokens.push(relativeFile);
    }
  } else {
    const baseRelative = normalizeRelative(
      path.relative(request.persistenceRoot, request.basePath),
    );
    if (baseRelative && baseRelative !== ".") {
      tokens.push(baseRelative.endsWith("/") ? baseRelative : `${baseRelative}/`);
    }
  }

  if (request.glob) {
    tokens.push(request.glob);
  }

  for (const extension of request.extensions) {
    tokens.push(`*.${extension}`);
  }

  for (const excludePath of request.excludePaths) {
    tokens.push(formatExcludeConstraint(excludePath));
  }

  return tokens;
}

function compileFindFilesQuery(request: {
  query: string;
  persistenceRoot: string;
  basePath: string;
  fileRestriction?: string;
  glob?: string;
  extensions: string[];
  excludePaths: string[];
}): string {
  return [request.query, ...buildConstraintTokens(request)].filter(Boolean).join(" ");
}

function compileConstraints(request: {
  persistenceRoot: string;
  basePath: string;
  fileRestriction?: string;
  glob?: string;
  extensions: string[];
  excludePaths: string[];
}): string {
  return buildConstraintTokens(request).join(" ");
}

function compileGrepQuery(request: {
  patterns: string[];
  persistenceRoot: string;
  basePath: string;
  fileRestriction?: string;
  glob?: string;
  extensions: string[];
  excludePaths: string[];
}): string {
  const combinedPattern =
    request.patterns.length === 1
      ? (request.patterns[0] ?? "")
      : request.patterns.map((pattern) => `(?:${pattern})`).join("|");
  return [...buildConstraintTokens(request), combinedPattern].filter(Boolean).join(" ");
}

function stripFindFilesSuffix(line: string): string {
  return line
    .replace(/\s+-\s+(hot|warm|frequent)(\s+git:[^\s]+)?$/, "")
    .replace(/\s+git:[^\s]+$/, "")
    .trim();
}

function parseFindFilesOutput(text: string, persistenceRoot: string) {
  const items: Array<{ path: string; relativePath: string }> = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (
      !line ||
      line.startsWith("→") ||
      line.startsWith("cursor:") ||
      /^\d+\/\d+\s+matches/.test(line) ||
      /^0\s+results/.test(line)
    ) {
      continue;
    }

    const relativePath = stripFindFilesSuffix(line);
    if (!relativePath) {
      continue;
    }

    items.push({
      path: path.join(persistenceRoot, relativePath),
      relativePath,
    });
  }

  return items;
}

function parseReadRecommendation(
  line: string,
): BackendSearchSummary["readRecommendation"] | undefined {
  const match = line.match(/^→\s+Read\s+(.+?)(?:\s+\((.+)\))?$/);
  if (!match) {
    return undefined;
  }

  const relativePath = match[1];
  const reason = match[2];
  if (!relativePath) {
    return undefined;
  }

  return {
    relativePath: normalizeRelative(relativePath.trim().replace(/\s+\[def\]$/, "")),
    ...(reason ? { reason: reason.trim() } : {}),
  };
}

function parseShownSummary(line: string): Pick<BackendSearchSummary, "shownCount" | "totalCount"> {
  const match = line.match(/^(\d+)\/(\d+)\s+matches\s+shown$/);
  if (!match) {
    return {};
  }

  return {
    shownCount: Number(match[1]),
    totalCount: Number(match[2]),
  };
}

function parseTextMatchOutput(text: string, persistenceRoot: string) {
  const items: Array<{
    path: string;
    relativePath: string;
    line: number;
    text: string;
    contextBefore?: string[];
    contextAfter?: string[];
    isDefinition?: boolean;
    definitionBody?: string[];
  }> = [];

  const summary: BackendSearchSummary = {};
  let currentPath: string | null = null;
  let currentPathIsDefinition = false;
  let pendingBefore: string[] = [];
  let currentMatch: {
    path: string;
    relativePath: string;
    line: number;
    text: string;
    contextBefore?: string[];
    contextAfter?: string[];
    isDefinition?: boolean;
    definitionBody?: string[];
  } | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith("cursor:")) {
      continue;
    }

    const readRecommendation = parseReadRecommendation(line);
    if (readRecommendation) {
      summary.readRecommendation = readRecommendation;
      continue;
    }

    const shownSummary = parseShownSummary(line);
    if (shownSummary.shownCount !== undefined || shownSummary.totalCount !== undefined) {
      Object.assign(summary, shownSummary);
      continue;
    }

    if (/^0\s+matches/.test(line) || /^0\s+exact\s+matches/.test(line)) {
      continue;
    }

    if (line === "--") {
      currentMatch = null;
      pendingBefore = [];
      continue;
    }

    const numbered = line.match(/^\s+(\d+)([:\-|])\s?(.*)$/);
    if (numbered) {
      const [, lineNumberRaw, kind, contentRaw] = numbered;
      const lineNumber = Number(lineNumberRaw);
      const content = (contentRaw ?? "").trim();

      if (kind === ":") {
        if (!currentPath) {
          continue;
        }
        currentMatch = {
          path: path.join(persistenceRoot, currentPath),
          relativePath: currentPath,
          line: lineNumber,
          text: content,
          ...(pendingBefore.length > 0 ? { contextBefore: [...pendingBefore] } : {}),
          ...(currentPathIsDefinition ? { isDefinition: true } : {}),
        };
        items.push(currentMatch);
        pendingBefore = [];
        continue;
      }

      if (kind === "-") {
        if (currentMatch) {
          currentMatch.contextAfter = [...(currentMatch.contextAfter ?? []), content];
        } else {
          pendingBefore.push(content);
        }
        continue;
      }

      if (kind === "|") {
        if (currentMatch) {
          if (currentMatch.isDefinition) {
            currentMatch.definitionBody = [...(currentMatch.definitionBody ?? []), content];
          } else {
            currentMatch.contextAfter = [...(currentMatch.contextAfter ?? []), content];
          }
        }
        continue;
      }
    }

    currentPathIsDefinition = /\s+\[def\]$/.test(line);
    currentPath = normalizeRelative(line.replace(/\s+\[[^\]]+\]$/, ""));
    currentMatch = null;
    pendingBefore = [];
  }

  return { items, summary };
}

async function callToolText(
  runtime: FffMcpRuntime,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  return await runtime.callTool(name, args);
}

export async function waitForFffMcpReady(
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>,
  delay: (ms: number) => Promise<void> = sleep,
): Promise<void> {
  for (const timeout of [100, 200, 300, 500, 700, 1000]) {
    const text = await callTool("find_files", { query: "a", maxResults: 1 });
    if (!/\(0 indexed\)/i.test(text)) {
      return;
    }
    await delay(timeout);
  }

  throw new Error("fff-mcp did not finish indexing in time");
}

export function createFffMcpStdioAdapter(): SearchBackendAdapter<FffMcpRuntime> {
  return {
    backendId: "fff-mcp",
    supportedQueryKinds: ["find_files", "search_terms", "grep"],
    async startRuntime(args) {
      const transport = new StdioClientTransport({
        command: discoverFffMcpCommand(),
        args: [args.persistenceRoot],
        cwd: args.persistenceRoot,
        env: inheritedStringEnv(),
        stderr: "pipe",
      });
      const client = new Client(
        { name: "fff-router-fff-mcp", version: "1.0.0" },
        { capabilities: {} },
      );
      await client.connect(transport);

      const runtime: FffMcpRuntime = {
        id: `fff-mcp::${args.persistenceRoot}`,
        async close() {
          await client.close().catch(() => {});
          await transport.close().catch(() => {});
        },
        async callTool(name, args) {
          const response = (await client.callTool({ name, arguments: args })) as {
            isError?: boolean;
            content?: Array<{ type?: string; text?: string }>;
          };
          const text = response.content?.find((entry) => entry.type === "text")?.text;
          if (response.isError || typeof text !== "string") {
            throw new Error(text || `fff-mcp ${name} call failed`);
          }
          return text;
        },
      };

      await waitForFffMcpReady(runtime.callTool.bind(runtime));
      return runtime;
    },
    async execute(args) {
      if (!args.runtime) {
        return backendUnavailable("fff-mcp runtime is not available");
      }

      try {
        switch (args.request.queryKind) {
          case "find_files": {
            const text = await callToolText(args.runtime, "find_files", {
              query: compileFindFilesQuery(args.request),
              maxResults: args.request.limit,
            });
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "find_files",
                items: filterItems(
                  args.request,
                  parseFindFilesOutput(text, args.request.persistenceRoot),
                ),
                nextCursor: null,
              },
            };
          }
          case "search_terms": {
            const text = await callToolText(args.runtime, "multi_grep", {
              patterns: args.request.terms,
              constraints: compileConstraints(args.request),
              maxResults: args.request.limit,
              context: args.request.contextLines,
            });
            const parsed = parseTextMatchOutput(text, args.request.persistenceRoot);
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "search_terms",
                items: filterItems(args.request, parsed.items),
                nextCursor: null,
                renderedCompact: text,
                summary: parsed.summary,
              },
            };
          }
          case "grep": {
            const text = await callToolText(args.runtime, "grep", {
              query: compileGrepQuery(args.request),
              maxResults: args.request.limit,
            });
            const parsed = parseTextMatchOutput(text, args.request.persistenceRoot);
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "grep",
                items: filterItems(args.request, parsed.items),
                nextCursor: null,
                renderedCompact: text,
                summary: parsed.summary,
              },
            };
          }
        }
      } catch (error) {
        return searchFailed(error instanceof Error ? error.message : String(error));
      }
    },
  };
}
