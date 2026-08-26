import path from "node:path";
import * as z from "zod/v4";
import { expandHomePath } from "./home-path";
import type {
  FindFilesResult,
  GrepResult,
  PublicFindFilesRequest,
  PublicGrepRequest,
  PublicToolName,
  PublicToolRequest,
  PublicToolResult,
  Result,
  RouterError,
  RouterStatus,
  WorkerDiagnostic,
} from "./types";

export const MAX_RESULTS = 50;
export const MAX_CONTEXT_LINES = 5;
export const MAX_PATTERNS = 20;
export const MAX_FILTERS = 30;
export const MAX_WITHIN_PATHS = 10;
export const MAX_QUERY_LENGTH = 1_024;

const extension = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (value) => /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value.trim().replace(/^\./, "")),
    "extensions must be literal suffixes without path or glob syntax",
  );

const relativeFilter = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (value) => !path.posix.isAbsolute(value.trim().replace(/\\/g, "/").replace(/^\.\//, "")),
    "path filters must be relative",
  )
  .refine(
    (value) =>
      !value
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\.\//, "")
        .split("/")
        .some((segment) => segment === "" || segment === "." || segment === ".."),
    "path filters must not contain empty, current-directory, or parent-directory segments",
  );

const glob = relativeFilter.refine(
  (value) => !value.trim().startsWith("!"),
  "glob is an include filter; use excludePaths for exclusions",
);

const within = z.union([
  z
    .string()
    .min(1)
    .max(4_096)
    .refine((value) => value.trim().length > 0),
  z
    .array(
      z
        .string()
        .min(1)
        .max(4_096)
        .refine((value) => value.trim().length > 0),
    )
    .min(1)
    .max(MAX_WITHIN_PATHS),
]);

const commonShape = {
  within,
  glob: glob.optional(),
  extensions: z.array(extension).max(MAX_FILTERS).optional().default([]),
  excludePaths: z.array(relativeFilter).max(MAX_FILTERS).optional().default([]),
  limit: z.number().int().min(1).max(MAX_RESULTS).optional().default(20),
  cursor: z.string().min(1).max(4_096).nullable().optional().default(null),
} satisfies z.ZodRawShape;

export const findFilesInputSchema = z.strictObject({
  query: z
    .string()
    .min(1)
    .max(MAX_QUERY_LENGTH)
    .refine((value) => value.trim().length > 0, "query must not be blank"),
  ...commonShape,
});

export const grepInputSchema = z.strictObject({
  patterns: z
    .array(
      z
        .string()
        .min(1)
        .max(MAX_QUERY_LENGTH)
        .refine((value) => value.trim().length > 0, "patterns must not be blank"),
    )
    .min(1)
    .max(MAX_PATTERNS),
  literal: z.boolean().optional().default(true),
  contextLines: z.number().int().min(0).max(MAX_CONTEXT_LINES).optional().default(0),
  ...commonShape,
});

export type FindFilesInput = z.input<typeof findFilesInputSchema>;
export type GrepInput = z.input<typeof grepInputSchema>;

export const fileHitSchema = z.object({
  path: z.string(),
  absolutePath: z.string(),
});

export const textHitSchema = z.object({
  ...fileHitSchema.shape,
  line: z.number().int().min(1),
  text: z.string(),
  column: z.number().int().min(0).optional(),
  contextBefore: z.array(z.string()).optional(),
  contextAfter: z.array(z.string()).optional(),
  isDefinition: z.boolean().optional(),
  definitionBody: z.array(z.string()).optional(),
});

export const searchResultStatsSchema = z.object({
  resultCount: z.number().int().min(0),
  upstreamShownCount: z.number().int().min(0).optional(),
  upstreamTotalCount: z.number().int().min(0).optional(),
  coldStart: z.boolean(),
  workerId: z.string().min(1),
  workerGeneration: z.number().int().min(1),
});

export const readRecommendationSchema = z.object({
  path: z.string(),
  absolutePath: z.string(),
  reason: z.string().optional(),
});

const searchResultBaseShape = {
  root: z.string(),
  backend: z.literal("fff-mcp"),
  nextCursor: z.string().nullable(),
  stats: searchResultStatsSchema,
  readRecommendation: readRecommendationSchema.optional(),
  displayText: z.string().optional(),
} satisfies z.ZodRawShape;

export const findFilesResultSchema = z.object({
  tool: z.literal("find_files"),
  ...searchResultBaseShape,
  items: z.array(fileHitSchema),
}) satisfies z.ZodType<FindFilesResult>;

export const grepResultSchema = z.object({
  tool: z.literal("grep"),
  ...searchResultBaseShape,
  items: z.array(textHitSchema),
}) satisfies z.ZodType<GrepResult>;

export const publicToolResultSchema = z.discriminatedUnion("tool", [
  findFilesResultSchema,
  grepResultSchema,
]) satisfies z.ZodType<PublicToolResult>;

export const workerDiagnosticSchema = z.object({
  root: z.string(),
  rootType: z.enum(["git", "non-git"]),
  state: z.enum(["starting", "ready", "draining", "dead"]),
  workerId: z.string().optional(),
  pid: z.number().int().nullable().optional(),
  generation: z.number().int().min(1),
  activeLeases: z.number().int().min(0),
  startedAt: z.number().min(0).optional(),
  lastUsedAt: z.number().min(0),
  lastCallAt: z.number().min(0).optional(),
  lastSuccessAt: z.number().min(0).optional(),
  lastError: z.string().optional(),
  lastErrorAt: z.number().min(0).optional(),
  failureCount: z.number().int().min(0),
  retryAfter: z.number().min(0).optional(),
}) satisfies z.ZodType<WorkerDiagnostic>;

export const routerStatusSchema = z.object({
  workers: z.array(workerDiagnosticSchema),
  limits: z.object({
    maxWorkers: z.number().int().min(1),
    maxNonGitWorkers: z.number().int().min(0),
  }),
}) satisfies z.ZodType<RouterStatus>;

export const warmResultSchema = z.object({ workers: z.array(workerDiagnosticSchema) });
export const evictResultSchema = z.object({ evicted: z.array(z.string()) });

export type PublicToolDefinition = {
  name: PublicToolName;
  description: string;
  inputSchema: typeof findFilesInputSchema | typeof grepInputSchema;
};

export const PUBLIC_TOOL_DEFINITIONS: readonly PublicToolDefinition[] = [
  {
    name: "find_files",
    description:
      "Fuzzy-search file names and paths using a shared warm fff-mcp index. within must be one or more absolute paths under the same repository or configured non-Git root.",
    inputSchema: findFilesInputSchema,
  },
  {
    name: "grep",
    description:
      "Search file contents through a shared warm fff-mcp index. Multiple patterns use OR semantics; literal matching is the safe default and regex matching must be selected explicitly.",
    inputSchema: grepInputSchema,
  },
];

function invalid(message: string): Result<never, RouterError> {
  return { ok: false, error: { code: "INVALID_REQUEST", message } };
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const field = issue.path.length > 0 ? issue.path.join(".") : "request";
      return `${field}: ${issue.message}`;
    })
    .join("; ");
}

