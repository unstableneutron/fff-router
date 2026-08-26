import path from "node:path";
import type {
  BackendSearchRequest,
  BackendSearchResult,
  SearchBackendAdapter,
} from "./adapters/types";
import type { FffMcpRuntime } from "./adapters/fff-mcp-stdio";
import { normalizeRelativePath } from "./adapters/common";
import { decodeCursor, encodeCursor } from "./cursor";
import { resolveSearchPath } from "./resolve-path";
import { validateResolvedWithinPaths } from "./resolve-within";
import { deriveRoutingTarget } from "./routing";
import type { WorkerLease, WorkerPool } from "./runtime-manager";
import type {
  PublicToolRequest,
  PublicToolResult,
  Result,
  RouterConfig,
  RouterError,
  RouterService,
  RouterStatus,
  RoutingTarget,
  ValidatedWithin,
  WorkerDiagnostic,
} from "./types";

export type RouterConfigRef = { current: RouterConfig };

export type RouterServiceDeps = {
  configRef: RouterConfigRef;
  adapter: SearchBackendAdapter<FffMcpRuntime>;
  workerPool: WorkerPool<FffMcpRuntime>;
  validateWithin?: typeof validateResolvedWithinPaths;
  resolvePath?: typeof resolveSearchPath;
  writeDiagnostic?: (event: Record<string, unknown>) => void;
};

class WorkerCallTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`fff-mcp call timed out after ${timeoutMs}ms`);
  }
}

function error(code: RouterError["code"], message: string, retryable?: boolean): Result<never> {
  return {
    ok: false,
    error: { code, message, ...(retryable !== undefined ? { retryable } : {}) },
  };
}

function isStaleWorkerMessage(message: string): boolean {
  return (
    /\b(Not connected|EPIPE|ECONNRESET|EOF)\b/i.test(message) ||
    /\b(transport|stdio|stream)\b.*\b(closed|ended|destroyed|disconnected)\b/i.test(message)
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return await promise;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new WorkerCallTimeoutError(timeoutMs)), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
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
  if (!baseRelative || baseRelative === ".") {
    return excludePaths;
  }
  return excludePaths.map((excludePath) =>
    normalizeRelativePath(path.join(baseRelative, excludePath)),
  );
}

function buildBackendRequest(args: {
  request: PublicToolRequest;
  validatedWithin: ValidatedWithin;
  target: RoutingTarget;
  upstreamCursor: string | null;
}): BackendSearchRequest {
  const base = {
    persistenceRoot: args.target.persistenceRoot,
    within: args.validatedWithin.resolvedWithin,
    basePath: args.validatedWithin.basePath,
    fileRestriction: args.validatedWithin.fileRestriction,
    additionalWithinEntries: args.validatedWithin.additionalEntries ?? [],
    ...(args.request.glob ? { glob: args.request.glob } : {}),
    extensions: args.request.extensions,
    excludePaths: translateExcludePaths(
      args.validatedWithin,
      args.target.persistenceRoot,
      args.request.excludePaths,
    ),
    limit: args.request.limit,
    cursor: args.upstreamCursor,
  };

  return args.request.tool === "find_files"
    ? { ...base, queryKind: "find_files", query: args.request.query }
    : {
        ...base,
        queryKind: "grep",
        patterns: args.request.patterns,
        literal: args.request.literal,
        contextLines: args.request.contextLines,
      };
}

function toPublicResult(args: {
  request: PublicToolRequest;
  target: RoutingTarget;
  lease: WorkerLease<FffMcpRuntime>;
  result: Extract<BackendSearchResult, { ok: true }>["value"];
}): PublicToolResult {
  const nextCursor = args.result.nextCursor
    ? encodeCursor({
        root: args.target.persistenceRoot,
        generation: args.lease.generation,
        request: args.request,
        upstreamCursor: args.result.nextCursor,
      })
    : null;
  const recommendation = args.result.summary?.readRecommendation;
  const readRecommendation = recommendation
    ? {
        path: recommendation.relativePath,
        absolutePath: path.join(args.target.persistenceRoot, recommendation.relativePath),
        ...(recommendation.reason ? { reason: recommendation.reason } : {}),
      }
    : undefined;
  const displayText = args.result.renderedCompact
    ? args.result.renderedCompact
        .split(/\r?\n/)
        .filter((line) => !/^cursor:\s*/.test(line.trim()))
        .concat(nextCursor ? [`cursor: ${nextCursor}`] : [])
        .join("\n")
    : undefined;
  const common = {
    root: args.target.persistenceRoot,
    backend: "fff-mcp" as const,
    nextCursor,
    stats: {
      resultCount: args.result.items.length,
      ...(args.result.summary?.shownCount !== undefined
        ? { upstreamShownCount: args.result.summary.shownCount }
        : {}),
      ...(args.result.summary?.totalCount !== undefined
        ? { upstreamTotalCount: args.result.summary.totalCount }
        : {}),
      coldStart: args.lease.coldStart,
      workerId: args.lease.runtime.id,
      workerGeneration: args.lease.generation,
    },
    ...(readRecommendation ? { readRecommendation } : {}),
    ...(displayText ? { displayText } : {}),
  };

  if (args.request.tool === "find_files") {
    return {
      tool: "find_files",
      ...common,
      items: args.result.items.map((item) => ({
        path: normalizeRelativePath(path.relative(args.target.persistenceRoot, item.path)),
        absolutePath: item.path,
      })),
    };
  }

  return {
    tool: "grep",
    ...common,
    items: args.result.items.map((item) => {
      if (!("line" in item)) {
        throw new Error("fff-mcp returned a file item for grep");
      }
      return {
        path: normalizeRelativePath(path.relative(args.target.persistenceRoot, item.path)),
        absolutePath: item.path,
        line: item.line,
        text: item.text,
        ...(item.column !== undefined ? { column: item.column } : {}),
        ...(item.contextBefore ? { contextBefore: item.contextBefore } : {}),
        ...(item.contextAfter ? { contextAfter: item.contextAfter } : {}),
        ...(item.isDefinition ? { isDefinition: true } : {}),
        ...(item.definitionBody ? { definitionBody: item.definitionBody } : {}),
      };
    }),
  };
}

