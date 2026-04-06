import { describe, expect, test } from "vitest";
import type {
	BackendResultItem,
	BackendSearchRequest,
	BackendSearchResult,
	SearchBackendAdapter,
	SearchBackendRuntime,
} from "./adapters/types";
import { createSearchCoordinator } from "./coordinator";
import { RuntimeManager } from "./runtime-manager";
import type { PublicToolRequest, RouterConfig, SearchQueryKind } from "./types";

const config: RouterConfig = {
	allowlistedNonGitPrefixes: [
		{
			prefix: "/allow",
			mode: "first-child-root",
		},
	],
	promotion: { windowMs: 10 * 60 * 1000, requiredHits: 2 },
	ttl: { gitMs: 60 * 60 * 1000, nonGitMs: 15 * 60 * 1000 },
	limits: { maxPersistentDaemons: 12, maxPersistentNonGitDaemons: 4 },
};

function makePublicRequest(
	overrides: Partial<PublicToolRequest> = {},
): PublicToolRequest {
	return {
		tool: "fff_find_files",
		query: "router",
		within: "/repo/src",
		extensions: [],
		excludePaths: [],
		limit: 20,
		cursor: null,
		outputMode: "compact",
		...overrides,
	} as PublicToolRequest;
}

function makeAdapter(args: {
	backendId: "fff-mcp" | "rg-fd";
	supportedQueryKinds?: SearchQueryKind[];
	execute: (request: BackendSearchRequest) => Promise<BackendSearchResult>;
}) {
	const calls: BackendSearchRequest[] = [];
	let startCount = 0;

	const adapter: SearchBackendAdapter<SearchBackendRuntime> = {
		backendId: args.backendId,
		supportedQueryKinds: args.supportedQueryKinds ?? [
			"find_files",
			"search_terms",
			"grep",
		],
		async startRuntime(runtimeArgs) {
			startCount += 1;
			return {
				id: `${args.backendId}::${runtimeArgs.persistenceRoot}`,
				close: async () => {},
			};
		},
		async execute({ request }) {
			calls.push(request);
			return await args.execute(request);
		},
	};

	return {
		adapter,
		calls,
		get startCount() {
			return startCount;
		},
	};
}

function okResult(
	queryKind: SearchQueryKind,
	items: BackendResultItem[],
): BackendSearchResult {
	return {
		ok: true,
		value: {
			backendId: "fff-mcp",
			queryKind,
			items,
			nextCursor: null,
		},
	};
}

