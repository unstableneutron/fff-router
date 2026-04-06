import { describe, expect, test } from "vitest";
import { createFffMcpAdapter } from "./fff-mcp";
import type {
	FindFilesBackendRequest,
	GrepBackendRequest,
	SearchBackendRuntime,
	SearchTermsBackendRequest,
} from "./types";

type FinderCallLog = {
	fileSearch?: { query: string };
	multiGrep?: {
		patterns: string[];
		beforeContext: number;
		afterContext: number;
	};
	grep?: {
		query: string;
		mode: string;
		beforeContext: number;
		afterContext: number;
	};
};

function makeRuntime(log: FinderCallLog): SearchBackendRuntime & {
	finder: {
		fileSearch: (query: string) => {
			ok: true;
			value: {
				items: Array<{ path: string; relativePath: string }>;
			};
		};
		multiGrep: (options: {
			patterns: string[];
			beforeContext: number;
			afterContext: number;
		}) => {
			ok: true;
			value: {
				items: Array<{
					path: string;
					relativePath: string;
					lineNumber: number;
					lineContent: string;
				}>;
			};
		};
		grep: (
			query: string,
			options: {
				mode: string;
				beforeContext: number;
				afterContext: number;
			},
		) => {
			ok: true;
			value: {
				items: Array<{
					path: string;
					relativePath: string;
					lineNumber: number;
					lineContent: string;
				}>;
			};
		};
	};
} {
	return {
		id: "fff-runtime",
		close: async () => {},
		finder: {
			fileSearch(query) {
				log.fileSearch = { query };
				return {
					ok: true,
					value: {
						items: [
							{ path: "/repo/src/router.ts", relativePath: "src/router.ts" },
							{ path: "/repo/dist/router.js", relativePath: "dist/router.js" },
						],
					},
				};
			},
			multiGrep(options) {
				log.multiGrep = options;
				return {
					ok: true,
					value: {
						items: [
							{
								path: "/repo/src/router.ts",
								relativePath: "src/router.ts",
								lineNumber: 8,
								lineContent: "const router = createRouter();",
							},
							{
								path: "/repo/dist/router.js",
								relativePath: "dist/router.js",
								lineNumber: 3,
								lineContent: "const router = createRouter();",
							},
						],
					},
				};
			},
			grep(query, options) {
				log.grep = { query, ...options };
				return {
					ok: true,
					value: {
						items: [
							{
								path: "/repo/src/router.ts",
								relativePath: "src/router.ts",
								lineNumber: 12,
								lineContent: "export function planRequest() {}",
							},
						],
					},
				};
			},
		},
	};
}

const findFilesRequest: FindFilesBackendRequest = {
	backendId: "fff-mcp",
	persistenceRoot: "/repo",
	queryKind: "find_files",
	within: "/repo/src",
	basePath: "/repo/src",
	extensions: ["ts"],
	excludePaths: ["dist"],
	limit: 20,
	query: "router",
};

const searchTermsRequest: SearchTermsBackendRequest = {
	backendId: "fff-mcp",
	persistenceRoot: "/repo",
	queryKind: "search_terms",
	within: "/repo/src",
	basePath: "/repo/src",
	extensions: ["ts"],
	excludePaths: ["dist"],
	limit: 20,
	terms: ["router", "createRouter"],
	contextLines: 2,
};

const grepRequest: GrepBackendRequest = {
	backendId: "fff-mcp",
	persistenceRoot: "/repo",
	queryKind: "grep",
	within: "/repo/src",
	basePath: "/repo/src",
	extensions: ["ts"],
	excludePaths: [],
	limit: 20,
	pattern: "plan(Request)?",
	caseSensitive: false,
	contextLines: 1,
};

describe("createFffMcpAdapter", () => {
	test("lowers find_files requests into FFF file search and filters results", async () => {
		const log: FinderCallLog = {};
		const adapter = createFffMcpAdapter();

		const result = await adapter.execute({
			request: findFilesRequest,
			runtime: makeRuntime(log),
		});

		expect(log.fileSearch).toEqual({ query: "router" });
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.value.items).toEqual([
			{ path: "/repo/src/router.ts", relativePath: "src/router.ts" },
		]);
	});

	test("lowers search_terms requests into FFF multi_grep with literal OR semantics", async () => {
		const log: FinderCallLog = {};
		const adapter = createFffMcpAdapter();

		const result = await adapter.execute({
			request: searchTermsRequest,
			runtime: makeRuntime(log),
		});

		expect(log.multiGrep).toEqual({
			patterns: ["router", "createRouter"],
			beforeContext: 2,
			afterContext: 2,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.value.items).toEqual([
			{
				path: "/repo/src/router.ts",
				relativePath: "src/router.ts",
				line: 8,
				text: "const router = createRouter();",
			},
		]);
	});

	test("keeps grep on the FFF-backed regex path", async () => {
		const log: FinderCallLog = {};
		const adapter = createFffMcpAdapter();

		const result = await adapter.execute({
			request: grepRequest,
			runtime: makeRuntime(log),
		});

		expect(log.grep).toEqual({
			query: "(?i:plan(Request)?)",
			mode: "regex",
			beforeContext: 1,
			afterContext: 1,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.value.queryKind).toBe("grep");
	});
});
