import path from "node:path";
import { type TSchema, Type } from "@sinclair/typebox";
import { expandHomePath } from "./home-path";
import type {
  PublicError,
  PublicErrorCode,
  PublicFindFilesRequest,
  PublicGrepRequest,
  PublicOutputMode,
  PublicSearchTermsRequest,
  PublicToolDefinition,
  PublicToolName,
  PublicToolRequest,
  Result,
} from "./types";

const EXTENSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const PATH_META_PATTERN = /[*?[\]{}!]/;
const DEFAULT_LIMIT = 20;
const DEFAULT_CONTEXT_LINES = 0;

const outputModeSchema = Type.Union([Type.Literal("compact"), Type.Literal("json")]);

const cursorSchema = Type.Null();

export const ENABLE_SEARCH_TERMS = false;

function defineTool(
  name: PublicToolName,
  description: string,
  snippet: string,
  inputSchema: TSchema,
): PublicToolDefinition<TSchema> {
  return { name, description, snippet, inputSchema };
}

function invalid(
  message: string,
  code: PublicErrorCode = "INVALID_REQUEST",
): Result<never, PublicError> {
  return {
    ok: false,
    error: { code, message },
  };
}

function containsPathMeta(value: string): boolean {
  return PATH_META_PATTERN.test(value);
}

function parseRequiredString(value: unknown, field: string): Result<string, PublicError> {
  if (typeof value !== "string" || value.trim() === "") {
    return invalid(`${field} must be a non-empty string`);
  }

  return { ok: true, value };
}

function parseOptionalNonNegativeInt(
  value: unknown,
  field: string,
  defaultValue: number,
): Result<number, PublicError> {
  if (value === undefined) {
    return { ok: true, value: defaultValue };
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return invalid(`${field} must be a non-negative integer`);
  }

  return { ok: true, value };
}

export function normalizeWithin(
  value: unknown,
  env: NodeJS.ProcessEnv = process.env,
): Result<string | undefined, PublicError> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }

  if (typeof value !== "string" || value.trim() === "") {
    return invalid("within must be a non-empty string when provided");
  }

  const expanded = expandHomePath(value, env);
  if (!expanded.ok) {
    return expanded;
  }

  if (!path.isAbsolute(expanded.value)) {
    return invalid("within must be absolute for direct MCP callers");
  }

  return { ok: true, value: expanded.value };
}

/**
 * Resolve the `within` field of a public request into either a single
 * absolute path or a multi-path array. Accepts `string | string[]` but
 * treats a single-element array as the single-path form so callers don't
 * accidentally go through the multi-path code path just because they
 * happened to wrap a scalar. Array of length 0 is rejected — `within`
 * must either be omitted or supply ≥ 1 usable path.
 */
export function normalizeWithinOrWithinPaths(
  value: unknown,
  env: NodeJS.ProcessEnv = process.env,
): Result<{ within?: string; withinPaths?: string[] }, PublicError> {
  if (value === undefined) {
    return { ok: true, value: {} };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return invalid("within must not be an empty array when provided");
    }

    const resolved: string[] = [];
    for (const entry of value) {
      const result = normalizeWithin(entry, env);
      if (!result.ok) {
        return result;
      }
      if (result.value === undefined) {
        return invalid("within array must contain only non-empty strings");
      }
      resolved.push(result.value);
    }

    if (resolved.length === 1) {
      return { ok: true, value: { within: resolved[0] } };
    }

    // Reject trivially-duplicate entries so the downstream constraint
    // compiler doesn't emit `{foo,foo}` and callers notice the typo.
    const seen = new Set<string>();
    for (const entry of resolved) {
      if (seen.has(entry)) {
        return invalid(`within contains duplicate path '${entry}'`);
      }
      seen.add(entry);
    }

    return { ok: true, value: { withinPaths: resolved } };
  }

  const single = normalizeWithin(value, env);
  if (!single.ok) {
    return single;
  }
  return { ok: true, value: single.value === undefined ? {} : { within: single.value } };
}