describe("createSearchCoordinator", () => {
	test("uses the primary adapter and shapes compact find_files output", async () => {
		const primary = makeAdapter({
			backendId: "fff-mcp",
			execute: async () =>
				okResult("find_files", [
					{ path: "/repo/src/router.ts", relativePath: "src/router.ts" },
				]),
		});
		const fallback = makeAdapter({
			backendId: "rg-fd",
			execute: async () => okResult("find_files", []),
		});

		const coordinator = createSearchCoordinator({
			config,
			primaryAdapter: primary.adapter,
			fallbackAdapter: fallback.adapter,
			runtimeManager: new RuntimeManager(),
			validateWithin: async ({ within }) => ({
				ok: true,
				value: { resolvedWithin: within, basePath: within },
			}),
			resolveRoutingPath: async (within) => ({
				ok: true,
				value: { realPath: within, statType: "directory", gitRoot: "/repo" },
			}),
		});

		const result = await coordinator.execute(makePublicRequest());

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.value).toEqual({
			mode: "compact",
			base_path: "/repo/src",
			next_cursor: null,
			items: [{ path: "router.ts" }],
		});
		expect(primary.startCount).toBe(1);
		expect(fallback.calls).toHaveLength(0);
	});

	test("invokes routing lifecycle planning and reuses persistent runtimes", async () => {
		const primary = makeAdapter({
			backendId: "fff-mcp",
			execute: async (request) => okResult(request.queryKind, []),
		});
		const fallback = makeAdapter({
			backendId: "rg-fd",
			execute: async () => okResult("find_files", []),
		});
		const planningCalls: SearchQueryKind[] = [];

		const coordinator = createSearchCoordinator({
			config,
			primaryAdapter: primary.adapter,
			fallbackAdapter: fallback.adapter,
			runtimeManager: new RuntimeManager(),
			validateWithin: async ({ within }) => ({
				ok: true,
				value: { resolvedWithin: within, basePath: within },
			}),
			resolveRoutingPath: async (within) => ({
				ok: true,
				value: { realPath: within, statType: "directory", gitRoot: "/repo" },
			}),
			planLifecycle: (args) => {
				planningCalls.push(args.queryKind);
				return {
					ok: true,
					value: {
						queryKind: args.queryKind,
						target: {
							rootType: "git",
							persistenceRoot: "/repo",
							searchScope: args.realPath,
							backendMode: "persistent",
							ttlMs: config.ttl.gitMs,
						},
						nextState: args.state,
						action:
							planningCalls.length === 1
								? { type: "start-persistent", key: "/repo" as const }
								: { type: "reuse-persistent", key: "/repo" as const },
						evicted: [],
					},
				};
			},
		});

		await coordinator.execute(
			makePublicRequest({
				tool: "fff_search_terms",
				terms: ["router"],
				contextLines: 0,
			}),
		);
		await coordinator.execute(
			makePublicRequest({
				tool: "fff_grep",
				pattern: "router",
				caseSensitive: true,
				contextLines: 0,
			}),
		);

		expect(planningCalls).toEqual(["search_terms", "grep"]);
		expect(primary.startCount).toBe(1);
	});

	test("falls back only on backend failure", async () => {
		const primary = makeAdapter({
			backendId: "fff-mcp",
			execute: async () => ({
				ok: false as const,
				error: {
					code: "BACKEND_UNAVAILABLE" as const,
					backendId: "fff-mcp" as const,
					message: "primary unavailable",
				},
			}),
		});
		const fallback = makeAdapter({
			backendId: "rg-fd",
			execute: async () => ({
				ok: true as const,
				value: {
					backendId: "rg-fd" as const,
					queryKind: "find_files" as const,
					items: [
						{ path: "/repo/src/router.ts", relativePath: "src/router.ts" },
					],
					nextCursor: null,
				},
			}),
		});

		const coordinator = createSearchCoordinator({
			config,
			primaryAdapter: primary.adapter,
			fallbackAdapter: fallback.adapter,
			runtimeManager: new RuntimeManager(),
			validateWithin: async ({ within }) => ({
				ok: true,
				value: { resolvedWithin: within, basePath: within },
			}),
			resolveRoutingPath: async (within) => ({
				ok: true,
				value: { realPath: within, statType: "directory", gitRoot: "/repo" },
			}),
		});

		const result = await coordinator.execute(
			makePublicRequest({ outputMode: "json" }),
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.value).toEqual({
			mode: "json",
			base_path: "/repo/src",
			next_cursor: null,
			backend_used: "rg-fd",
			fallback_applied: true,
			fallback_reason: "backend_error",
			stats: { result_count: 1 },
			items: [
				{
					path: "router.ts",
					absolute_path: "/repo/src/router.ts",
				},
			],
		});
		expect(fallback.calls).toHaveLength(1);
	});

	test("does not fall back on zero results", async () => {
		const primary = makeAdapter({
			backendId: "fff-mcp",
			execute: async () => okResult("find_files", []),
		});
		const fallback = makeAdapter({
			backendId: "rg-fd",
			execute: async () => okResult("find_files", []),
		});

		const coordinator = createSearchCoordinator({
			config,
			primaryAdapter: primary.adapter,
			fallbackAdapter: fallback.adapter,
			runtimeManager: new RuntimeManager(),
			validateWithin: async ({ within }) => ({
				ok: true,
				value: { resolvedWithin: within, basePath: within },
			}),
			resolveRoutingPath: async (within) => ({
				ok: true,
				value: { realPath: within, statType: "directory", gitRoot: "/repo" },
			}),
		});

		const result = await coordinator.execute(makePublicRequest());

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.value).toEqual({
			mode: "compact",
			base_path: "/repo/src",
			next_cursor: null,
			items: [],
		});
		expect(fallback.calls).toHaveLength(0);
	});

	test("translates exclude paths relative to the public base path", async () => {
		const primary = makeAdapter({
			backendId: "fff-mcp",
			execute: async () => okResult("find_files", []),
		});
		const fallback = makeAdapter({
			backendId: "rg-fd",
			execute: async () => okResult("find_files", []),
		});

		const coordinator = createSearchCoordinator({
			config,
			primaryAdapter: primary.adapter,
			fallbackAdapter: fallback.adapter,
			runtimeManager: new RuntimeManager(),
			validateWithin: async ({ within }) => ({
				ok: true,
				value: { resolvedWithin: within, basePath: "/repo/src" },
			}),
			resolveRoutingPath: async () => ({
				ok: true,
				value: {
					realPath: "/repo/src",
					statType: "directory",
					gitRoot: "/repo",
				},
			}),
		});

		await coordinator.execute(
			makePublicRequest({ excludePaths: ["generated"] }),
		);

		expect(primary.calls[0]?.excludePaths).toEqual(["src/generated"]);
	});

	test("evicts planned persistent runtimes before continuing", async () => {
		let closeCount = 0;
		const runtimeManager = new RuntimeManager();
		await runtimeManager.withRuntime(
			{
				backendId: "fff-mcp",
				persistenceRoot: "/old",
				start: async () => ({
					id: "old-runtime",
					close: async () => {
						closeCount += 1;
					},
				}),
			},
			async () => undefined,
		);

		const primary = makeAdapter({
			backendId: "fff-mcp",
			execute: async () => okResult("find_files", []),
		});
		const fallback = makeAdapter({
			backendId: "rg-fd",
			execute: async () => okResult("find_files", []),
		});

		const coordinator = createSearchCoordinator({
			config,
			primaryAdapter: primary.adapter,
			fallbackAdapter: fallback.adapter,
			runtimeManager,
			validateWithin: async ({ within }) => ({
				ok: true,
				value: { resolvedWithin: within, basePath: within },
			}),
			resolveRoutingPath: async (within) => ({
				ok: true,
				value: { realPath: within, statType: "directory", gitRoot: "/repo" },
			}),
			planLifecycle: (args) => ({
				ok: true,
				value: {
					queryKind: args.queryKind,
					target: {
						rootType: "git",
						persistenceRoot: "/repo",
						searchScope: args.realPath,
						backendMode: "persistent",
						ttlMs: config.ttl.gitMs,
					},
					nextState: args.state,
					action: { type: "start-persistent", key: "/repo" },
					evicted: ["/old"],
				},
			}),
		});

		await coordinator.execute(makePublicRequest());
		expect(closeCount).toBe(1);
	});

	test("does not fall back when the primary adapter returns SEARCH_FAILED", async () => {
		const primary = makeAdapter({
			backendId: "fff-mcp",
			execute: async () => ({
				ok: false as const,
				error: {
					code: "SEARCH_FAILED" as const,
					backendId: "fff-mcp" as const,
					message: "primary search failed",
				},
			}),
		});
		const fallback = makeAdapter({
			backendId: "rg-fd",
			execute: async () =>
				okResult("find_files", [
					{ path: "/repo/src/router.ts", relativePath: "src/router.ts" },
				]),
		});

		const coordinator = createSearchCoordinator({
			config,
			primaryAdapter: primary.adapter,
			fallbackAdapter: fallback.adapter,
			runtimeManager: new RuntimeManager(),
			validateWithin: async ({ within }) => ({
				ok: true,
				value: { resolvedWithin: within, basePath: within },
			}),
			resolveRoutingPath: async (within) => ({
				ok: true,
				value: { realPath: within, statType: "directory", gitRoot: "/repo" },
			}),
		});

		const result = await coordinator.execute(makePublicRequest());

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("SEARCH_FAILED");
		expect(fallback.calls).toHaveLength(0);
	});

	test("preserves successful ephemeral results when runtime cleanup fails", async () => {
		const primary = makeAdapter({
			backendId: "fff-mcp",
			execute: async () =>
				okResult("find_files", [
					{ path: "/allow/pkg-a/router.ts", relativePath: "router.ts" },
				]),
		});
		primary.adapter.startRuntime = async () => ({
			id: "ephemeral-runtime",
			close: async () => {
				throw new Error("close failed");
			},
		});
		const fallback = makeAdapter({
			backendId: "rg-fd",
			execute: async () => okResult("find_files", []),
		});

		const coordinator = createSearchCoordinator({
			config,
			primaryAdapter: primary.adapter,
			fallbackAdapter: fallback.adapter,
			runtimeManager: new RuntimeManager(),
			validateWithin: async ({ within }) => ({
				ok: true,
				value: { resolvedWithin: within, basePath: within },
			}),
			resolveRoutingPath: async (within) => ({
				ok: true,
				value: { realPath: within, statType: "directory", gitRoot: null },
			}),
			planLifecycle: (args) => ({
				ok: true,
				value: {
					queryKind: args.queryKind,
					target: {
						rootType: "non-git",
						persistenceRoot: "/allow/pkg-a",
						searchScope: args.realPath,
						backendMode: "ephemeral-candidate",
						ttlMs: config.ttl.nonGitMs,
					},
					nextState: args.state,
					action: { type: "run-ephemeral", key: "/allow/pkg-a" },
					evicted: [],
				},
			}),
		});

		const result = await coordinator.execute(
			makePublicRequest({ within: "/allow/pkg-a" }),
		);

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.value).toEqual({
			mode: "compact",
			base_path: "/allow/pkg-a",
			next_cursor: null,
			items: [{ path: "router.ts" }],
		});
	});

	test("returns SEARCH_FAILED when an adapter does not support the query kind", async () => {
		const primary = makeAdapter({
			backendId: "fff-mcp",
			supportedQueryKinds: ["find_files"],
			execute: async () => okResult("find_files", []),
		});
		const fallback = makeAdapter({
			backendId: "rg-fd",
			supportedQueryKinds: ["find_files"],
			execute: async () => okResult("find_files", []),
		});

		const coordinator = createSearchCoordinator({
			config,
			primaryAdapter: primary.adapter,
			fallbackAdapter: fallback.adapter,
			runtimeManager: new RuntimeManager(),
			validateWithin: async ({ within }) => ({
				ok: true,
				value: { resolvedWithin: within, basePath: within },
			}),
			resolveRoutingPath: async (within) => ({
				ok: true,
				value: { realPath: within, statType: "directory", gitRoot: "/repo" },
			}),
		});

		const result = await coordinator.execute(
			makePublicRequest({
				tool: "fff_grep",
				pattern: "router",
				caseSensitive: true,
				contextLines: 0,
			}),
		);

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("SEARCH_FAILED");
	});

	test("derives file restriction and stable public errors", async () => {
		const primary = makeAdapter({
			backendId: "fff-mcp",
			execute: async (request) =>
				okResult(request.queryKind, [
					{
						path: "/repo/src/router.ts",
						relativePath: "src/router.ts",
						line: 12,
						text: "export function planRequest() {}",
					},
				]),
		});
		const fallback = makeAdapter({
			backendId: "rg-fd",
			execute: async () => okResult("grep", []),
		});

		const coordinator = createSearchCoordinator({
			config,
			primaryAdapter: primary.adapter,
			fallbackAdapter: fallback.adapter,
			runtimeManager: new RuntimeManager(),
			validateWithin: async ({ within: _within }) => ({
				ok: true,
				value: {
					resolvedWithin: "/repo/src/router.ts",
					basePath: "/repo/src",
					fileRestriction: "/repo/src/router.ts",
				},
			}),
			resolveRoutingPath: async () => ({
				ok: true,
				value: {
					realPath: "/repo/src/router.ts",
					statType: "file",
					gitRoot: "/repo",
				},
			}),
		});

		const success = await coordinator.execute(
			makePublicRequest({
				tool: "fff_grep",
				pattern: "planRequest",
				caseSensitive: true,
				contextLines: 0,
			}),
		);
		expect(success.ok).toBe(true);
		if (!success.ok) throw new Error("expected success");
		expect(primary.calls[0]?.fileRestriction).toBe("/repo/src/router.ts");
		expect(success.value).toEqual({
			mode: "compact",
			base_path: "/repo/src",
			next_cursor: null,
			items: [
				{
					path: "router.ts",
					line: 12,
					text: "export function planRequest() {}",
				},
			],
		});

		const invalid = await coordinator.execute(
			makePublicRequest({ within: undefined }),
		);
		expect(invalid.ok).toBe(false);
		if (invalid.ok) throw new Error("expected failure");
		expect(invalid.error.code).toBe("INVALID_REQUEST");
	});
});