export class RouterServiceImpl implements RouterService {
  private readonly validateWithin;
  private readonly resolvePath;
  private readonly writeDiagnostic;

  constructor(private readonly deps: RouterServiceDeps) {
    this.validateWithin = deps.validateWithin ?? validateResolvedWithinPaths;
    this.resolvePath = deps.resolvePath ?? resolveSearchPath;
    this.writeDiagnostic =
      deps.writeDiagnostic ??
      ((event) => console.error(JSON.stringify({ event: "fff-router.diagnostic", ...event })));
  }

  private async resolveTarget(
    within: string[],
  ): Promise<Result<{ validatedWithin: ValidatedWithin; target: RoutingTarget }>> {
    const validatedWithin = await this.validateWithin({ withinPaths: within });
    if (!validatedWithin.ok) {
      return validatedWithin;
    }

    const entries = [
      {
        resolvedWithin: validatedWithin.value.resolvedWithin,
        basePath: validatedWithin.value.basePath,
        ...(validatedWithin.value.fileRestriction
          ? { fileRestriction: validatedWithin.value.fileRestriction }
          : {}),
      },
      ...(validatedWithin.value.additionalEntries ?? []),
    ];

    let target: RoutingTarget | undefined;
    for (const entry of entries) {
      const resolved = await this.resolvePath(entry.resolvedWithin);
      if (!resolved.ok) {
        const code =
          resolved.error.code === "SEARCH_PATH_NOT_FOUND"
            ? "WITHIN_NOT_FOUND"
            : resolved.error.code === "OUTSIDE_ALLOWED_SCOPE"
              ? "OUTSIDE_ALLOWED_SCOPE"
              : resolved.error.code === "INVALID_REQUEST"
                ? "INVALID_REQUEST"
                : "INTERNAL_ERROR";
        return error(code, resolved.error.message);
      }
      const routed = deriveRoutingTarget({
        realPath: resolved.value.realPath,
        statType: resolved.value.statType,
        gitRoot: resolved.value.gitRoot,
        config: this.deps.configRef.current,
      });
      if (!routed.ok) {
        return routed;
      }
      if (target && routed.value.persistenceRoot !== target.persistenceRoot) {
        return error(
          "INVALID_REQUEST",
          `within paths must share one routing root; '${entry.resolvedWithin}' routes to '${routed.value.persistenceRoot}', not '${target.persistenceRoot}'`,
        );
      }
      target ??= routed.value;
    }

    return {
      ok: true,
      value: { validatedWithin: validatedWithin.value, target: target! },
    };
  }

  private acquire(target: RoutingTarget) {
    return this.deps.workerPool.acquire({
      root: target.persistenceRoot,
      rootType: target.rootType,
      ttlMs: target.ttlMs,
      start: async () =>
        await this.deps.adapter.startRuntime({
          persistenceRoot: target.persistenceRoot,
        }),
    });
  }

