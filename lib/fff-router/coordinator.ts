import path from "node:path";
import { normalizeRelativePath } from "./adapters/common";
import type {
  BackendSearchRequest,
  BackendSearchResult,
  SearchBackendAdapter,
} from "./adapters/types";
import { planRoutingLifecycle } from "./lifecycle";
import { resolveSearchPath } from "./resolve-path";
import { validateResolvedWithin } from "./resolve-within";
import type { RuntimeManager } from "./runtime-manager";
import type {
  DaemonRegistryState,
  PublicToolRequest,
  PublicToolResult,
  RouterConfig,
  RoutingLifecyclePlan,
  SearchBackendId,
  SearchCoordinator,
  SearchCoordinatorResult,
  SearchQueryKind,
  ValidatedWithin,
} from "./types";

export type CoordinatorRuntimeConfig = {
  config: RouterConfig;
  primaryBackendId: SearchBackendId;
  fallbackBackendId: SearchBackendId | null;
};

export type CoordinatorRuntimeConfigRef = {
  current: CoordinatorRuntimeConfig;
};

type CoordinatorDeps = {
  config: RouterConfig;
  adapters: Partial<Record<SearchBackendId, SearchBackendAdapter<any>>>;
  primaryBackendId: SearchBackendId;
  fallbackBackendId: SearchBackendId | null;
  runtimeManager: RuntimeManager<any>;
  liveConfigRef?: CoordinatorRuntimeConfigRef;
  validateWithin?: typeof validateResolvedWithin;
  resolveRoutingPath?: typeof resolveSearchPath;
  planLifecycle?: typeof planRoutingLifecycle;
  now?: () => number;
};

export function createCoordinatorRuntimeConfigRef(
  config: CoordinatorRuntimeConfig,
): CoordinatorRuntimeConfigRef {
  return { current: config };
}

function invalid(message: string): SearchCoordinatorResult {
  return { ok: false, error: { code: "INVALID_REQUEST", message } };
}

function internalError(message: string): SearchCoordinatorResult {
  return { ok: false, error: { code: "INTERNAL_ERROR", message } };
}

function normalizeCoordinatorPath(relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  return normalized === "" ? "." : normalized;
}

function queryKindForRequest(request: PublicToolRequest): SearchQueryKind {
  switch (request.tool) {
    case "fff_find_files":
      return "find_files";
    case "fff_search_terms":
      return "search_terms";
    case "fff_grep":
      return "grep";
  }
}

function translateExcludePaths(
  validatedWithin: ValidatedWithin,
  persistenceRoot: string,
  excludePaths: string[],
): string[] {
  const baseRelative = normalizeRelativePath(
    path.relative(persistenceRoot, validatedWithin.basePath),
  );

  return excludePaths.map((excludePath) => {
    if (!baseRelative || baseRelative === ".") {
      return excludePath;
    }

    return normalizeRelativePath(path.join(baseRelative, excludePath));
  });
}

function buildBackendRequest(args: {
  request: PublicToolRequest;
  validatedWithin: ValidatedWithin;
  persistenceRoot: string;
  backendId: SearchBackendId;
}): BackendSearchRequest {
  const base = {
    backendId: args.backendId,
    persistenceRoot: args.persistenceRoot,
    within: args.validatedWithin.resolvedWithin,
    basePath: args.validatedWithin.basePath,
    fileRestriction: args.validatedWithin.fileRestriction,
    ...(args.request.glob !== undefined ? { glob: args.request.glob } : {}),
    extensions: args.request.extensions,
    excludePaths: translateExcludePaths(
      args.validatedWithin,
      args.persistenceRoot,
      args.request.excludePaths,
    ),
    limit: args.request.limit,
  };

  switch (args.request.tool) {
    case "fff_find_files":
      return { ...base, queryKind: "find_files", query: args.request.query };
    case "fff_search_terms":
      return {
        ...base,
        queryKind: "search_terms",
        terms: args.request.terms,
        contextLines: args.request.contextLines,
      };
    case "fff_grep":
      return {
        ...base,
        queryKind: "grep",
        patterns: args.request.patterns,
        caseSensitive: args.request.caseSensitive,
        contextLines: args.request.contextLines,
      };
  }
}

