import type { SearchBackendAdapter } from "./adapters/types";
import type { FffMcpRuntime } from "./adapters/fff-mcp-stdio";
import { resolveSearchPath } from "./resolve-path";
import { validateResolvedWithinPaths } from "./resolve-within";
import type { WorkerPool } from "./runtime-manager";
import type { PublicToolRequest, PublicToolResult, Result, RouterConfig, RouterService, RouterStatus, WorkerDiagnostic } from "./types";
export type RouterConfigRef = {
    current: RouterConfig;
};
export type RouterServiceDeps = {
    configRef: RouterConfigRef;
    adapter: SearchBackendAdapter<FffMcpRuntime>;
    workerPool: WorkerPool<FffMcpRuntime>;
    validateWithin?: typeof validateResolvedWithinPaths;
    resolvePath?: typeof resolveSearchPath;
    writeDiagnostic?: (event: Record<string, unknown>) => void;
};
export declare class RouterServiceImpl implements RouterService {
    private readonly deps;
    private readonly validateWithin;
    private readonly resolvePath;
    private readonly writeDiagnostic;
    constructor(deps: RouterServiceDeps);
    private resolveTarget;
    private acquire;
    private executeAttempt;
    execute(request: PublicToolRequest): Promise<Result<PublicToolResult>>;
    warm(within: string[]): Promise<Result<WorkerDiagnostic[]>>;
    evict(within: string[]): Promise<Result<{
        evicted: string[];
    }>>;
    status(): RouterStatus;
    close(): Promise<void>;
}
export declare function createRouterService(deps: RouterServiceDeps): RouterService;
