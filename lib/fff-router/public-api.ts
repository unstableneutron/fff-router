import path from "node:path";
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

export type JsonSchema = {
  $schema?: string;
  type?: string | string[];
  [key: string]: unknown;
};

export type ValidationIssue = {
  path: Array<string | number>;
  message: string;
};

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: ValidationIssue[] } };

export class ProtocolValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`).join("; "));
  }
}

export type RuntimeSchema<T> = JsonSchema & {
  readonly jsonSchema: JsonSchema;
  safeParse(value: unknown): ValidationResult<T>;
  parse(value: unknown): T;
};

function runtimeSchema<T>(
  jsonSchema: JsonSchema,
  validate: (value: unknown) => ValidationResult<T>,
): RuntimeSchema<T> {
  const schema = { ...jsonSchema } as RuntimeSchema<T>;
  Object.defineProperties(schema, {
    // Runtime helpers must not leak into tools/list JSON Schema or create a
    // self-reference when the response is serialized.
    jsonSchema: { value: schema, enumerable: false },
    safeParse: { value: validate, enumerable: false },
    parse: {
      enumerable: false,
      value(value: unknown): T {
        const result = validate(value);
        if (!result.success) {
          throw new ProtocolValidationError(result.error.issues);
        }
        return result.data;
      },
    },
  });
  return schema;
}

function valid<T>(data: T): ValidationResult<T> {
  return { success: true, data };
}

function invalidValue<T>(pathValue: Array<string | number>, message: string): ValidationResult<T> {
  return { success: false, error: { issues: [{ path: pathValue, message }] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
): ValidationResult<void> {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  return unknown ? invalidValue([unknown], "unknown field") : valid(undefined);
}

function readBoundedString(
  value: unknown,
  field: string,
  options: { max: number; trim?: boolean; allowBlank?: boolean },
): ValidationResult<string> {
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

function readStringArray(
  value: unknown,
  field: string,
  options: { maxItems: number; maxLength: number; minItems?: number },
): ValidationResult<string[]> {
  if (!Array.isArray(value)) {
    return invalidValue([field], "must be an array");
  }
  if (value.length < (options.minItems ?? 0)) {
    return invalidValue([field], `must contain at least ${options.minItems ?? 0} item(s)`);
  }
  if (value.length > options.maxItems) {
    return invalidValue([field], `must contain at most ${options.maxItems} item(s)`);
  }
  const output: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const parsed = readBoundedString(value[index], `${field}.${index}`, {
      max: options.maxLength,
      trim: true,
    });
    if (!parsed.success) {
      return parsed;
    }
    output.push(parsed.data);
  }
  return valid(output);
}

function readWithinInput(value: unknown): ValidationResult<string | string[]> {
  if (typeof value === "string") {
    return readBoundedString(value, "within", { max: 4_096, trim: true });
  }
  return readStringArray(value, "within", {
    minItems: 1,
    maxItems: MAX_WITHIN_PATHS,
    maxLength: 4_096,
  });
}

function normalizeRelativeFilter(value: string, field: string): ValidationResult<string> {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (path.posix.isAbsolute(normalized)) {
    return invalidValue([field], "path filters must be relative");
  }
  if (
    normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    return invalidValue(
      [field],
      "path filters must not contain empty, current-directory, or parent-directory segments",
    );
  }
  return valid(normalized);
}

function readRelativeFilters(value: unknown, field: string): ValidationResult<string[]> {
  if (value === undefined) {
    return valid([]);
  }
  const values = readStringArray(value, field, { maxItems: MAX_FILTERS, maxLength: 512 });
  if (!values.success) {
    return values;
  }
  const normalized: string[] = [];
  for (let index = 0; index < values.data.length; index += 1) {
    const parsed = normalizeRelativeFilter(values.data[index]!, `${field}.${index}`);
    if (!parsed.success) {
      return parsed;
    }
    normalized.push(parsed.data);
  }
  return valid([...new Set(normalized)]);
}

function readExtensions(value: unknown): ValidationResult<string[]> {
  if (value === undefined) {
    return valid([]);
  }
  const values = readStringArray(value, "extensions", {
    maxItems: MAX_FILTERS,
    maxLength: 64,
  });
  if (!values.success) {
    return values;
  }
  const normalized: string[] = [];
  for (let index = 0; index < values.data.length; index += 1) {
    const extension = values.data[index]!.replace(/^\./, "");
    if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(extension)) {
      return invalidValue(
        ["extensions", index],
        "extensions must be literal suffixes without path or glob syntax",
      );
    }
    normalized.push(extension);
  }
  return valid([...new Set(normalized)]);
}

function readInteger(
  value: unknown,
  field: string,
  options: { min: number; max: number; fallback: number },
): ValidationResult<number> {
  if (value === undefined) {
    return valid(options.fallback);
  }
  if (
    !Number.isInteger(value) ||
    (value as number) < options.min ||
    (value as number) > options.max
  ) {
    return invalidValue([field], `must be an integer between ${options.min} and ${options.max}`);
  }
  return valid(value as number);
}

function readCursor(value: unknown): ValidationResult<string | null> {
  if (value === undefined || value === null) {
    return valid(null);
  }
  return readBoundedString(value, "cursor", { max: 4_096, trim: false });
}

export type FindFilesInput = {
  query: string;
  within: string | string[];
  glob?: string;
  extensions?: string[];
  excludePaths?: string[];
  limit?: number;
  cursor?: string | null;
};

export type GrepInput = {
  patterns: string[];
  literal?: boolean;
  contextLines?: number;
  within: string | string[];
  glob?: string;
  extensions?: string[];
  excludePaths?: string[];
  limit?: number;
  cursor?: string | null;
};

type ParsedCommonInput = {
  within: string | string[];
  glob?: string;
  extensions: string[];
  excludePaths: string[];
  limit: number;
  cursor: string | null;
};

type ParsedFindFilesInput = ParsedCommonInput & { query: string };
type ParsedGrepInput = ParsedCommonInput & {
  patterns: string[];
  literal: boolean;
  contextLines: number;
};

const JSON_SCHEMA_2020_12 = "https://json-schema.org/draft/2020-12/schema";
const withinJsonSchema = {
  oneOf: [
    { type: "string", minLength: 1, maxLength: 4_096 },
    {
      type: "array",
      minItems: 1,
      maxItems: MAX_WITHIN_PATHS,
      items: { type: "string", minLength: 1, maxLength: 4_096 },
    },
  ],
};
const commonJsonSchemaProperties = {
  within: withinJsonSchema,
  glob: { type: "string", minLength: 1, maxLength: 512 },
  extensions: {
    type: "array",
    maxItems: MAX_FILTERS,
    items: { type: "string", minLength: 1, maxLength: 64 },
    default: [],
  },
  excludePaths: {
    type: "array",
    maxItems: MAX_FILTERS,
    items: { type: "string", minLength: 1, maxLength: 512 },
    default: [],
  },
  limit: { type: "integer", minimum: 1, maximum: MAX_RESULTS, default: 20 },
  cursor: { type: ["string", "null"], minLength: 1, maxLength: 4_096, default: null },
};

function parseCommonInput(record: Record<string, unknown>): ValidationResult<ParsedCommonInput> {
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
  let globValue: string | undefined;
  if (record.glob !== undefined) {
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
    ...(globValue ? { glob: globValue } : {}),
    extensions: extensions.data,
    excludePaths: excludePaths.data,
    limit: limit.data,
    cursor: cursor.data,
  });
}

function parseFindFilesInput(value: unknown): ValidationResult<ParsedFindFilesInput> {
  if (!isRecord(value)) return invalidValue([], "request must be an object");
  const known = rejectUnknownFields(value, [
    "query",
    "within",
    "glob",
    "extensions",
    "excludePaths",
    "limit",
    "cursor",
  ]);
  if (!known.success) return known;
  const query = readBoundedString(value.query, "query", { max: MAX_QUERY_LENGTH, trim: true });
  if (!query.success) return query;
  const common = parseCommonInput(value);
  return common.success ? valid({ query: query.data, ...common.data }) : common;
}

function parseGrepInput(value: unknown): ValidationResult<ParsedGrepInput> {
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
    "cursor",
  ]);
  if (!known.success) return known;
  const patterns = readStringArray(value.patterns, "patterns", {
    minItems: 1,
    maxItems: MAX_PATTERNS,
    maxLength: MAX_QUERY_LENGTH,
  });
  if (!patterns.success) return patterns;
  if (value.literal !== undefined && typeof value.literal !== "boolean") {
    return invalidValue(["literal"], "must be a boolean");
  }
  const contextLines = readInteger(value.contextLines, "contextLines", {
    min: 0,
    max: MAX_CONTEXT_LINES,
    fallback: 0,
  });
  if (!contextLines.success) return contextLines;
  const common = parseCommonInput(value);
  if (!common.success) return common;
  return valid({
    patterns: patterns.data,
    literal: value.literal === undefined ? true : value.literal,
    contextLines: contextLines.data,
    ...common.data,
  });
}

export const findFilesInputSchema = runtimeSchema<ParsedFindFilesInput>(
  {
    $schema: JSON_SCHEMA_2020_12,
    type: "object",
    additionalProperties: false,
    required: ["query", "within"],
    properties: {
      query: { type: "string", minLength: 1, maxLength: MAX_QUERY_LENGTH },
      ...commonJsonSchemaProperties,
    },
  },
  parseFindFilesInput,
);

export const grepInputSchema = runtimeSchema<ParsedGrepInput>(
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
        items: { type: "string", minLength: 1, maxLength: MAX_QUERY_LENGTH },
      },
      literal: { type: "boolean", default: true },
      contextLines: {
        type: "integer",
        minimum: 0,
        maximum: MAX_CONTEXT_LINES,
        default: 0,
      },
      ...commonJsonSchemaProperties,
    },
  },
  parseGrepInput,
);

const fileHitJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "absolutePath"],
  properties: { path: { type: "string" }, absolutePath: { type: "string" } },
};

const textHitJsonSchema = {
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
    definitionBody: { type: "array", items: { type: "string" } },
  },
};

const searchResultStatsJsonSchema = {
  type: "object",
  required: ["resultCount", "coldStart", "workerId", "workerGeneration"],
  properties: {
    resultCount: { type: "integer", minimum: 0 },
    upstreamShownCount: { type: "integer", minimum: 0 },
    upstreamTotalCount: { type: "integer", minimum: 0 },
    coldStart: { type: "boolean" },
    workerId: { type: "string", minLength: 1 },
    workerGeneration: { type: "integer", minimum: 1 },
  },
};

function validateFileHit(
  value: unknown,
  pathPrefix: Array<string | number>,
): ValidationResult<void> {
  if (!isRecord(value)) return invalidValue(pathPrefix, "must be an object");
  if (typeof value.path !== "string")
    return invalidValue([...pathPrefix, "path"], "must be a string");
  if (typeof value.absolutePath !== "string") {
    return invalidValue([...pathPrefix, "absolutePath"], "must be a string");
  }
  return valid(undefined);
}

function validateStats(value: unknown): ValidationResult<void> {
  if (!isRecord(value)) return invalidValue(["stats"], "must be an object");
  if (!Number.isInteger(value.resultCount) || (value.resultCount as number) < 0) {
    return invalidValue(["stats", "resultCount"], "must be a non-negative integer");
  }
  if (typeof value.coldStart !== "boolean")
    return invalidValue(["stats", "coldStart"], "must be a boolean");
  if (typeof value.workerId !== "string" || value.workerId.length === 0) {
    return invalidValue(["stats", "workerId"], "must be a non-empty string");
  }
  if (!Number.isInteger(value.workerGeneration) || (value.workerGeneration as number) < 1) {
    return invalidValue(["stats", "workerGeneration"], "must be a positive integer");
  }
  return valid(undefined);
}

function validateSearchResultBase(
  value: unknown,
  expectedTool: PublicToolName,
): ValidationResult<Record<string, unknown>> {
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

export const findFilesResultJsonSchema: JsonSchema = {
  $schema: JSON_SCHEMA_2020_12,
  type: "object",
  required: ["tool", "root", "backend", "items", "nextCursor", "stats"],
  properties: {
    tool: { const: "find_files" },
    root: { type: "string" },
    backend: { const: "fff-mcp" },
    items: { type: "array", items: fileHitJsonSchema },
    nextCursor: { type: ["string", "null"] },
    stats: searchResultStatsJsonSchema,
  },
};

export const grepResultJsonSchema: JsonSchema = {
  $schema: JSON_SCHEMA_2020_12,
  type: "object",
  required: ["tool", "root", "backend", "items", "nextCursor", "stats"],
  properties: {
    tool: { const: "grep" },
    root: { type: "string" },
    backend: { const: "fff-mcp" },
    items: { type: "array", items: textHitJsonSchema },
    nextCursor: { type: ["string", "null"] },
    stats: searchResultStatsJsonSchema,
  },
};

export const findFilesResultSchema = runtimeSchema<FindFilesResult>(
  findFilesResultJsonSchema,
  (value) => {
    const base = validateSearchResultBase(value, "find_files");
    if (!base.success) return base;
    const items = base.data.items as unknown[];
    for (let index = 0; index < items.length; index += 1) {
      const item = validateFileHit(items[index], ["items", index]);
      if (!item.success) return item;
    }
    return valid(value as FindFilesResult);
  },
);

export const grepResultSchema = runtimeSchema<GrepResult>(grepResultJsonSchema, (value) => {
  const base = validateSearchResultBase(value, "grep");
  if (!base.success) return base;
  const items = base.data.items as unknown[];
  for (let index = 0; index < items.length; index += 1) {
    const item = validateFileHit(items[index], ["items", index]);
    if (!item.success) return item;
    const record = items[index] as Record<string, unknown>;
    if (!Number.isInteger(record.line) || (record.line as number) < 1) {
      return invalidValue(["items", index, "line"], "must be a positive integer");
    }
    if (typeof record.text !== "string") {
      return invalidValue(["items", index, "text"], "must be a string");
    }
  }
  return valid(value as GrepResult);
});

export const publicToolResultSchema = runtimeSchema<PublicToolResult>(
  { oneOf: [findFilesResultJsonSchema, grepResultJsonSchema] },
  (value) =>
    isRecord(value) && value.tool === "find_files"
      ? findFilesResultSchema.safeParse(value)
      : grepResultSchema.safeParse(value),
);

function validateWorkerDiagnostic(value: unknown, index: number): ValidationResult<void> {
  if (!isRecord(value)) return invalidValue(["workers", index], "must be an object");
  if (typeof value.root !== "string")
    return invalidValue(["workers", index, "root"], "must be a string");
  if (value.rootType !== "git" && value.rootType !== "non-git") {
    return invalidValue(["workers", index, "rootType"], "must be 'git' or 'non-git'");
  }
  if (!["starting", "ready", "draining", "dead"].includes(String(value.state))) {
    return invalidValue(["workers", index, "state"], "invalid worker state");
  }
  if (!Number.isInteger(value.generation) || (value.generation as number) < 1) {
    return invalidValue(["workers", index, "generation"], "must be a positive integer");
  }
  if (!Number.isInteger(value.activeLeases) || (value.activeLeases as number) < 0) {
    return invalidValue(["workers", index, "activeLeases"], "must be a non-negative integer");
  }
  return valid(undefined);
}

export const workerDiagnosticJsonSchema: JsonSchema = {
  type: "object",
  required: [
    "root",
    "rootType",
    "state",
    "generation",
    "activeLeases",
    "lastUsedAt",
    "failureCount",
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
        processCount: { type: "integer", minimum: 1 },
      },
    },
    terminationReason: { type: "string" },
  },
};

export const routerStatusJsonSchema: JsonSchema = {
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
        maxTotalWorkerRssBytes: { type: "integer", minimum: 1 },
      },
    },
    resources: {
      type: "object",
      properties: {
        sampledAt: { type: "number", minimum: 0 },
        daemonRssBytes: { type: "integer", minimum: 0 },
        workerRssBytes: { type: "integer", minimum: 0 },
        totalRssBytes: { type: "integer", minimum: 0 },
        measuredWorkers: { type: "integer", minimum: 0 },
      },
    },
  },
};

export const routerStatusSchema = runtimeSchema<RouterStatus>(routerStatusJsonSchema, (value) => {
  if (!isRecord(value)) return invalidValue([], "status must be an object");
  if (!Array.isArray(value.workers)) return invalidValue(["workers"], "must be an array");
  for (let index = 0; index < value.workers.length; index += 1) {
    const worker = validateWorkerDiagnostic(value.workers[index], index);
    if (!worker.success) return worker;
  }
  if (!isRecord(value.limits)) return invalidValue(["limits"], "must be an object");
  if (!Number.isInteger(value.limits.maxWorkers) || (value.limits.maxWorkers as number) < 1) {
    return invalidValue(["limits", "maxWorkers"], "must be a positive integer");
  }
  if (
    !Number.isInteger(value.limits.maxNonGitWorkers) ||
    (value.limits.maxNonGitWorkers as number) < 0
  ) {
    return invalidValue(["limits", "maxNonGitWorkers"], "must be a non-negative integer");
  }
  return valid(value as RouterStatus);
});

export const warmResultJsonSchema: JsonSchema = {
  type: "object",
  required: ["workers"],
  properties: { workers: { type: "array", items: workerDiagnosticJsonSchema } },
};
export const warmResultSchema = runtimeSchema<{ workers: WorkerDiagnostic[] }>(
  warmResultJsonSchema,
  (value) => {
    if (!isRecord(value) || !Array.isArray(value.workers)) {
      return invalidValue(["workers"], "must be an array");
    }
    for (let index = 0; index < value.workers.length; index += 1) {
      const worker = validateWorkerDiagnostic(value.workers[index], index);
      if (!worker.success) return worker;
    }
    return valid(value as { workers: WorkerDiagnostic[] });
  },
);

export const evictResultJsonSchema: JsonSchema = {
  type: "object",
  required: ["evicted"],
  properties: { evicted: { type: "array", items: { type: "string" } } },
};
export const evictResultSchema = runtimeSchema<{ evicted: string[] }>(
  evictResultJsonSchema,
  (value) =>
    isRecord(value) &&
    Array.isArray(value.evicted) &&
    value.evicted.every((item) => typeof item === "string")
      ? valid(value as { evicted: string[] })
      : invalidValue(["evicted"], "must be an array of strings"),
);

export type PublicToolDefinition = {
  name: PublicToolName;
  description: string;
  inputSchema: RuntimeSchema<ParsedFindFilesInput> | RuntimeSchema<ParsedGrepInput>;
  outputSchema: JsonSchema;
};

export const PUBLIC_TOOL_DEFINITIONS: readonly PublicToolDefinition[] = [
  {
    name: "find_files",
    description:
      "Fuzzy-search file names and paths using a shared warm fff-mcp index. within must be one or more absolute paths under the same repository or configured non-Git root.",
    inputSchema: findFilesInputSchema,
    outputSchema: findFilesResultJsonSchema,
  },
  {
    name: "grep",
    description:
      "Search file contents through a shared warm fff-mcp index. Multiple patterns use OR semantics; literal matching is the safe default and regex matching must be selected explicitly.",
    inputSchema: grepInputSchema,
    outputSchema: grepResultJsonSchema,
  },
];

function invalid(message: string): Result<never, RouterError> {
  return { ok: false, error: { code: "INVALID_REQUEST", message } };
}

function formatValidationError(error: { issues: ValidationIssue[] }): string {
  return error.issues
    .map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "request"}: ${issue.message}`)
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
    if (!expanded.ok) return invalid(expanded.error.message);
    if (!path.isAbsolute(expanded.value)) {
      return invalid("within paths must be absolute on the daemon wire protocol");
    }
    const clean = path.normalize(expanded.value);
    if (seen.has(clean)) return invalid(`within contains duplicate path '${clean}'`);
    seen.add(clean);
    normalized.push(clean);
  }
  return { ok: true, value: normalized };
}