function shapePublicResult(args: {
  request: PublicToolRequest;
  basePath: string;
  persistenceRoot: string;
  backendUsed: SearchBackendId;
  fallbackApplied: boolean;
  items: Array<Record<string, unknown>>;
  renderedCompact?: string;
  summary?: {
    shownCount?: number;
    totalCount?: number;
    readRecommendation?: {
      relativePath: string;
      reason?: string;
    };
  };
}): PublicToolResult {
  if (args.request.outputMode === "json") {
    const readRecommendation = args.summary?.readRecommendation
      ? (() => {
          const absolutePath = path.join(
            args.persistenceRoot,
            args.summary!.readRecommendation!.relativePath,
          );
          return {
            path: normalizeCoordinatorPath(path.relative(args.basePath, absolutePath)),
            absolute_path: absolutePath,
            ...(args.summary?.readRecommendation?.reason
              ? { reason: args.summary.readRecommendation.reason }
              : {}),
          };
        })()
      : undefined;

    return {
      mode: "json",
      base_path: args.basePath,
      next_cursor: null,
      backend_used: args.backendUsed,
      fallback_applied: args.fallbackApplied,
      ...(args.fallbackApplied ? { fallback_reason: "backend_error" as const } : {}),
      stats: {
        result_count: args.items.length,
        ...(typeof args.summary?.shownCount === "number"
          ? { shown_count: args.summary.shownCount }
          : {}),
        ...(typeof args.summary?.totalCount === "number"
          ? { total_count: args.summary.totalCount }
          : {}),
      },
      ...(readRecommendation ? { read_recommendation: readRecommendation } : {}),
      items: args.items,
    };
  }

  if (
    args.backendUsed === "fff-mcp" &&
    (args.request.tool === "fff_search_terms" || args.request.tool === "fff_grep") &&
    typeof args.renderedCompact === "string" &&
    args.renderedCompact.length > 0
  ) {
    return {
      mode: "compact",
      base_path: args.basePath,
      next_cursor: null,
      text: args.renderedCompact,
    };
  }

  switch (args.request.tool) {
    case "fff_find_files":
      return {
        mode: "compact",
        base_path: args.basePath,
        next_cursor: null,
        items: args.items.map((item) => ({ path: String(item.path) })),
      };
    case "fff_search_terms":
    case "fff_grep":
      return {
        mode: "compact",
        base_path: args.basePath,
        next_cursor: null,
        items: args.items.map((item) => ({
          path: String(item.path),
          line: Number(item.line),
          text: String(item.text),
        })),
      };
  }
}

function normalizeBackendItems(
  basePath: string,
  items: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return items.map((item) => {
    const absolutePath = String(item.path);
    const normalized = {
      ...item,
      path: normalizeCoordinatorPath(path.relative(basePath, absolutePath)),
    };

    if (typeof item.line === "number") {
      return {
        path: normalized.path,
        absolute_path: absolutePath,
        line: item.line,
        text: item.text,
        ...(typeof item.column === "number" ? { column: item.column } : {}),
        ...(Array.isArray(item.contextBefore) ? { context_before: item.contextBefore } : {}),
        ...(Array.isArray(item.contextAfter) ? { context_after: item.contextAfter } : {}),
        ...(item.isDefinition === true ? { is_definition: true } : {}),
        ...(Array.isArray(item.definitionBody) ? { definition_body: item.definitionBody } : {}),
      };
    }

    return {
      path: normalized.path,
      absolute_path: absolutePath,
    };
  });
}

export class SearchCoordinatorImpl implements SearchCoordinator {
  private lifecycleState: DaemonRegistryState = {
    daemons: {},
    nonGitRecentHits: {},
    now: 0,
  };
  private planningLocked = false;
  private planningWaiters: Array<() => void> = [];
  private readonly validateWithin;
  private readonly resolveRoutingPath;
  private readonly planLifecycle;
  private readonly now;

  constructor(private readonly deps: CoordinatorDeps) {
    this.validateWithin = deps.validateWithin ?? validateResolvedWithin;
    this.resolveRoutingPath = deps.resolveRoutingPath ?? resolveSearchPath;
    this.planLifecycle = deps.planLifecycle ?? planRoutingLifecycle;
    this.now = deps.now ?? Date.now;
  }

  private releasePlanningLock(): void {
    const next = this.planningWaiters.shift();
    if (next) {
      next();
      return;
    }

    this.planningLocked = false;
  }

  private async withPlanningLock<T>(callback: () => Promise<T>): Promise<T> {
    if (this.planningLocked) {
      await new Promise<void>((resolve) => {
        this.planningWaiters.push(resolve);
      });
    } else {
      this.planningLocked = true;
    }

    try {
      return await callback();
    } finally {
      this.releasePlanningLock();
    }
  }

  private getRuntimeConfig(): CoordinatorRuntimeConfig {
    return (
      this.deps.liveConfigRef?.current ?? {
        config: this.deps.config,
        primaryBackendId: this.deps.primaryBackendId,
        fallbackBackendId: this.deps.fallbackBackendId,
      }
    );
  }

