import path from "node:path";
import type {
	FindFilesRequest,
	OutputMode,
	Result,
	RouterErrorCode,
	RouterRequest,
	SearchCodeRequest,
} from "./types";

const EXTENSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const PATH_META_PATTERN = /[*?[\]{}!]/;

function invalid(
	message: string,
	code: RouterErrorCode = "INVALID_REQUEST",
): Result<never> {
	return { ok: false, error: { code, message } };
}

function parseNonNegativeInt(
	field: string,
	value: unknown,
	defaultValue: number,
): Result<number> {
	if (value === undefined) {
		return { ok: true, value: defaultValue };
	}

	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
		return invalid(`${field} must be a non-negative integer`);
	}

	return { ok: true, value };
}

function parseOutputMode(value: unknown): Result<OutputMode> {
	if (value === undefined) {
		return { ok: true, value: "content" };
	}

	if (value === "content" || value === "files" || value === "count") {
		return { ok: true, value };
	}

	return invalid("output_mode must be one of: content, files, count");
}

function containsPathMeta(value: string): boolean {
	return PATH_META_PATTERN.test(value);
}

function normalizeExtensions(input: unknown): Result<string[]> {
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

function normalizeExcludePath(entry: string): Result<string> {
	const trimmed = entry.trim().replace(/\\/g, "/");
	if (!trimmed) {
		return invalid("exclude_paths must not contain empty values");
	}

	if (path.isAbsolute(trimmed)) {
		return invalid("exclude_paths must be relative descendant paths");
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
		return invalid("exclude_paths must not escape the persistence root");
	}

	return { ok: true, value: segments.join("/") };
}

function normalizeExcludePaths(input: unknown): Result<string[]> {
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

function normalizeSearchPath(value: unknown): Result<string> {
	if (typeof value !== "string" || value.trim() === "") {
		return invalid("search_path is required");
	}

	const trimmed = value.trim();
	if (!path.isAbsolute(trimmed)) {
		return invalid("search_path must be absolute", "SEARCH_PATH_NOT_ABSOLUTE");
	}

	return { ok: true, value: trimmed };
}

function normalizeCursor(value: unknown): Result<string | null> {
	if (value === undefined || value === null) {
		return { ok: true, value: null };
	}

	if (typeof value !== "string" || value.trim() === "") {
		return invalid("cursor must be a non-empty string when provided");
	}

	return { ok: true, value: value.trim() };
}

function parseSearchCodeRequest(
	record: Record<string, unknown>,
): Result<SearchCodeRequest> {
	const searchPath = normalizeSearchPath(record.search_path);
	if (!searchPath.ok) return searchPath;

	if (!Array.isArray(record.any_of) || record.any_of.length === 0) {
		return invalid("search_code.any_of must contain at least one string");
	}

	const anyOf = record.any_of.map((item) =>
		typeof item === "string" ? item.trim() : "",
	);
	if (anyOf.some((item) => item === "")) {
		return invalid("search_code.any_of must contain only non-empty strings");
	}

	const excludePaths = normalizeExcludePaths(record.exclude_paths);
	if (!excludePaths.ok) return excludePaths;

	const extensions = normalizeExtensions(record.extensions);
	if (!extensions.ok) return extensions;

	const contextLines = parseNonNegativeInt(
		"context_lines",
		record.context_lines,
		0,
	);
	if (!contextLines.ok) return contextLines;

	const maxResults = parseNonNegativeInt("max_results", record.max_results, 20);
	if (!maxResults.ok) return maxResults;

	const cursor = normalizeCursor(record.cursor);
	if (!cursor.ok) return cursor;

	const outputMode = parseOutputMode(record.output_mode);
	if (!outputMode.ok) return outputMode;

	return {
		ok: true,
		value: {
			tool: "search_code",
			searchPath: searchPath.value,
			anyOf,
			excludePaths: excludePaths.value,
			extensions: extensions.value,
			contextLines: contextLines.value,
			maxResults: maxResults.value,
			cursor: cursor.value,
			outputMode: outputMode.value,
		},
	};
}

function parseFindFilesRequest(
	record: Record<string, unknown>,
): Result<FindFilesRequest> {
	const searchPath = normalizeSearchPath(record.search_path);
	if (!searchPath.ok) return searchPath;

	if (typeof record.query !== "string" || record.query.trim() === "") {
		return invalid("find_files.query must be a non-empty string");
	}

	const excludePaths = normalizeExcludePaths(record.exclude_paths);
	if (!excludePaths.ok) return excludePaths;

	const extensions = normalizeExtensions(record.extensions);
	if (!extensions.ok) return extensions;

	const maxResults = parseNonNegativeInt("max_results", record.max_results, 20);
	if (!maxResults.ok) return maxResults;

	const cursor = normalizeCursor(record.cursor);
	if (!cursor.ok) return cursor;

	return {
		ok: true,
		value: {
			tool: "find_files",
			searchPath: searchPath.value,
			query: record.query.trim(),
			excludePaths: excludePaths.value,
			extensions: extensions.value,
			maxResults: maxResults.value,
			cursor: cursor.value,
		},
	};
}

export function parseRouterRequest(input: unknown): Result<RouterRequest> {
	if (!input || typeof input !== "object") {
		return invalid("request must be an object");
	}

	const record = input as Record<string, unknown>;

	if (record.tool === "search_code") {
		return parseSearchCodeRequest(record);
	}

	if (record.tool === "find_files") {
		return parseFindFilesRequest(record);
	}

	return invalid("tool must be 'search_code' or 'find_files'");
}
