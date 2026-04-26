import { describe, expect, test } from "vitest";
import type {
  BackendResultItem,
  BackendSearchRequest,
  BackendSearchResult,
  SearchBackendAdapter,
  SearchBackendRuntime,
} from "./adapters/types";
import { createCoordinatorRuntimeConfigRef, createSearchCoordinator } from "./coordinator";
import { RuntimeManager } from "./runtime-manager";
import type { PublicToolRequest, RouterConfig, SearchBackendId, SearchQueryKind } from "./types";

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

function makePublicRequest(overrides: Partial<PublicToolRequest> = {}): PublicToolRequest {
  return {
    tool: "fff_find_files",
    query: "router",
    within: ["/repo/src"],
    extensions: [],
    excludePaths: [],
    limit: 20,
    cursor: null,
    outputMode: "compact",
    ...overrides,
  } as PublicToolRequest;
}

function makeAdapter(args: {
  backendId: SearchBackendId;
  supportedQueryKinds?: SearchQueryKind[];
  execute: (request: BackendSearchRequest) => Promise<BackendSearchResult>;
}) {
  const calls: BackendSearchRequest[] = [];
  let startCount = 0;

  const adapter: SearchBackendAdapter<SearchBackendRuntime> = {
    backendId: args.backendId,
    supportedQueryKinds: args.supportedQueryKinds ?? ["find_files", "search_terms", "grep"],
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
  backendId: SearchBackendId = "fff-node",
): BackendSearchResult {
  return {
    ok: true,
    value: {
      backendId,
      queryKind,
      items,
      nextCursor: null,
    },
  };
}

describe("createSearchCoordinator", () => {
  test("uses the latest runtime config from a live config ref", async () => {
    const liveConfigRef = createCoordinatorRuntimeConfigRef({
      config,
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
    });
    const fffNode = makeAdapter({
      backendId: "fff-node",
      execute: async () => okResult("find_files", []),
    });
    const rg = makeAdapter({
      backendId: "rg",
      execute: async () =>
        okResult(
          "find_files",
          [{ path: "/repo/src/router.ts", relativePath: "src/router.ts" }],
          "rg",
        ),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": fffNode.adapter,
        rg: rg.adapter,
      },
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
      liveConfigRef,
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
        ok: true,
        value: { resolvedWithin: within, basePath: within },
      }),
      resolveRoutingPath: async (within) => ({
        ok: true,
        value: { realPath: within, statType: "directory", gitRoot: "/repo" },
      }),
    });

    liveConfigRef.current = {
      config,
      primaryBackendId: "rg",
      fallbackBackendId: null,
    };

    const result = await coordinator.execute(makePublicRequest({ outputMode: "json" }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    if (!("backend_used" in result.value)) throw new Error("expected json result");
    expect(result.value.backend_used).toBe("rg");
    expect(fffNode.calls).toHaveLength(0);
    expect(rg.calls).toHaveLength(1);
  });

  test("uses the configured primary backend from the adapter registry", async () => {
    const fffNode = makeAdapter({
      backendId: "fff-node",
      execute: async () => okResult("find_files", []),
    });
    const rg = makeAdapter({
      backendId: "rg",
      execute: async () =>
        okResult(
          "find_files",
          [{ path: "/repo/src/router.ts", relativePath: "src/router.ts" }],
          "rg",
        ),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": fffNode.adapter,
        rg: rg.adapter,
      },
      primaryBackendId: "rg",
      fallbackBackendId: null,
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
        ok: true,
        value: { resolvedWithin: within, basePath: within },
      }),
      resolveRoutingPath: async (within) => ({
        ok: true,
        value: { realPath: within, statType: "directory", gitRoot: "/repo" },
      }),
    });

    const result = await coordinator.execute(makePublicRequest({ outputMode: "json" }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value).toEqual({
      mode: "json",
      base_path: "/repo/src",
      next_cursor: null,
      backend_used: "rg",
      fallback_applied: false,
      stats: { result_count: 1 },
      items: [
        {
          path: "router.ts",
          absolute_path: "/repo/src/router.ts",
        },
      ],
    });
    expect(fffNode.calls).toHaveLength(0);
    expect(rg.calls).toHaveLength(1);
  });

  test("does not attempt fallback when the selected primary backend has no fallback", async () => {
    const primary = makeAdapter({
      backendId: "rg",
      execute: async () => ({
        ok: false as const,
        error: {
          code: "BACKEND_UNAVAILABLE" as const,
          backendId: "rg" as const,
          message: "rg missing",
        },
      }),
    });
    const fffNode = makeAdapter({
      backendId: "fff-node",
      execute: async () => okResult("find_files", []),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": fffNode.adapter,
        rg: primary.adapter,
      },
      primaryBackendId: "rg",
      fallbackBackendId: null,
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
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
    expect(result.error).toEqual({
      code: "BACKEND_UNAVAILABLE",
      message: "rg missing",
    });
    expect(fffNode.calls).toHaveLength(0);
  });
  test("uses the primary adapter and shapes compact find_files output", async () => {
    const primary = makeAdapter({
      backendId: "fff-node",
      execute: async () =>
        okResult("find_files", [{ path: "/repo/src/router.ts", relativePath: "src/router.ts" }]),
    });
    const fallback = makeAdapter({
      backendId: "rg",
      execute: async () => okResult("find_files", []),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": primary.adapter,
        rg: fallback.adapter,
      },
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
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

  test("preserves compact passthrough text from fff-mcp grep", async () => {
    const primary = makeAdapter({
      backendId: "fff-mcp",
      execute: async () => ({
        ok: true as const,
        value: {
          backendId: "fff-mcp" as const,
          queryKind: "grep" as const,
          items: [],
          nextCursor: null,
          renderedCompact: [
            "→ Read lib/fff-router/coordinator.ts (only match)",
            "lib/fff-router/coordinator.ts [def]",
            " 539: export function createSearchCoordinator(deps: CoordinatorDeps): SearchCoordinator {",
            " 540| return new SearchCoordinatorImpl(deps);",
          ].join("\n"),
        },
      }),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: { "fff-mcp": primary.adapter },
      primaryBackendId: "fff-mcp",
      fallbackBackendId: null,
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
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
        patterns: ["createSearchCoordinator"],
        literal: false,
        caseSensitive: true,
        contextLines: 0,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value).toEqual({
      mode: "compact",
      base_path: "/repo/src",
      next_cursor: null,
      text: [
        "→ Read lib/fff-router/coordinator.ts (only match)",
        "lib/fff-router/coordinator.ts [def]",
        " 539: export function createSearchCoordinator(deps: CoordinatorDeps): SearchCoordinator {",
        " 540| return new SearchCoordinatorImpl(deps);",
      ].join("\n"),
    });
  });

  test("preserves compact passthrough text from fff-mcp search_terms", async () => {
    const primary = makeAdapter({
      backendId: "fff-mcp",
      execute: async () => ({
        ok: true as const,
        value: {
          backendId: "fff-mcp" as const,
          queryKind: "search_terms" as const,
          items: [],
          nextCursor: null,
          renderedCompact: "→ Read lib/fff-router/coordinator.ts (only match)",
        },
      }),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: { "fff-mcp": primary.adapter },
      primaryBackendId: "fff-mcp",
      fallbackBackendId: null,
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
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
        tool: "fff_search_terms",
        terms: ["createSearchCoordinator"],
        contextLines: 0,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value).toEqual({
      mode: "compact",
      base_path: "/repo/src",
      next_cursor: null,
      text: "→ Read lib/fff-router/coordinator.ts (only match)",
    });
  });

  test("adds fff-mcp summary and item metadata to json results", async () => {
    const primary = makeAdapter({
      backendId: "fff-mcp",
      execute: async () => ({
        ok: true as const,
        value: {
          backendId: "fff-mcp" as const,
          queryKind: "grep" as const,
          items: [
            {
              path: "/repo/src/coordinator.ts",
              relativePath: "src/coordinator.ts",
              line: 539,
              text: "export function createSearchCoordinator(deps: CoordinatorDeps): SearchCoordinator {",
              isDefinition: true,
              definitionBody: ["return new SearchCoordinatorImpl(deps);", "}"],
            },
          ],
          nextCursor: null,
          summary: {
            shownCount: 1,
            totalCount: 1,
            readRecommendation: {
              relativePath: "src/coordinator.ts",
              reason: "only match",
            },
          },
        },
      }),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: { "fff-mcp": primary.adapter },
      primaryBackendId: "fff-mcp",
      fallbackBackendId: null,
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
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
        patterns: ["createSearchCoordinator"],
        literal: false,
        caseSensitive: true,
        contextLines: 0,
        outputMode: "json",
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value).toEqual({
      mode: "json",
      base_path: "/repo/src",
      next_cursor: null,
      backend_used: "fff-mcp",
      fallback_applied: false,
      stats: { result_count: 1, shown_count: 1, total_count: 1 },
      read_recommendation: {
        path: "coordinator.ts",
        absolute_path: "/repo/src/coordinator.ts",
        reason: "only match",
      },
      items: [
        {
          path: "coordinator.ts",
          absolute_path: "/repo/src/coordinator.ts",
          line: 539,
          text: "export function createSearchCoordinator(deps: CoordinatorDeps): SearchCoordinator {",
          is_definition: true,
          definition_body: ["return new SearchCoordinatorImpl(deps);", "}"],
        },
      ],
    });
  });

  test("invokes routing lifecycle planning and reuses persistent runtimes", async () => {
    const primary = makeAdapter({
      backendId: "fff-node",
      execute: async (request) => okResult(request.queryKind, []),
    });
    const fallback = makeAdapter({
      backendId: "rg",
      execute: async () => okResult("find_files", []),
    });
    const planningCalls: SearchQueryKind[] = [];

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": primary.adapter,
        rg: fallback.adapter,
      },
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
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
        patterns: ["router"],
        literal: false,
        caseSensitive: true,
        contextLines: 0,
      }),
    );

    expect(planningCalls).toEqual(["search_terms", "grep"]);
    expect(primary.startCount).toBe(1);
  });

  test("falls back only on backend failure", async () => {
    const primary = makeAdapter({
      backendId: "fff-node",
      execute: async () => ({
        ok: false as const,
        error: {
          code: "BACKEND_UNAVAILABLE" as const,
          backendId: "fff-node" as const,
          message: "primary unavailable",
        },
      }),
    });
    const fallback = makeAdapter({
      backendId: "rg",
      execute: async () => ({
        ok: true as const,
        value: {
          backendId: "rg" as const,
          queryKind: "find_files" as const,
          items: [{ path: "/repo/src/router.ts", relativePath: "src/router.ts" }],
          nextCursor: null,
        },
      }),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": primary.adapter,
        rg: fallback.adapter,
      },
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
        ok: true,
        value: { resolvedWithin: within, basePath: within },
      }),
      resolveRoutingPath: async (within) => ({
        ok: true,
        value: { realPath: within, statType: "directory", gitRoot: "/repo" },
      }),
    });

    const result = await coordinator.execute(makePublicRequest({ outputMode: "json" }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value).toEqual({
      mode: "json",
      base_path: "/repo/src",
      next_cursor: null,
      backend_used: "rg",
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
      backendId: "fff-node",
      execute: async () => okResult("find_files", []),
    });
    const fallback = makeAdapter({
      backendId: "rg",
      execute: async () => okResult("find_files", []),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": primary.adapter,
        rg: fallback.adapter,
      },
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
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
      backendId: "fff-node",
      execute: async () => okResult("find_files", []),
    });
    const fallback = makeAdapter({
      backendId: "rg",
      execute: async () => okResult("find_files", []),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": primary.adapter,
        rg: fallback.adapter,
      },
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
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

    await coordinator.execute(makePublicRequest({ excludePaths: ["generated"] }));

    expect(primary.calls[0]?.excludePaths).toEqual(["src/generated"]);
  });

  test("shapes nested subtree results relative to base_path while preserving repo-relative excludes", async () => {
    const primary = makeAdapter({
      backendId: "fff-node",
      execute: async () =>
        okResult("find_files", [
          {
            path: "/repo/Vendor/libghostty/include/ghostty.h",
            relativePath: "Vendor/libghostty/include/ghostty.h",
          },
        ]),
    });
    const fallback = makeAdapter({
      backendId: "rg",
      execute: async () => okResult("find_files", []),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": primary.adapter,
        rg: fallback.adapter,
      },
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
        ok: true,
        value: { resolvedWithin: within, basePath: "/repo/Vendor/libghostty/include" },
      }),
      resolveRoutingPath: async () => ({
        ok: true,
        value: {
          realPath: "/repo/Vendor/libghostty/include",
          statType: "directory",
          gitRoot: "/repo",
        },
      }),
    });

    const result = await coordinator.execute(
      makePublicRequest({
        within: ["/repo/Vendor/libghostty/include"],
        excludePaths: ["generated"],
      }),
    );

    expect(primary.calls[0]?.excludePaths).toEqual(["Vendor/libghostty/include/generated"]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value).toEqual({
      mode: "compact",
      base_path: "/repo/Vendor/libghostty/include",
      next_cursor: null,
      items: [{ path: "ghostty.h" }],
    });
  });

  test("evicts planned persistent runtimes before continuing", async () => {
    let closeCount = 0;
    const runtimeManager = new RuntimeManager();
    await runtimeManager.withRuntime(
      {
        backendId: "fff-node",
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
      backendId: "fff-node",
      execute: async () => okResult("find_files", []),
    });
    const fallback = makeAdapter({
      backendId: "rg",
      execute: async () => okResult("find_files", []),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": primary.adapter,
        rg: fallback.adapter,
      },
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
      runtimeManager,
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
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
      backendId: "fff-node",
      execute: async () => ({
        ok: false as const,
        error: {
          code: "SEARCH_FAILED" as const,
          backendId: "fff-node" as const,
          message: "primary search failed",
        },
      }),
    });
    const fallback = makeAdapter({
      backendId: "rg",
      execute: async () =>
        okResult("find_files", [{ path: "/repo/src/router.ts", relativePath: "src/router.ts" }]),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": primary.adapter,
        rg: fallback.adapter,
      },
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
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
      backendId: "fff-node",
      execute: async () =>
        okResult("find_files", [{ path: "/allow/pkg-a/router.ts", relativePath: "router.ts" }]),
    });
    primary.adapter.startRuntime = async () => ({
      id: "ephemeral-runtime",
      close: async () => {
        throw new Error("close failed");
      },
    });
    const fallback = makeAdapter({
      backendId: "rg",
      execute: async () => okResult("find_files", []),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": primary.adapter,
        rg: fallback.adapter,
      },
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
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

    const result = await coordinator.execute(makePublicRequest({ within: ["/allow/pkg-a"] }));

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
      backendId: "fff-node",
      supportedQueryKinds: ["find_files"],
      execute: async () => okResult("find_files", []),
    });
    const fallback = makeAdapter({
      backendId: "rg",
      supportedQueryKinds: ["find_files"],
      execute: async () => okResult("find_files", []),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": primary.adapter,
        rg: fallback.adapter,
      },
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: [within = "/missing"] }) => ({
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
        patterns: ["router"],
        literal: false,
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
      backendId: "fff-node",
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
      backendId: "rg",
      execute: async () => okResult("grep", []),
    });

    const coordinator = createSearchCoordinator({
      config,
      adapters: {
        "fff-node": primary.adapter,
        rg: fallback.adapter,
      },
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
      runtimeManager: new RuntimeManager(),
      validateWithin: async ({ withinPaths: _withinPaths }) => ({
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
        patterns: ["planRequest"],
        literal: false,
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

    const invalid = await coordinator.execute(makePublicRequest({ within: undefined }));
    expect(invalid.ok).toBe(false);
    if (invalid.ok) throw new Error("expected failure");
    expect(invalid.error.code).toBe("INVALID_REQUEST");
  });
});