  private syncLifecycleTtls(config: RouterConfig): void {
    const nextDaemons = Object.fromEntries(
      Object.entries(this.lifecycleState.daemons).map(([key, daemon]) => [
        key,
        {
          ...daemon,
          ttlMs: daemon.rootType === "git" ? config.ttl.gitMs : config.ttl.nonGitMs,
        },
      ]),
    );

    this.lifecycleState = {
      ...this.lifecycleState,
      daemons: nextDaemons,
    };
  }

  private async rollbackPersistentLifecycle(key: string): Promise<void> {
    await this.withPlanningLock(async () => {
      const nextDaemons = { ...this.lifecycleState.daemons };
      delete nextDaemons[key];
      this.lifecycleState = {
        ...this.lifecycleState,
        daemons: nextDaemons,
      };
    });
  }

  private async applyLifecycleEvictions(evicted: string[]): Promise<void> {
    const persistentBackendIds = Object.values(this.deps.adapters)
      .filter((adapter) => typeof adapter.startRuntime === "function")
      .map((adapter) => adapter.backendId);

    await Promise.all(
      evicted.flatMap((persistenceRoot) =>
        persistentBackendIds.map((backendId) =>
          this.deps.runtimeManager.evictRuntime({
            backendId,
            persistenceRoot,
          }),
        ),
      ),
    );
  }

  private getAdapter(backendId: SearchBackendId): SearchBackendAdapter<any> {
    const adapter = this.deps.adapters[backendId];
    if (!adapter) {
      throw new Error(`No adapter registered for backend '${backendId}'`);
    }
    return adapter;
  }

