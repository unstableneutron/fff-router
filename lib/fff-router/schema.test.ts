import { describe, expect, test } from "bun:test";
import { parseRouterRequest } from "./schema";

describe("parseRouterRequest", () => {
	test("accepts search_code and normalizes extensions", () => {
		const result = parseRouterRequest({
			tool: "search_code",
			search_path: "/tmp/project/src",
			any_of: ["ActorAuth", "actor_auth"],
			exclude_paths: ["dist", "src/generated"],
			extensions: [".ts", "tsx"],
			context_lines: 1,
			max_results: 20,
			output_mode: "content",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.value.tool).toBe("search_code");
		expect(result.value.extensions).toEqual(["ts", "tsx"]);
		expect(result.value.excludePaths).toEqual(["dist", "src/generated"]);
	});

	test("applies defaults for omitted optional fields", () => {
		const result = parseRouterRequest({
			tool: "find_files",
			search_path: "/tmp/project",
			query: "auth model",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.value.maxResults).toBe(20);
		expect(result.value.excludePaths).toEqual([]);
		expect(result.value.extensions).toEqual([]);
		expect(result.value.cursor).toBeNull();
	});

	test("rejects non-absolute search_path", () => {
		const result = parseRouterRequest({
			tool: "search_code",
			search_path: "src",
			any_of: ["ActorAuth"],
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("SEARCH_PATH_NOT_ABSOLUTE");
	});

	test("rejects empty any_of", () => {
		const result = parseRouterRequest({
			tool: "search_code",
			search_path: "/tmp/project",
			any_of: [],
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("INVALID_REQUEST");
	});

	test("rejects invalid output_mode instead of coercing it", () => {
		const result = parseRouterRequest({
			tool: "search_code",
			search_path: "/tmp/project",
			any_of: ["ActorAuth"],
			output_mode: "summary",
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("INVALID_REQUEST");
	});

	test("rejects negative max_results", () => {
		const result = parseRouterRequest({
			tool: "find_files",
			search_path: "/tmp/project",
			query: "auth model",
			max_results: -1,
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("INVALID_REQUEST");
	});

	test("rejects negative context_lines", () => {
		const result = parseRouterRequest({
			tool: "search_code",
			search_path: "/tmp/project",
			any_of: ["ActorAuth"],
			context_lines: -1,
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("INVALID_REQUEST");
	});

	test("rejects non-string cursor", () => {
		const result = parseRouterRequest({
			tool: "find_files",
			search_path: "/tmp/project",
			query: "auth model",
			cursor: 42,
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("INVALID_REQUEST");
	});

	test("rejects absolute exclude_paths", () => {
		const result = parseRouterRequest({
			tool: "find_files",
			search_path: "/tmp/project",
			query: "auth model",
			exclude_paths: ["/tmp/project/dist"],
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("INVALID_REQUEST");
	});

	test("rejects exclude_paths with traversal", () => {
		const result = parseRouterRequest({
			tool: "search_code",
			search_path: "/tmp/project",
			any_of: ["ActorAuth"],
			exclude_paths: ["src/../../etc"],
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("INVALID_REQUEST");
	});

	test("rejects empty extension entries", () => {
		const result = parseRouterRequest({
			tool: "find_files",
			search_path: "/tmp/project",
			query: "auth model",
			extensions: ["."],
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("INVALID_REQUEST");
	});

	test("rejects requests that are not objects", () => {
		const result = parseRouterRequest(null);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("INVALID_REQUEST");
	});

	test("rejects unknown tools", () => {
		const result = parseRouterRequest({
			tool: "search_everything",
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("INVALID_REQUEST");
	});

	test("rejects extensions with path separators or glob characters", () => {
		const result = parseRouterRequest({
			tool: "find_files",
			search_path: "/tmp/project",
			query: "auth model",
			extensions: ["foo/bar"],
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("INVALID_REQUEST");
	});

	test("rejects exclude_paths with current-directory segments", () => {
		const result = parseRouterRequest({
			tool: "find_files",
			search_path: "/tmp/project",
			query: "auth model",
			exclude_paths: ["src/./generated"],
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("INVALID_REQUEST");
	});

	test("rejects exclude_paths with glob characters", () => {
		const result = parseRouterRequest({
			tool: "search_code",
			search_path: "/tmp/project",
			any_of: ["ActorAuth"],
			exclude_paths: ["src/*"],
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("INVALID_REQUEST");
	});
});