function rejectWildcardOnlyRegex(patterns: string[], literal: boolean): Result<void, RouterError> {
  if (literal) return { ok: true, value: undefined };
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
  const parsed =
    tool === "find_files"
      ? findFilesInputSchema.safeParse(input)
      : grepInputSchema.safeParse(input);
  if (!parsed.success) return invalid(formatValidationError(parsed.error));
  const resolvedWithin = normalizeWithin(parsed.data.within, env);
  if (!resolvedWithin.ok) return resolvedWithin;
  const common = {
    within: resolvedWithin.value,
    ...(parsed.data.glob ? { glob: parsed.data.glob } : {}),
    extensions: parsed.data.extensions,
    excludePaths: parsed.data.excludePaths,
    limit: parsed.data.limit,
    cursor: parsed.data.cursor,
  };
  if (tool === "find_files") {
    const data = parsed.data as ParsedFindFilesInput;
    const request: PublicFindFilesRequest = { tool, query: data.query, ...common };
    return { ok: true, value: request };
  }
  const data = parsed.data as ParsedGrepInput;
  const concreteRegex = rejectWildcardOnlyRegex(data.patterns, data.literal);
  if (!concreteRegex.ok) return concreteRegex;
  const request: PublicGrepRequest = {
    tool,
    patterns: [...new Set(data.patterns)],
    literal: data.literal,
    contextLines: data.contextLines,
    ...common,
  };
  return { ok: true, value: request };
}