  private async executeWithAdapter(args: {
    adapter: SearchBackendAdapter;
    request: BackendSearchRequest;
    lifecyclePlan: RoutingLifecyclePlan;
  }): Promise<BackendSearchResult> {
    const shouldUsePersistentRuntime = args.lifecyclePlan.action.type !== "run-ephemeral";

    if (!args.adapter.supportedQueryKinds.includes(args.request.queryKind)) {
      return {
        ok: false,
        error: {
          code: "SEARCH_FAILED",
          backendId: args.adapter.backendId,
          message: `${args.adapter.backendId} does not support ${args.request.queryKind}`,
        },
      };
    }

    if (!args.adapter.startRuntime) {
      return args.adapter.execute({ request: args.request });
    }

    if (!shouldUsePersistentRuntime) {
      try {
        const runtime = await args.adapter.startRuntime({
          backendId: args.adapter.backendId,
          persistenceRoot: args.request.persistenceRoot,
        });
        const result = await args.adapter.execute({
          request: args.request,
          runtime,
        });
        try {
          await runtime.close();
        } catch {
          // Best-effort cleanup for ephemeral runtimes. Preserve the search result.
        }
        return result;
      } catch (error) {
        return {
          ok: false,
          error: {
            code: "BACKEND_UNAVAILABLE",
            backendId: args.adapter.backendId,
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    }

    try {
      return await this.deps.runtimeManager.withRuntime(
        {
          backendId: args.adapter.backendId,
          persistenceRoot: args.request.persistenceRoot,
          start: async () => {
            return await args.adapter.startRuntime?.({
              backendId: args.adapter.backendId,
              persistenceRoot: args.request.persistenceRoot,
            });
          },
        },
        async (runtime) => {
          return await args.adapter.execute({ request: args.request, runtime });
        },
      );
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "BACKEND_UNAVAILABLE",
          backendId: args.adapter.backendId,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  async execute(request: PublicToolRequest): Promise<SearchCoordinatorResult> {
    if (!request.within) {
      return invalid("within must be resolved client-side before reaching the coordinator");
    }

    const queryKind = queryKindForRequest(request);
    const runtimeConfig = this.getRuntimeConfig();
    const primaryAdapter = this.getAdapter(runtimeConfig.primaryBackendId);
    if (!primaryAdapter.supportedQueryKinds.includes(queryKind)) {
      return {
        ok: false,
        error: {
          code: "SEARCH_FAILED",
          message: `${primaryAdapter.backendId} does not support ${queryKind}`,
        },
      };
    }

    const validatedWithin = await this.validateWithin({
      within: request.within,
    });
    if (!validatedWithin.ok) {
      return validatedWithin;
    }

    const resolvedPath = await this.resolveRoutingPath(validatedWithin.value.resolvedWithin);
    if (!resolvedPath.ok) {
      switch (resolvedPath.error.code) {
        case "OUTSIDE_ALLOWED_SCOPE":
        case "INVALID_REQUEST":
          return {
            ok: false,
            error: {
              code: resolvedPath.error.code,
              message: resolvedPath.error.message,
            },
          };
        case "SEARCH_PATH_NOT_FOUND":
          return {
            ok: false,
            error: {
              code: "WITHIN_NOT_FOUND",
              message: resolvedPath.error.message,
            },
          };
        default:
          return internalError(resolvedPath.error.message);
      }
    }

    const lifecyclePlan = await this.withPlanningLock(async () => {
      this.syncLifecycleTtls(runtimeConfig.config);
      const nextState: DaemonRegistryState = {
        ...this.lifecycleState,
        now: this.now(),
      };
      const plan = this.planLifecycle({
        queryKind,
        realPath: resolvedPath.value.realPath,
        statType: resolvedPath.value.statType,
        gitRoot: resolvedPath.value.gitRoot,
        config: runtimeConfig.config,
        state: nextState,
      });
      if (!plan.ok) {
        return plan;
      }

      this.lifecycleState = plan.value.nextState;
      await this.applyLifecycleEvictions(plan.value.evicted);
      return plan;
    });
    if (!lifecyclePlan.ok) {
      return {
        ok: false,
        error: {
          code:
            lifecyclePlan.error.code === "OUTSIDE_ALLOWED_SCOPE"
              ? "OUTSIDE_ALLOWED_SCOPE"
              : "INVALID_REQUEST",
          message: lifecyclePlan.error.message,
        },
      };
    }

    const primaryRequest = buildBackendRequest({
      request,
      validatedWithin: validatedWithin.value,
      persistenceRoot: lifecyclePlan.value.target.persistenceRoot,
      backendId: primaryAdapter.backendId,
    });
    const primaryResult = await this.executeWithAdapter({
      adapter: primaryAdapter,
      request: primaryRequest,
      lifecyclePlan: lifecyclePlan.value,
    });

    if (primaryResult.ok) {
      const normalizedItems = normalizeBackendItems(
        validatedWithin.value.basePath,
        primaryResult.value.items as Array<Record<string, unknown>>,
      );
      return {
        ok: true,
        value: shapePublicResult({
          request,
          basePath: validatedWithin.value.basePath,
          persistenceRoot: lifecyclePlan.value.target.persistenceRoot,
          backendUsed: primaryResult.value.backendId,
          fallbackApplied: false,
          items: normalizedItems,
          renderedCompact: primaryResult.value.renderedCompact,
          summary: primaryResult.value.summary,
        }),
      };
    }

    if (
      lifecyclePlan.value.action.type === "start-persistent" &&
      primaryResult.error.code === "BACKEND_UNAVAILABLE"
    ) {
      await this.rollbackPersistentLifecycle(lifecyclePlan.value.action.key);
    }

    if (primaryResult.error.code !== "BACKEND_UNAVAILABLE") {
      return {
        ok: false,
        error: {
          code: primaryResult.error.code,
          message: primaryResult.error.message,
        },
      };
    }

    if (!runtimeConfig.fallbackBackendId) {
      return {
        ok: false,
        error: {
          code: primaryResult.error.code,
          message: primaryResult.error.message,
        },
      };
    }

    const fallbackAdapter = this.getAdapter(runtimeConfig.fallbackBackendId);
    const fallbackRequest = buildBackendRequest({
      request,
      validatedWithin: validatedWithin.value,
      persistenceRoot: lifecyclePlan.value.target.persistenceRoot,
      backendId: fallbackAdapter.backendId,
    });
    const fallbackResult = await this.executeWithAdapter({
      adapter: fallbackAdapter,
      request: fallbackRequest,
      lifecyclePlan: {
        ...lifecyclePlan.value,
        action: { type: "run-ephemeral", key: lifecyclePlan.value.action.key },
      },
    });
    if (!fallbackResult.ok) {
      return {
        ok: false,
        error: {
          code:
            primaryResult.error.code === "BACKEND_UNAVAILABLE" &&
            fallbackResult.error.code === "BACKEND_UNAVAILABLE"
              ? "BACKEND_UNAVAILABLE"
              : "SEARCH_FAILED",
          message: fallbackResult.error.message,
        },
      };
    }

    const normalizedItems = normalizeBackendItems(
      validatedWithin.value.basePath,
      fallbackResult.value.items as Array<Record<string, unknown>>,
    );
    return {
      ok: true,
      value: shapePublicResult({
        request,
        basePath: validatedWithin.value.basePath,
        persistenceRoot: lifecyclePlan.value.target.persistenceRoot,
        backendUsed: fallbackResult.value.backendId,
        fallbackApplied: true,
        items: normalizedItems,
        renderedCompact: fallbackResult.value.renderedCompact,
        summary: fallbackResult.value.summary,
      }),
    };
  }
}

export function createSearchCoordinator(deps: CoordinatorDeps): SearchCoordinator {
  return new SearchCoordinatorImpl(deps);
}
