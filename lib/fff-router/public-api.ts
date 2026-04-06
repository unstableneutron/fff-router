import path from "node:path";
import { type TSchema, Type } from "@sinclair/typebox";
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

const outputModeSchema = Type.Union([
	Type.Literal("compact"),
	Type.Literal("json"),
]);

const cursorSchema = Type.Null();

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

function parseRequiredString(
	value: unknown,
	field: string,
): Result<string, PublicError> {
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
): Result<string | undefined, PublicError> {
	if (value === undefined) {
		return { ok: true, value: undefined };
	}

	if (typeof value !== "string" || value.trim() === "") {
		return invalid("within must be a non-empty string when provided");
	}

	const trimmed = value.trim();
	if (!path.isAbsolute(trimmed)) {
		return invalid("within must be absolute for direct MCP callers");
	}

	return { ok: true, value: trimmed };
}

export function normalizeExtensions(
	input: unknown,
): Result<string[], PublicError> {
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
		return invalid(
			"exclude_paths must not contain empty or current-directory segments",
		);
	}

	if (segments.includes("..")) {
		return invalid("exclude_paths must not escape the resolved base path");
	}

	return { ok: true, value: segments.join("/") };
}

export function normalizeExcludePaths(
	input: unknown,
): Result<string[], PublicError> {
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

function schemaFieldNames(schema: TSchema): string[] {
	const properties = (schema as { properties?: Record<string, unknown> })
		.properties;
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

function withWithin<T extends { within?: string }>(
	request: T,
	within: string | undefined,
): T {
	if (within === undefined) {
		return request;
	}

	return {
		...request,
		within,
	};
}

export const findFilesInputSchema = Type.Object(
	{
		query: Type.String({ minLength: 1 }),
		within: Type.Optional(Type.String({ minLength: 1 })),
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
		within: Type.Optional(Type.String({ minLength: 1 })),
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
		pattern: Type.String({ minLength: 1 }),
		within: Type.Optional(Type.String({ minLength: 1 })),
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
		"Find files by fuzzy name/path under an already-resolved within scope.",
		'{"query":"router","within":"/absolute/path"}',
		findFilesInputSchema,
	),
	defineTool(
		"fff_search_terms",
		"Search for one or more literal terms under an already-resolved within scope.",
		'{"terms":["router","coordinator"],"within":"/absolute/path"}',
		searchTermsInputSchema,
	),
	defineTool(
		"fff_grep",
		"Run structured grep under an already-resolved within scope.",
		'{"pattern":"plan(Request)?","within":"/absolute/path"}',
		grepInputSchema,
	),
] as const;

export function createPublicError(
	code: PublicErrorCode,
	message: string,
): PublicError {
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

export function parsePublicOutputMode(
	value: unknown,
): Result<PublicOutputMode, PublicError> {
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

	const within = normalizeWithin(input.within);
	if (!within.ok) {
		return within;
	}

	const extensions = normalizeExtensions(input.extensions);
	if (!extensions.ok) {
		return extensions;
	}

	const excludePaths = normalizeExcludePaths(input.exclude_paths);
	if (!excludePaths.ok) {
		return excludePaths;
	}

	const limit = parseOptionalNonNegativeInt(
		input.limit,
		"limit",
		DEFAULT_LIMIT,
	);
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

	return {
		ok: true,
		value: withWithin(
			{
				tool: "fff_find_files",
				query: query.value,
				extensions: extensions.value,
				excludePaths: excludePaths.value,
				limit: limit.value,
				cursor: cursor.value,
				outputMode: outputMode.value,
			},
			within.value,
		),
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

	const within = normalizeWithin(input.within);
	if (!within.ok) {
		return within;
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

	const limit = parseOptionalNonNegativeInt(
		input.limit,
		"limit",
		DEFAULT_LIMIT,
	);
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

	return {
		ok: true,
		value: withWithin(
			{
				tool: "fff_search_terms",
				terms: terms.value,
				extensions: extensions.value,
				excludePaths: excludePaths.value,
				contextLines: contextLines.value,
				limit: limit.value,
				cursor: cursor.value,
				outputMode: outputMode.value,
			},
			within.value,
		),
	};
}

function normalizeGrepInput(
	input: Record<string, unknown>,
): Result<PublicGrepRequest, PublicError> {
	const knownFields = rejectUnknownFields(input, grepInputSchema);
	if (!knownFields.ok) {
		return knownFields;
	}

	const pattern = parseRequiredString(input.pattern, "pattern");
	if (!pattern.ok) {
		return pattern;
	}

	const within = normalizeWithin(input.within);
	if (!within.ok) {
		return within;
	}

	if (
		input.case_sensitive !== undefined &&
		typeof input.case_sensitive !== "boolean"
	) {
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

	const limit = parseOptionalNonNegativeInt(
		input.limit,
		"limit",
		DEFAULT_LIMIT,
	);
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

	return {
		ok: true,
		value: withWithin(
			{
				tool: "fff_grep",
				pattern: pattern.value,
				caseSensitive: input.case_sensitive ?? false,
				extensions: extensions.value,
				excludePaths: excludePaths.value,
				contextLines: contextLines.value,
				limit: limit.value,
				cursor: cursor.value,
				outputMode: outputMode.value,
			},
			within.value,
		),
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
			return normalizeSearchTermsInput(record);
		case "fff_grep":
			return normalizeGrepInput(record);
	}
}