export function normalizeExtensions(input: unknown): Result<string[], PublicError> {
  if (input === undefined) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(input)) {
    return invalid("extensions must be an array of strings");
  }

  const normalized: string[] = [];
  for (const entry of input) {
    if (typeof entry !== "string") {
      return invalid("extensions must contain only strings");
    }

    const clean = entry.trim().replace(/^\./, "");
    if (!clean) {
      return invalid("extensions must not contain empty values");
    }

    if (
      clean.includes("/") ||
      clean.includes("\\") ||
      containsPathMeta(clean) ||
      !EXTENSION_PATTERN.test(clean)
    ) {
      return invalid("extensions must be literal suffixes without path syntax");
    }

    normalized.push(clean);
  }

  return { ok: true, value: normalized };
}

function normalizeGlobPattern(value: string): Result<string, PublicError> {
  const trimmed = value.trim().replace(/\\/g, "/");
  if (!trimmed) {
    return invalid("glob must not be empty");
  }

  if (path.isAbsolute(trimmed)) {
    return invalid("glob must be relative to the resolved base path");
  }

  if (trimmed.startsWith("!")) {
    return invalid("glob must be an include pattern; use exclude_paths for exclusions");
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment === "" || segment === ".")) {
    return invalid("glob must not contain empty or current-directory segments");
  }

  if (segments.includes("..")) {
    return invalid("glob must not escape the resolved base path");
  }

  return { ok: true, value: trimmed };
}

export function normalizeGlob(input: unknown): Result<string | undefined, PublicError> {
  if (input === undefined) {
    return { ok: true, value: undefined };
  }

  if (typeof input !== "string") {
    return invalid("glob must be a string when provided");
  }

  return normalizeGlobPattern(input);
}

function normalizeExcludePath(entry: string): Result<string, PublicError> {
  const trimmed = entry.trim().replace(/\\/g, "/");
  if (!trimmed) {
    return invalid("exclude_paths must not contain empty values");
  }

  if (path.isAbsolute(trimmed)) {
    return invalid("exclude_paths must be relative to the resolved base path");
  }

  if (containsPathMeta(trimmed)) {
    return invalid("exclude_paths must be literal descendant paths");
  }

  const segments = trimmed.split("/");
  if (segments.some((segment) => segment === "" || segment === ".")) {
    return invalid("exclude_paths must not contain empty or current-directory segments");
  }

  if (segments.includes("..")) {
    return invalid("exclude_paths must not escape the resolved base path");
  }

  return { ok: true, value: segments.join("/") };
}

export function normalizeExcludePaths(input: unknown): Result<string[], PublicError> {
  if (input === undefined) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(input)) {
    return invalid("exclude_paths must be an array of strings");
  }

  const normalized: string[] = [];
  for (const entry of input) {
    if (typeof entry !== "string") {
      return invalid("exclude_paths must contain only strings");
    }

    const excludePath = normalizeExcludePath(entry);
    if (!excludePath.ok) {
      return excludePath;
    }

    normalized.push(excludePath.value);
  }

  return { ok: true, value: normalized };
}

export function normalizeCursor(value: unknown): Result<null, PublicError> {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  return invalid("cursor must be omitted or null in the initial V2 slice");
}

export function normalizeTerms(value: unknown): Result<string[], PublicError> {
  if (!Array.isArray(value) || value.length === 0) {
    return invalid("terms must contain at least one string");
  }

  const terms: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      return invalid("terms must contain only non-empty strings");
    }

    terms.push(entry);
  }

  return { ok: true, value: terms };
}

export function normalizePatterns(value: unknown): Result<string[], PublicError> {
  if (!Array.isArray(value) || value.length === 0) {
    return invalid("patterns must contain at least one string");
  }

  const patterns: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      return invalid("patterns must contain only non-empty strings");
    }

    patterns.push(entry);
  }

  return { ok: true, value: patterns };
}

