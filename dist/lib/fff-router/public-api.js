// lib/fff-router/public-api.ts
import path2 from "node:path";

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
var ProtocolValidationError = class extends Error {
  constructor(issues) {
    super(issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`).join("; "));
    this.issues = issues;
  }
  issues;
};
function runtimeSchema(jsonSchema, validate) {
  const schema = { ...jsonSchema };
  Object.defineProperties(schema, {
    // Runtime helpers must not leak into tools/list JSON Schema or create a
    // self-reference when the response is serialized.
    jsonSchema: { value: schema, enumerable: false },
    safeParse: { value: validate, enumerable: false },
    parse: {
      enumerable: false,
      value(value) {
        const result = validate(value);
        if (!result.success) {
          throw new ProtocolValidationError(result.error.issues);
        }
        return result.data;
      }
    }
  });
  return schema;
}
function valid(data) {
  return { success: true, data };
}
function invalidValue(pathValue, message) {
  return { success: false, error: { issues: [{ path: pathValue, message }] } };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejectUnknownFields(value, allowed) {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  return unknown ? invalidValue([unknown], "unknown field") : valid(void 0);
}
function readBoundedString(value, field, options) {
  if (typeof value !== "string") {
    return invalidValue([field], "must be a string");
  }
  const normalized = options.trim ? value.trim() : value;
  if (!options.allowBlank && normalized.length === 0) {
    return invalidValue([field], "must not be blank");
  }
  if (normalized.length > options.max) {
    return invalidValue([field], `must contain at most ${options.max} characters`);
  }
  return valid(normalized);
}
function readStringArray(value, field, options) {
  if (!Array.isArray(value)) {
    return invalidValue([field], "must be an array");
  }
  if (value.length < (options.minItems ?? 0)) {
    return invalidValue([field], `must contain at least ${options.minItems ?? 0} item(s)`);
  }
  if (value.length > options.maxItems) {
    return invalidValue([field], `must contain at most ${options.maxItems} item(s)`);
  }
  const output = [];
  for (let index = 0; index < value.length; index += 1) {
    const parsed = readBoundedString(value[index], `${field}.${index}`, {
      max: options.maxLength,
      trim: true
    });
    if (!parsed.success) {
      return parsed;
    }
    output.push(parsed.data);
  }
  return valid(output);
}
function readWithinInput(value) {
  if (typeof value === "string") {
    return readBoundedString(value, "within", { max: 4096, trim: true });
  }
  return readStringArray(value, "within", {
    minItems: 1,
    maxItems: MAX_WITHIN_PATHS,
    maxLength: 4096
  });
}
function normalizeRelativeFilter(value, field) {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (path2.posix.isAbsolute(normalized)) {
    return invalidValue([field], "path filters must be relative");
  }
  if (normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    return invalidValue(
      [field],
      "path filters must not contain empty, current-directory, or parent-directory segments"
    );
  }
  return valid(normalized);
}
function readRelativeFilters(value, field) {
  if (value === void 0) {
    return valid([]);
  }
  const values = readStringArray(value, field, { maxItems: MAX_FILTERS, maxLength: 512 });
  if (!values.success) {
    return values;
  }
  const normalized = [];
  for (let index = 0; index < values.data.length; index += 1) {
    const parsed = normalizeRelativeFilter(values.data[index], `${field}.${index}`);
    if (!parsed.success) {
      return parsed;
    }
    normalized.push(parsed.data);
  }
  return valid([...new Set(normalized)]);
}
function readExtensions(value) {
  if (value === void 0) {
    return valid([]);
  }
  const values = readStringArray(value, "extensions", {
    maxItems: MAX_FILTERS,
    maxLength: 64
  });
  if (!values.success) {
    return values;
  }
  const normalized = [];
  for (let index = 0; index < values.data.length; index += 1) {
    const extension = values.data[index].replace(/^\./, "");
    if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(extension)) {
      return invalidValue(
        ["extensions", index],
        "extensions must be literal suffixes without path or glob syntax"
      );
    }
    normalized.push(extension);
  }
  return valid([...new Set(normalized)]);
}
function readInteger(value, field, options) {
  if (value === void 0) {
    return valid(options.fallback);
  }
  if (!Number.isInteger(value) || value < options.min || value > options.max) {
    return invalidValue([field], `must be an integer between ${options.min} and ${options.max}`);
  }
  return valid(value);
}
function readCursor(value) {
  if (value === void 0 || value === null) {
    return valid(null);
  }
  return readBoundedString(value, "cursor", { max: 4096, trim: false });
}
var JSON_SCHEMA_2020_12 = "https://json-schema.org/draft/2020-12/schema";
var withinJsonSchema = {
  oneOf: [
    { type: "string", minLength: 1, maxLength: 4096 },
    {
      type: "array",
      minItems: 1,
      maxItems: MAX_WITHIN_PATHS,
      items: { type: "string", minLength: 1, maxLength: 4096 }
    }
  ]
};
var commonJsonSchemaProperties = {
  within: withinJsonSchema,
  glob: { type: "string", minLength: 1, maxLength: 512 },
  extensions: {
    type: "array",
    maxItems: MAX_FILTERS,
    items: { type: "string", minLength: 1, maxLength: 64 },
    default: []
  },
  excludePaths: {
    type: "array",
    maxItems: MAX_FILTERS,
    items: { type: "string", minLength: 1, maxLength: 512 },
    default: []
  },
  limit: { type: "integer", minimum: 1, maximum: MAX_RESULTS, default: 20 },
  cursor: { type: ["string", "null"], minLength: 1, maxLength: 4096, default: null }
};
function parseCommonInput(record) {
  const within = readWithinInput(record.within);
  if (!within.success) return within;
  const extensions = readExtensions(record.extensions);
  if (!extensions.success) return extensions;
  const excludePaths = readRelativeFilters(record.excludePaths, "excludePaths");
  if (!excludePaths.success) return excludePaths;
  const limit = readInteger(record.limit, "limit", { min: 1, max: MAX_RESULTS, fallback: 20 });
  if (!limit.success) return limit;
  const cursor = readCursor(record.cursor);
  if (!cursor.success) return cursor;
  let globValue;
  if (record.glob !== void 0) {
    const globString = readBoundedString(record.glob, "glob", { max: 512, trim: true });
    if (!globString.success) return globString;
    const glob = normalizeRelativeFilter(globString.data, "glob");
    if (!glob.success) return glob;
    if (glob.data.startsWith("!")) {
      return invalidValue(["glob"], "glob is an include filter; use excludePaths for exclusions");
    }
    globValue = glob.data;
  }
  return valid({
    within: within.data,
    ...globValue ? { glob: globValue } : {},
    extensions: extensions.data,
    excludePaths: excludePaths.data,
    limit: limit.data,
    cursor: cursor.data
  });
}
function parseFindFilesInput(value) {
  if (!isRecord(value)) return invalidValue([], "request must be an object");
  const known = rejectUnknownFields(value, [
    "query",
    "within",
    "glob",
    "extensions",
    "excludePaths",
    "limit",
    "cursor"
  ]);
  if (!known.success) return known;
  const query = readBoundedString(value.query, "query", { max: MAX_QUERY_LENGTH, trim: true });
  if (!query.success) return query;
  const common = parseCommonInput(value);
  return common.success ? valid({ query: query.data, ...common.data }) : common;
}
function parseGrepInput(value) {
  if (!isRecord(value)) return invalidValue([], "request must be an object");
  const known = rejectUnknownFields(value, [
    "patterns",
    "literal",
    "contextLines",
    "within",
    "glob",
    "extensions",
    "excludePaths",
    "limit",
    "cursor"
  ]);
  if (!known.success) return known;
  const patterns = readStringArray(value.patterns, "patterns", {
    minItems: 1,
    maxItems: MAX_PATTERNS,
    maxLength: MAX_QUERY_LENGTH
  });
  if (!patterns.success) return patterns;
  if (value.literal !== void 0 && typeof value.literal !== "boolean") {
    return invalidValue(["literal"], "must be a boolean");
  }
  const contextLines = readInteger(value.contextLines, "contextLines", {
    min: 0,
    max: MAX_CONTEXT_LINES,
    fallback: 0
  });
  if (!contextLines.success) return contextLines;
  const common = parseCommonInput(value);
  if (!common.success) return common;
  return valid({
    patterns: patterns.data,
    literal: value.literal === void 0 ? true : value.literal,
    contextLines: contextLines.data,
    ...common.data
  });
}
var findFilesInputSchema = runtimeSchema(
  {
    $schema: JSON_SCHEMA_2020_12,
    type: "object",
    additionalProperties: false,
    required: ["query", "within"],
    properties: {
      query: { type: "string", minLength: 1, maxLength: MAX_QUERY_LENGTH },
      ...commonJsonSchemaProperties
    }
  },
  parseFindFilesInput
);
var grepInputSchema = runtimeSchema(
  {
    $schema: JSON_SCHEMA_2020_12,
    type: "object",
    additionalProperties: false,
    required: ["patterns", "within"],
    properties: {
      patterns: {
        type: "array",
        minItems: 1,
        maxItems: MAX_PATTERNS,
        items: { type: "string", minLength: 1, maxLength: MAX_QUERY_LENGTH }
      },
      literal: { type: "boolean", default: true },
      contextLines: {
        type: "integer",
        minimum: 0,
        maximum: MAX_CONTEXT_LINES,
        default: 0
      },
      ...commonJsonSchemaProperties
    }
  },
  parseGrepInput
);
var fileHitJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "absolutePath"],
  properties: { path: { type: "string" }, absolutePath: { type: "string" } }
};
var textHitJsonSchema = {
  type: "object",
  required: ["path", "absolutePath", "line", "text"],
  properties: {
    ...fileHitJsonSchema.properties,
    line: { type: "integer", minimum: 1 },
    text: { type: "string" },
    column: { type: "integer", minimum: 0 },
    contextBefore: { type: "array", items: { type: "string" } },
    contextAfter: { type: "array", items: { type: "string" } },
    isDefinition: { type: "boolean" },
    definitionBody: { type: "array", items: { type: "string" } }
  }
};
var searchResultStatsJsonSchema = {
  type: "object",
  required: ["resultCount", "coldStart", "workerId", "workerGeneration"],
  properties: {
    resultCount: { type: "integer", minimum: 0 },
    upstreamShownCount: { type: "integer", minimum: 0 },
    upstreamTotalCount: { type: "integer", minimum: 0 },
    coldStart: { type: "boolean" },
    workerId: { type: "string", minLength: 1 },
    workerGeneration: { type: "integer", minimum: 1 }
  }
};
function validateFileHit(value, pathPrefix) {
  if (!isRecord(value)) return invalidValue(pathPrefix, "must be an object");
  if (typeof value.path !== "string")
    return invalidValue([...pathPrefix, "path"], "must be a string");
  if (typeof value.absolutePath !== "string") {
    return invalidValue([...pathPrefix, "absolutePath"], "must be a string");
  }
  return valid(void 0);
}
function validateStats(value) {
  if (!isRecord(value)) return invalidValue(["stats"], "must be an object");
  if (!Number.isInteger(value.resultCount) || value.resultCount < 0) {
    return invalidValue(["stats", "resultCount"], "must be a non-negative integer");
  }
  if (typeof value.coldStart !== "boolean")
    return invalidValue(["stats", "coldStart"], "must be a boolean");
  if (typeof value.workerId !== "string" || value.workerId.length === 0) {
    return invalidValue(["stats", "workerId"], "must be a non-empty string");
  }
  if (!Number.isInteger(value.workerGeneration) || value.workerGeneration < 1) {
    return invalidValue(["stats", "workerGeneration"], "must be a positive integer");
  }
  return valid(void 0);
}
function validateSearchResultBase(value, expectedTool) {
  if (!isRecord(value)) return invalidValue([], "result must be an object");
  if (value.tool !== expectedTool) return invalidValue(["tool"], `must equal '${expectedTool}'`);
  if (typeof value.root !== "string") return invalidValue(["root"], "must be a string");
  if (value.backend !== "fff-mcp") return invalidValue(["backend"], "must equal 'fff-mcp'");
  if (value.nextCursor !== null && typeof value.nextCursor !== "string") {
    return invalidValue(["nextCursor"], "must be a string or null");
  }
  const stats = validateStats(value.stats);
  if (!stats.success) return stats;
  if (!Array.isArray(value.items)) return invalidValue(["items"], "must be an array");
  return valid(value);
}
var findFilesResultJsonSchema = {
  $schema: JSON_SCHEMA_2020_12,
  type: "object",
  required: ["tool", "root", "backend", "items", "nextCursor", "stats"],
  properties: {
    tool: { const: "find_files" },
    root: { type: "string" },
    backend: { const: "fff-mcp" },
    items: { type: "array", items: fileHitJsonSchema },
    nextCursor: { type: ["string", "null"] },
    stats: searchResultStatsJsonSchema
  }
};
var grepResultJsonSchema = {
  $schema: JSON_SCHEMA_2020_12,
  type: "object",
  required: ["tool", "root", "backend", "items", "nextCursor", "stats"],
  properties: {
    tool: { const: "grep" },
    root: { type: "string" },
    backend: { const: "fff-mcp" },
    items: { type: "array", items: textHitJsonSchema },
    nextCursor: { type: ["string", "null"] },
    stats: searchResultStatsJsonSchema
  }
};
var findFilesResultSchema = runtimeSchema(
  findFilesResultJsonSchema,
  (value) => {
    const base = validateSearchResultBase(value, "find_files");
    if (!base.success) return base;
    const items = base.data.items;
    for (let index = 0; index < items.length; index += 1) {
      const item = validateFileHit(items[index], ["items", index]);
      if (!item.success) return item;
    }
    return valid(value);
  }
);
var grepResultSchema = runtimeSchema(grepResultJsonSchema, (value) => {
  const base = validateSearchResultBase(value, "grep");
  if (!base.success) return base;
  const items = base.data.items;
  for (let index = 0; index < items.length; index += 1) {
    const item = validateFileHit(items[index], ["items", index]);
    if (!item.success) return item;
    const record = items[index];
    if (!Number.isInteger(record.line) || record.line < 1) {
      return invalidValue(["items", index, "line"], "must be a positive integer");
    }
    if (typeof record.text !== "string") {
      return invalidValue(["items", index, "text"], "must be a string");
    }
  }
  return valid(value);
});
var publicToolResultSchema = runtimeSchema(
  { oneOf: [findFilesResultJsonSchema, grepResultJsonSchema] },
  (value) => isRecord(value) && value.tool === "find_files" ? findFilesResultSchema.safeParse(value) : grepResultSchema.safeParse(value)
);
function validateWorkerDiagnostic(value, index) {
  if (!isRecord(value)) return invalidValue(["workers", index], "must be an object");
  if (typeof value.root !== "string")
    return invalidValue(["workers", index, "root"], "must be a string");
  if (value.rootType !== "git" && value.rootType !== "non-git") {
    return invalidValue(["workers", index, "rootType"], "must be 'git' or 'non-git'");
  }
  if (!["starting", "ready", "draining", "dead"].includes(String(value.state))) {
    return invalidValue(["workers", index, "state"], "invalid worker state");
  }
  if (!Number.isInteger(value.generation) || value.generation < 1) {
    return invalidValue(["workers", index, "generation"], "must be a positive integer");
  }
  if (!Number.isInteger(value.activeLeases) || value.activeLeases < 0) {
    return invalidValue(["workers", index, "activeLeases"], "must be a non-negative integer");
  }
  return valid(void 0);
}
var workerDiagnosticJsonSchema = {
  type: "object",
  required: [
    "root",
    "rootType",
    "state",
    "generation",
    "activeLeases",
    "lastUsedAt",
    "failureCount"
  ],
  properties: {
    root: { type: "string" },
    rootType: { enum: ["git", "non-git"] },
    state: { enum: ["starting", "ready", "draining", "dead"] },
    workerId: { type: "string" },
    pid: { type: ["integer", "null"] },
    generation: { type: "integer", minimum: 1 },
    activeLeases: { type: "integer", minimum: 0 },
    startedAt: { type: "number", minimum: 0 },
    lastUsedAt: { type: "number", minimum: 0 },
    lastCallAt: { type: "number", minimum: 0 },
    lastSuccessAt: { type: "number", minimum: 0 },
    lastError: { type: "string" },
    lastErrorAt: { type: "number", minimum: 0 },
    failureCount: { type: "integer", minimum: 0 },
    retryAfter: { type: "number", minimum: 0 },
    resources: {
      type: "object",
      properties: {
        sampledAt: { type: "number", minimum: 0 },
        rssBytes: { type: "integer", minimum: 0 },
        cpuTimeMs: { type: "number", minimum: 0 },
        threads: { type: "integer", minimum: 0 },
        processCount: { type: "integer", minimum: 1 }
      }
    },
    terminationReason: { type: "string" }
  }
};
var routerStatusJsonSchema = {
  $schema: JSON_SCHEMA_2020_12,
  type: "object",
  required: ["workers", "limits"],
  properties: {
    workers: { type: "array", items: workerDiagnosticJsonSchema },
    limits: {
      type: "object",
      required: ["maxWorkers", "maxNonGitWorkers"],
      properties: {
        maxWorkers: { type: "integer", minimum: 1 },
        maxNonGitWorkers: { type: "integer", minimum: 0 },
        maxWorkerRssBytes: { type: "integer", minimum: 1 },
        maxTotalWorkerRssBytes: { type: "integer", minimum: 1 }
      }
    },
    resources: {
      type: "object",
      properties: {
        sampledAt: { type: "number", minimum: 0 },
        daemonRssBytes: { type: "integer", minimum: 0 },
        workerRssBytes: { type: "integer", minimum: 0 },
        totalRssBytes: { type: "integer", minimum: 0 },
        measuredWorkers: { type: "integer", minimum: 0 }
      }
    }
  }
};
var routerStatusSchema = runtimeSchema(routerStatusJsonSchema, (value) => {
  if (!isRecord(value)) return invalidValue([], "status must be an object");
  if (!Array.isArray(value.workers)) return invalidValue(["workers"], "must be an array");
  for (let index = 0; index < value.workers.length; index += 1) {
    const worker = validateWorkerDiagnostic(value.workers[index], index);
    if (!worker.success) return worker;
  }
  if (!isRecord(value.limits)) return invalidValue(["limits"], "must be an object");
  if (!Number.isInteger(value.limits.maxWorkers) || value.limits.maxWorkers < 1) {
    return invalidValue(["limits", "maxWorkers"], "must be a positive integer");
  }
  if (!Number.isInteger(value.limits.maxNonGitWorkers) || value.limits.maxNonGitWorkers < 0) {
    return invalidValue(["limits", "maxNonGitWorkers"], "must be a non-negative integer");
  }
  return valid(value);
});
var warmResultJsonSchema = {
  type: "object",
  required: ["workers"],
  properties: { workers: { type: "array", items: workerDiagnosticJsonSchema } }
};
var warmResultSchema = runtimeSchema(
  warmResultJsonSchema,
  (value) => {
    if (!isRecord(value) || !Array.isArray(value.workers)) {
      return invalidValue(["workers"], "must be an array");
    }
    for (let index = 0; index < value.workers.length; index += 1) {
      const worker = validateWorkerDiagnostic(value.workers[index], index);
      if (!worker.success) return worker;
    }
    return valid(value);
  }
);
var evictResultJsonSchema = {
  type: "object",
  required: ["evicted"],
  properties: { evicted: { type: "array", items: { type: "string" } } }
};
var evictResultSchema = runtimeSchema(
  evictResultJsonSchema,
  (value) => isRecord(value) && Array.isArray(value.evicted) && value.evicted.every((item) => typeof item === "string") ? valid(value) : invalidValue(["evicted"], "must be an array of strings")
);
var PUBLIC_TOOL_DEFINITIONS = [
  {
    name: "find_files",
    description: "Fuzzy-search file names and paths using a shared warm fff-mcp index. within must be one or more absolute paths under the same repository or configured non-Git root.",
    inputSchema: findFilesInputSchema,
    outputSchema: findFilesResultJsonSchema
  },
  {
    name: "grep",
    description: "Search file contents through a shared warm fff-mcp index. Multiple patterns use OR semantics; literal matching is the safe default and regex matching must be selected explicitly.",
    inputSchema: grepInputSchema,
    outputSchema: grepResultJsonSchema
  }
];
function invalid2(message) {
  return { ok: false, error: { code: "INVALID_REQUEST", message } };
}
function formatValidationError(error) {
  return error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "request"}: ${issue.message}`).join("; ");
}
function normalizeWithin(value, env) {
  const values = Array.isArray(value) ? value : [value];
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of values) {
    const expanded = expandHomePath(entry.trim(), env);
    if (!expanded.ok) return invalid2(expanded.error.message);
    if (!path2.isAbsolute(expanded.value)) {
      return invalid2("within paths must be absolute on the daemon wire protocol");
    }
    const clean = path2.normalize(expanded.value);
    if (seen.has(clean)) return invalid2(`within contains duplicate path '${clean}'`);
    seen.add(clean);
    normalized.push(clean);
  }
  return { ok: true, value: normalized };
}
function rejectWildcardOnlyRegex(patterns, literal) {
  if (literal) return { ok: true, value: void 0 };
  const wildcardOnly = /^(?:[.^$]*(?:[.][*+?]|[*+])[.^$]*|[.^$\s]*|\.\*[+?]?|\.\+[?]?|[.*?])$/;
  const rejected = patterns.find((pattern) => wildcardOnly.test(pattern.trim()));
  return rejected ? invalid2(`regex '${rejected}' matches everything; provide a concrete expression`) : { ok: true, value: void 0 };
}
function normalizePublicToolInput(tool, input, env = process.env) {
  const parsed = tool === "find_files" ? findFilesInputSchema.safeParse(input) : grepInputSchema.safeParse(input);
  if (!parsed.success) return invalid2(formatValidationError(parsed.error));
  const resolvedWithin = normalizeWithin(parsed.data.within, env);
  if (!resolvedWithin.ok) return resolvedWithin;
  const common = {
    within: resolvedWithin.value,
    ...parsed.data.glob ? { glob: parsed.data.glob } : {},
    extensions: parsed.data.extensions,
    excludePaths: parsed.data.excludePaths,
    limit: parsed.data.limit,
    cursor: parsed.data.cursor
  };
  if (tool === "find_files") {
    const data2 = parsed.data;
    const request2 = { tool, query: data2.query, ...common };
    return { ok: true, value: request2 };
  }
  const data = parsed.data;
  const concreteRegex = rejectWildcardOnlyRegex(data.patterns, data.literal);
  if (!concreteRegex.ok) return concreteRegex;
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
  ProtocolValidationError,
  evictResultJsonSchema,
  evictResultSchema,
  findFilesInputSchema,
  findFilesResultJsonSchema,
  findFilesResultSchema,
  grepInputSchema,
  grepResultJsonSchema,
  grepResultSchema,
  normalizePublicToolInput,
  publicToolResultSchema,
  routerStatusJsonSchema,
  routerStatusSchema,
  warmResultJsonSchema,
  warmResultSchema,
  workerDiagnosticJsonSchema
};