  private async executeAttempt(
    request: PublicToolRequest,
    validatedWithin: ValidatedWithin,
    target: RoutingTarget,
  ): Promise<
    | { kind: "success"; value: PublicToolResult }
    | { kind: "retry"; message: string }
    | { kind: "error"; error: RouterError }
  > {
    const acquired = await this.acquire(target);
    if (!acquired.ok) {
      return { kind: "error", error: acquired.error };
    }
    const lease = acquired.value;
    let invalidateReason: string | undefined;

    try {
      let upstreamCursor: string | null = null;
      if (request.cursor) {
        const decoded = decodeCursor({
          cursor: request.cursor,
          root: target.persistenceRoot,
          generation: lease.generation,
          request,
        });
        if (!decoded.ok) {
          return { kind: "error", error: decoded.error };
        }
        upstreamCursor = decoded.value;
      }

      const backendRequest = buildBackendRequest({
        request,
        validatedWithin,
        target,
        upstreamCursor,
      });
      lease.recordCallStart();

      let backendResult: BackendSearchResult;
      try {
        backendResult = await withTimeout(
          this.deps.adapter.execute({ request: backendRequest, runtime: lease.runtime }),
          this.deps.configRef.current.runtime.toolTimeoutMs,
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        lease.recordCallError(message);
        invalidateReason = message;
        if (caught instanceof WorkerCallTimeoutError) {
          return request.cursor
            ? {
                kind: "error",
                error: {
                  code: "CURSOR_EXPIRED",
                  message: "cursor expired because its worker timed out",
                },
              }
            : { kind: "retry", message };
        }
        return request.cursor
          ? {
              kind: "error",
              error: {
                code: "CURSOR_EXPIRED",
                message: "cursor expired because its worker failed",
              },
            }
          : { kind: "retry", message };
      }

      if (!backendResult.ok) {
        lease.recordCallError(backendResult.error.message);
        if (isStaleWorkerMessage(backendResult.error.message)) {
          invalidateReason = backendResult.error.message;
          return request.cursor
            ? {
                kind: "error",
                error: {
                  code: "CURSOR_EXPIRED",
                  message: "cursor expired because its worker restarted",
                },
              }
            : { kind: "retry", message: backendResult.error.message };
        }
        return {
          kind: "error",
          error: {
            code:
              backendResult.error.code === "WORKER_UNAVAILABLE"
                ? "WORKER_UNAVAILABLE"
                : "SEARCH_FAILED",
            message: backendResult.error.message,
            retryable: backendResult.error.code === "WORKER_UNAVAILABLE",
          },
        };
      }

      lease.recordCallSuccess();
      if (backendResult.value.diagnostics) {
        try {
          this.writeDiagnostic({
            root: target.persistenceRoot,
            tool: request.tool,
            diagnostics: backendResult.value.diagnostics,
          });
        } catch {
          // Diagnostics never affect search results.
        }
      }
      return {
        kind: "success",
        value: toPublicResult({
          request,
          target,
          lease,
          result: backendResult.value,
        }),
      };
    } finally {
      if (invalidateReason) {
        await this.deps.workerPool.invalidate(
          target.persistenceRoot,
          lease.generation,
          invalidateReason,
        );
      }
      await lease.release();
    }
  }

  async execute(request: PublicToolRequest): Promise<Result<PublicToolResult>> {
    const routed = await this.resolveTarget(request.within);
    if (!routed.ok) {
      return routed;
    }

    const first = await this.executeAttempt(
      request,
      routed.value.validatedWithin,
      routed.value.target,
    );
    if (first.kind === "success") {
      return { ok: true, value: first.value };
    }
    if (first.kind === "error") {
      return { ok: false, error: first.error };
    }

    const second = await this.executeAttempt(
      request,
      routed.value.validatedWithin,
      routed.value.target,
    );
    if (second.kind === "success") {
      return { ok: true, value: second.value };
    }
    return {
      ok: false,
      error:
        second.kind === "error"
          ? second.error
          : {
              code: "WORKER_UNAVAILABLE",
              message: `fff-mcp worker failed twice: ${second.message}`,
              retryable: true,
            },
    };
  }

  async warm(within: string[]): Promise<Result<WorkerDiagnostic[]>> {
    const diagnostics: WorkerDiagnostic[] = [];
    const seen = new Set<string>();
    for (const candidate of within) {
      const routed = await this.resolveTarget([candidate]);
      if (!routed.ok) {
        return routed;
      }
      if (seen.has(routed.value.target.persistenceRoot)) {
        continue;
      }
      seen.add(routed.value.target.persistenceRoot);
      const acquired = await this.acquire(routed.value.target);
      if (!acquired.ok) {
        return acquired;
      }
      await acquired.value.release();
      const diagnostic = this.deps.workerPool
        .getDiagnostics()
        .find(
          (entry) => entry.root === routed.value.target.persistenceRoot && entry.state !== "dead",
        );
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    }
    return { ok: true, value: diagnostics };
  }

  async evict(within: string[]): Promise<Result<{ evicted: string[] }>> {
    const evicted: string[] = [];
    const seen = new Set<string>();
    for (const candidate of within) {
      const routed = await this.resolveTarget([candidate]);
      if (!routed.ok) {
        return routed;
      }
      const root = routed.value.target.persistenceRoot;
      if (seen.has(root)) {
        continue;
      }
      seen.add(root);
      if (await this.deps.workerPool.evict(root)) {
        evicted.push(root);
      }
    }
    return { ok: true, value: { evicted } };
  }

  status(): RouterStatus {
    return {
      workers: this.deps.workerPool.getDiagnostics(),
      limits: this.deps.configRef.current.limits,
    };
  }

  async close(): Promise<void> {
    await this.deps.workerPool.closeAll();
  }
}

export function createRouterService(deps: RouterServiceDeps): RouterService {
  return new RouterServiceImpl(deps);
}