function schemaFieldNames(schema: TSchema): string[] {
  const properties = (schema as { properties?: Record<string, unknown> }).properties;
  return Object.keys(properties ?? {});
}

function rejectUnknownFields(
  input: Record<string, unknown>,
  schema: TSchema,
): Result<true, PublicError> {
  const allowed = new Set(schemaFieldNames(schema));

  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) {
      return invalid(`unknown field '${field}'`);
    }
  }

  return { ok: true, value: true };
}

/**
 * `within` accepts either a single absolute path or an array of absolute
 * paths (length ≥ 1). The multi-path form compiles to a single brace-expanded
 * constraint at the backend, so all entries must live under the same routing
 * target (git root or allowlisted prefix); the coordinator enforces that.
 */
const withinSchema = Type.Union([
  Type.String({ minLength: 1 }),
  Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
]);

export const findFilesInputSchema = Type.Object(
  {
    query: Type.String({ minLength: 1 }),
    within: Type.Optional(withinSchema),
    glob: Type.Optional(Type.String({ minLength: 1 })),
    extensions: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    exclude_paths: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    limit: Type.Optional(Type.Integer({ minimum: 0 })),
    cursor: Type.Optional(cursorSchema),
    output_mode: Type.Optional(outputModeSchema),
  },
  { additionalProperties: false },
);

export const searchTermsInputSchema = Type.Object(
  {
    terms: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    within: Type.Optional(withinSchema),
    glob: Type.Optional(Type.String({ minLength: 1 })),
    extensions: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    exclude_paths: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    context_lines: Type.Optional(Type.Integer({ minimum: 0 })),
    limit: Type.Optional(Type.Integer({ minimum: 0 })),
    cursor: Type.Optional(cursorSchema),
    output_mode: Type.Optional(outputModeSchema),
  },
  { additionalProperties: false },
);

export const grepInputSchema = Type.Object(
  {
    patterns: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    literal: Type.Boolean({
      description:
        "Required. If true, patterns are matched as literal text (safe for code, quotes, whitespace, and regex metacharacters). If false, patterns are regex. This tool does not guess; set it explicitly.",
    }),
    within: Type.Optional(withinSchema),
    glob: Type.Optional(Type.String({ minLength: 1 })),
    case_sensitive: Type.Optional(Type.Boolean()),
    extensions: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    exclude_paths: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    context_lines: Type.Optional(Type.Integer({ minimum: 0 })),
    limit: Type.Optional(Type.Integer({ minimum: 0 })),
    cursor: Type.Optional(cursorSchema),
    output_mode: Type.Optional(outputModeSchema),
  },
  { additionalProperties: false },
);

export const PUBLIC_TOOL_DEFINITIONS = [
  defineTool(
    "fff_find_files",
    "Fuzzy file search by name/path under an already-resolved within scope. Use it when you are exploring a topic or looking for files, not when you already have a specific code identifier. Keep queries short and let glob, extensions, and exclude_paths do the path narrowing.",
    '{"query":"openssl header","within":"/opt/homebrew/lib","glob":"**/*.h","exclude_paths":["pkgconfig"]}',
    findFilesInputSchema,
  ),
  ...(ENABLE_SEARCH_TERMS
    ? [
        defineTool(
          "fff_search_terms",
          "Search for one or more literal terms under an already-resolved within scope (absolute or HOME-based).",
          '{"terms":["router","coordinator"],"within":"$HOME/.config"}',
          searchTermsInputSchema,
        ),
      ]
    : []),
  defineTool(
    "fff_grep",
    "Search file contents under an already-resolved within scope. `literal` is REQUIRED: set literal=true for identifier searches, code fragments, or any string containing whitespace, quotes, or punctuation where regex interpretation is unwanted; set literal=false only when you need regex features (anchors, character classes, quantifiers, alternation). This tool does not guess. Use `patterns` for one or more terms; multiple entries use OR semantics. Use `glob` / `extensions` / `exclude_paths` to prefilter files aggressively.",
    '{"patterns":["ActorAuth","actor_auth","PopulatedActorAuth"],"literal":true,"within":"src","extensions":["rs"],"exclude_paths":["tests"]}',
    grepInputSchema,
  ),
] as const;