function normalizeWithin(
  value: string | string[],
  env: NodeJS.ProcessEnv,
): Result<string[], RouterError> {
  const values = Array.isArray(value) ? value : [value];
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const entry of values) {
    const expanded = expandHomePath(entry.trim(), env);
    if (!expanded.ok) {
      return invalid(expanded.error.message);
    }
    if (!path.isAbsolute(expanded.value)) {
      return invalid("within paths must be absolute on the daemon wire protocol");
    }
    const clean = path.normalize(expanded.value);
    if (seen.has(clean)) {
      return invalid(`within contains duplicate path '${clean}'`);
    }
    seen.add(clean);
    normalized.push(clean);
  }

  return { ok: true, value: normalized };
}

function rejectWildcardOnlyRegex(patterns: string[], literal: boolean): Result<void, RouterError> {
  if (literal) {
    return { ok: true, value: undefined };
  }

  const wildcardOnly = /^(?:[.^$]*(?:[.][*+?]|[*+])[.^$]*|[.^$\s]*|\.\*[+?]?|\.\+[?]?|[.*?])$/;
  const rejected = patterns.find((pattern) => wildcardOnly.test(pattern.trim()));
  return rejected
    ? invalid(`regex '${rejected}' matches everything; provide a concrete expression`)
    : { ok: true, value: undefined };
}

export function normalizePublicToolInput(
  tool: PublicToolName,
  input: unknown,
  env: NodeJS.ProcessEnv = process.env,
): Result<PublicToolRequest, RouterError> {
  const schema = tool === "find_files" ? findFilesInputSchema : grepInputSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return invalid(formatZodError(parsed.error));
  }

  const resolvedWithin = normalizeWithin(parsed.data.within, env);
  if (!resolvedWithin.ok) {
    return resolvedWithin;
  }

  const common = {
    within: resolvedWithin.value,
    ...(parsed.data.glob
      ? { glob: parsed.data.glob.trim().replace(/\\/g, "/").replace(/^\.\//, "") }
      : {}),
    extensions: [
      ...new Set(parsed.data.extensions.map((value) => value.trim().replace(/^\./, ""))),
    ],
    excludePaths: [
      ...new Set(
        parsed.data.excludePaths.map((value) =>
          value.trim().replace(/\\/g, "/").replace(/^\.\//, ""),
        ),
      ),
    ],
    limit: parsed.data.limit,
    cursor: parsed.data.cursor,
  };

  if (tool === "find_files") {
    const data = parsed.data as z.output<typeof findFilesInputSchema>;
    const request: PublicFindFilesRequest = {
      tool,
      query: data.query.trim(),
      ...common,
    };
    return { ok: true, value: request };
  }

  const data = parsed.data as z.output<typeof grepInputSchema>;
  const concreteRegex = rejectWildcardOnlyRegex(data.patterns, data.literal);
  if (!concreteRegex.ok) {
    return concreteRegex;
  }
  const request: PublicGrepRequest = {
    tool,
    patterns: [...new Set(data.patterns)],
    literal: data.literal,
    contextLines: data.contextLines,
    ...common,
  };
  return { ok: true, value: request };
}
