// lib/fff-router/public-api.ts
import path2 from "node:path";
import * as z from "zod/v4";

// lib/fff-router/home-path.ts
import path from "node:path";
function invalid(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function joinHome(home, suffix) {
  return suffix ? path.join(home, suffix) : home;
}
function expandHomePath(candidate, env = process.env) {
  const trimmed = candidate.trim();
  const home = env.HOME?.trim();
  if (trimmed === "~" || trimmed.startsWith("~/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice(2)) };
  }
  if (trimmed === "$HOME" || trimmed.startsWith("$HOME/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice("$HOME/".length)) };
  }
  if (trimmed === "${HOME}" || trimmed.startsWith("${HOME}/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice("${HOME}/".length)) };
  }
  return { ok: true, value: trimmed };
}

// lib/fff-router/public-api.ts
var MAX_RESULTS = 50;
var MAX_CONTEXT_LINES = 5;
var MAX_PATTERNS = 20;
var MAX_FILTERS = 30;
var MAX_WITHIN_PATHS = 10;
var MAX_QUERY_LENGTH = 1024;
var extension = z.string().min(1).max(64).refine(
  (value) => /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value.trim().replace(/^\./, "")),
  "extensions must be literal suffixes without path or glob syntax"
);
var relativeFilter = z.string().min(1).max(512).refine(
  (value) => !path2.posix.isAbsolute(value.trim().replace(/\\/g, "/").replace(/^\.\//, "")),
  "path filters must be relative"
).refine(
  (value) => !value.trim().replace(/\\/g, "/").replace(/^\.\//, "").split("/").some((segment) => segment === "" || segment === "." || segment === ".."),
  "path filters must not contain empty, current-directory, or parent-directory segments"
);
var glob = relativeFilter.refine(
  (value) => !value.trim().startsWith("!"),
  "glob is an include filter; use excludePaths for exclusions"
);
var within = z.union([
  z.string().min(1).max(4096).refine((value) => value.trim().length > 0),
  z.array(
    z.string().min(1).max(4096).refine((value) => value.trim().length > 0)
  ).min(1).max(MAX_WITHIN_PATHS)
]);
var commonShape = {
  within,
  glob: glob.optional(),
  extensions: z.array(extension).max(MAX_FILTERS).optional().default([]),
  excludePaths: z.array(relativeFilter).max(MAX_FILTERS).optional().default([]),
  limit: z.number().int().min(1).max(MAX_RESULTS).optional().default(20),
  cursor: z.string().min(1).max(4096).nullable().optional().default(null)
};
var findFilesInputSchema = z.strictObject({
  query: z.string().min(1).max(MAX_QUERY_LENGTH).refine((value) => value.trim().length > 0, "query must not be blank"),
  ...commonShape
});
var grepInputSchema = z.strictObject({
  patterns: z.array(
    z.string().min(1).max(MAX_QUERY_LENGTH).refine((value) => value.trim().length > 0, "patterns must not be blank")
  ).min(1).max(MAX_PATTERNS),
  literal: z.boolean().optional().default(true),
  contextLines: z.number().int().min(0).max(MAX_CONTEXT_LINES).optional().default(0),
  ...commonShape
});
var fileHitSchema = z.object({
  path: z.string(),
  absolutePath: z.string()
});
var textHitSchema = z.object({
  ...fileHitSchema.shape,
  line: z.number().int().min(1),
  text: z.string(),
  column: z.number().int().min(0).optional(),
  contextBefore: z.array(z.string()).optional(),
  contextAfter: z.array(z.string()).optional(),
  isDefinition: z.boolean().optional(),
  definitionBody: z.array(z.string()).optional()
});
var searchResultStatsSchema = z.object({
  resultCount: z.number().int().min(0),
  upstreamShownCount: z.number().int().min(0).optional(),
  upstreamTotalCount: z.number().int().min(0).optional(),
  coldStart: z.boolean(),
  workerId: z.string().min(1),
  workerGeneration: z.number().int().min(1)
});
var readRecommendationSchema = z.object({
  path: z.string(),
  absolutePath: z.string(),
  reason: z.string().optional()
});
var searchResultBaseShape = {
  root: z.string(),
  backend: z.literal("fff-mcp"),
  nextCursor: z.string().nullable(),
  stats: searchResultStatsSchema,
  readRecommendation: readRecommendationSchema.optional(),
  displayText: z.string().optional()
};
var findFilesResultSchema = z.object({
  tool: z.literal("find_files"),
  ...searchResultBaseShape,
  items: z.array(fileHitSchema)
});
var grepResultSchema = z.object({
  tool: z.literal("grep"),
  ...searchResultBaseShape,
  items: z.array(textHitSchema)
});
var publicToolResultSchema = z.discriminatedUnion("tool", [
  findFilesResultSchema,
  grepResultSchema
]);
var workerDiagnosticSchema = z.object({
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
  retryAfter: z.number().min(0).optional()
});
var routerStatusSchema = z.object({
  workers: z.array(workerDiagnosticSchema),
  limits: z.object({
    maxWorkers: z.number().int().min(1),
    maxNonGitWorkers: z.number().int().min(0)
  })
});
var warmResultSchema = z.object({ workers: z.array(workerDiagnosticSchema) });
var evictResultSchema = z.object({ evicted: z.array(z.string()) });
var PUBLIC_TOOL_DEFINITIONS = [
  {
    name: "find_files",
    description: "Fuzzy-search file names and paths using a shared warm fff-mcp index. within must be one or more absolute paths under the same repository or configured non-Git root.",
    inputSchema: findFilesInputSchema
  },
  {
    name: "grep",
    description: "Search file contents through a shared warm fff-mcp index. Multiple patterns use OR semantics; literal matching is the safe default and regex matching must be selected explicitly.",
    inputSchema: grepInputSchema
  }
];
function invalid2(message) {
  return { ok: false, error: { code: "INVALID_REQUEST", message } };
}
function formatZodError(error) {
  return error.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join(".") : "request";
    return `${field}: ${issue.message}`;
  }).join("; ");
}
function normalizeWithin(value, env) {
  const values = Array.isArray(value) ? value : [value];
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of values) {
    const expanded = expandHomePath(entry.trim(), env);
    if (!expanded.ok) {
      return invalid2(expanded.error.message);
    }
    if (!path2.isAbsolute(expanded.value)) {
      return invalid2("within paths must be absolute on the daemon wire protocol");
    }
    const clean = path2.normalize(expanded.value);
    if (seen.has(clean)) {
      return invalid2(`within contains duplicate path '${clean}'`);
    }
    seen.add(clean);
    normalized.push(clean);
  }
  return { ok: true, value: normalized };
}
function rejectWildcardOnlyRegex(patterns, literal2) {
  if (literal2) {
    return { ok: true, value: void 0 };
  }
  const wildcardOnly = /^(?:[.^$]*(?:[.][*+?]|[*+])[.^$]*|[.^$\s]*|\.\*[+?]?|\.\+[?]?|[.*?])$/;
  const rejected = patterns.find((pattern) => wildcardOnly.test(pattern.trim()));
  return rejected ? invalid2(`regex '${rejected}' matches everything; provide a concrete expression`) : { ok: true, value: void 0 };
}
function normalizePublicToolInput(tool, input, env = process.env) {
  const schema = tool === "find_files" ? findFilesInputSchema : grepInputSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return invalid2(formatZodError(parsed.error));
  }
  const resolvedWithin = normalizeWithin(parsed.data.within, env);
  if (!resolvedWithin.ok) {
    return resolvedWithin;
  }
  const common = {
    within: resolvedWithin.value,
    ...parsed.data.glob ? { glob: parsed.data.glob.trim().replace(/\\/g, "/").replace(/^\.\//, "") } : {},
    extensions: [
      ...new Set(parsed.data.extensions.map((value) => value.trim().replace(/^\./, "")))
    ],
    excludePaths: [
      ...new Set(
        parsed.data.excludePaths.map(
          (value) => value.trim().replace(/\\/g, "/").replace(/^\.\//, "")
        )
      )
    ],
    limit: parsed.data.limit,
    cursor: parsed.data.cursor
  };
  if (tool === "find_files") {
    const data2 = parsed.data;
    const request2 = {
      tool,
      query: data2.query.trim(),
      ...common
    };
    return { ok: true, value: request2 };
  }
  const data = parsed.data;
  const concreteRegex = rejectWildcardOnlyRegex(data.patterns, data.literal);
  if (!concreteRegex.ok) {
    return concreteRegex;
  }
  const request = {
    tool,
    patterns: [...new Set(data.patterns)],
    literal: data.literal,
    contextLines: data.contextLines,
    ...common
  };
  return { ok: true, value: request };
}
export {
  MAX_CONTEXT_LINES,
  MAX_FILTERS,
  MAX_PATTERNS,
  MAX_QUERY_LENGTH,
  MAX_RESULTS,
  MAX_WITHIN_PATHS,
  PUBLIC_TOOL_DEFINITIONS,
  evictResultSchema,
  fileHitSchema,
  findFilesInputSchema,
  findFilesResultSchema,
  grepInputSchema,
  grepResultSchema,
  normalizePublicToolInput,
  publicToolResultSchema,
  readRecommendationSchema,
  routerStatusSchema,
  searchResultStatsSchema,
  textHitSchema,
  warmResultSchema,
  workerDiagnosticSchema
};