export function createPublicError(code: PublicErrorCode, message: string): PublicError {
  return { code, message };
}

export function publicErrorResult(
  code: PublicErrorCode,
  message: string,
): Result<never, PublicError> {
  return {
    ok: false,
    error: createPublicError(code, message),
  };
}

export function parsePublicOutputMode(value: unknown): Result<PublicOutputMode, PublicError> {
  if (value === undefined) {
    return { ok: true, value: "compact" };
  }

  if (value === "compact" || value === "json") {
    return { ok: true, value };
  }

  return invalid("output_mode must be one of: compact, json");
}

export function isCompactOutputMode(mode: PublicOutputMode): mode is "compact" {
  return mode === "compact";
}

export function isJsonOutputMode(mode: PublicOutputMode): mode is "json" {
  return mode === "json";
}

function normalizeFindFilesInput(
  input: Record<string, unknown>,
): Result<PublicFindFilesRequest, PublicError> {
  const knownFields = rejectUnknownFields(input, findFilesInputSchema);
  if (!knownFields.ok) {
    return knownFields;
  }

  const query = parseRequiredString(input.query, "query");
  if (!query.ok) {
    return query;
  }

  const within = normalizeWithinOrWithinPaths(input.within);
  if (!within.ok) {
    return within;
  }

  const glob = normalizeGlob(input.glob);
  if (!glob.ok) {
    return glob;
  }

  const extensions = normalizeExtensions(input.extensions);
  if (!extensions.ok) {
    return extensions;
  }

  const excludePaths = normalizeExcludePaths(input.exclude_paths);
  if (!excludePaths.ok) {
    return excludePaths;
  }

  const limit = parseOptionalNonNegativeInt(input.limit, "limit", DEFAULT_LIMIT);
  if (!limit.ok) {
    return limit;
  }

  const cursor = normalizeCursor(input.cursor);
  if (!cursor.ok) {
    return cursor;
  }

  const outputMode = parsePublicOutputMode(input.output_mode);
  if (!outputMode.ok) {
    return outputMode;
  }

  const value: PublicFindFilesRequest = {
    tool: "fff_find_files",
    query: query.value,
    ...(within.value.within !== undefined ? { within: within.value.within } : {}),
    ...(within.value.withinPaths !== undefined ? { withinPaths: within.value.withinPaths } : {}),
    ...(glob.value !== undefined ? { glob: glob.value } : {}),
    extensions: extensions.value,
    excludePaths: excludePaths.value,
    limit: limit.value,
    cursor: cursor.value,
    outputMode: outputMode.value,
  };

  return {
    ok: true,
    value,
  };
}

function normalizeSearchTermsInput(
  input: Record<string, unknown>,
): Result<PublicSearchTermsRequest, PublicError> {
  const knownFields = rejectUnknownFields(input, searchTermsInputSchema);
  if (!knownFields.ok) {
    return knownFields;
  }

  const terms = normalizeTerms(input.terms);
  if (!terms.ok) {
    return terms;
  }

  const within = normalizeWithinOrWithinPaths(input.within);
  if (!within.ok) {
    return within;
  }

  const glob = normalizeGlob(input.glob);
  if (!glob.ok) {
    return glob;
  }

  const extensions = normalizeExtensions(input.extensions);
  if (!extensions.ok) {
    return extensions;
  }

  const excludePaths = normalizeExcludePaths(input.exclude_paths);
  if (!excludePaths.ok) {
    return excludePaths;
  }

  const contextLines = parseOptionalNonNegativeInt(
    input.context_lines,
    "context_lines",
    DEFAULT_CONTEXT_LINES,
  );
  if (!contextLines.ok) {
    return contextLines;
  }

  const limit = parseOptionalNonNegativeInt(input.limit, "limit", DEFAULT_LIMIT);
  if (!limit.ok) {
    return limit;
  }

  const cursor = normalizeCursor(input.cursor);
  if (!cursor.ok) {
    return cursor;
  }

  const outputMode = parsePublicOutputMode(input.output_mode);
  if (!outputMode.ok) {
    return outputMode;
  }

  const value: PublicSearchTermsRequest = {
    tool: "fff_search_terms",
    terms: terms.value,
    ...(within.value.within !== undefined ? { within: within.value.within } : {}),
    ...(within.value.withinPaths !== undefined ? { withinPaths: within.value.withinPaths } : {}),
    ...(glob.value !== undefined ? { glob: glob.value } : {}),
    extensions: extensions.value,
    excludePaths: excludePaths.value,
    contextLines: contextLines.value,
    limit: limit.value,
    cursor: cursor.value,
    outputMode: outputMode.value,
  };

  return {
    ok: true,
    value,
  };
}

function normalizeGrepInput(
  input: Record<string, unknown>,
): Result<PublicGrepRequest, PublicError> {
  const knownFields = rejectUnknownFields(input, grepInputSchema);
  if (!knownFields.ok) {
    return knownFields;
  }

  const patterns = normalizePatterns(input.patterns);
  if (!patterns.ok) {
    return patterns;
  }

  if (typeof input.literal !== "boolean") {
    return invalid(
      "literal must be explicitly set to true or false; fff_grep does not guess between regex and literal interpretation",
    );
  }

  const within = normalizeWithinOrWithinPaths(input.within);
  if (!within.ok) {
    return within;
  }

  const glob = normalizeGlob(input.glob);
  if (!glob.ok) {
    return glob;
  }

  if (input.case_sensitive !== undefined && typeof input.case_sensitive !== "boolean") {
    return invalid("case_sensitive must be a boolean when provided");
  }

  const extensions = normalizeExtensions(input.extensions);
  if (!extensions.ok) {
    return extensions;
  }

  const excludePaths = normalizeExcludePaths(input.exclude_paths);
  if (!excludePaths.ok) {
    return excludePaths;
  }

  const contextLines = parseOptionalNonNegativeInt(
    input.context_lines,
    "context_lines",
    DEFAULT_CONTEXT_LINES,
  );
  if (!contextLines.ok) {
    return contextLines;
  }

  const limit = parseOptionalNonNegativeInt(input.limit, "limit", DEFAULT_LIMIT);
  if (!limit.ok) {
    return limit;
  }

  const cursor = normalizeCursor(input.cursor);
  if (!cursor.ok) {
    return cursor;
  }

  const outputMode = parsePublicOutputMode(input.output_mode);
  if (!outputMode.ok) {
    return outputMode;
  }

  const value: PublicGrepRequest = {
    tool: "fff_grep",
    patterns: patterns.value,
    literal: input.literal,
    ...(within.value.within !== undefined ? { within: within.value.within } : {}),
    ...(within.value.withinPaths !== undefined ? { withinPaths: within.value.withinPaths } : {}),
    ...(glob.value !== undefined ? { glob: glob.value } : {}),
    caseSensitive: input.case_sensitive ?? false,
    extensions: extensions.value,
    excludePaths: excludePaths.value,
    contextLines: contextLines.value,
    limit: limit.value,
    cursor: cursor.value,
    outputMode: outputMode.value,
  };

  return {
    ok: true,
    value,
  };
}

export function normalizePublicToolInput(
  tool: PublicToolName,
  input: unknown,
): Result<PublicToolRequest, PublicError> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return invalid("request must be an object");
  }

  const record = input as Record<string, unknown>;

  switch (tool) {
    case "fff_find_files":
      return normalizeFindFilesInput(record);
    case "fff_search_terms":
      if (!ENABLE_SEARCH_TERMS) {
        return invalid("fff_search_terms is disabled; use fff_grep with patterns instead");
      }
      return normalizeSearchTermsInput(record);
    case "fff_grep":
      return normalizeGrepInput(record);
  }
}
