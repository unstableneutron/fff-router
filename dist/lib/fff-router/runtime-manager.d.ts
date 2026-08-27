import type { SearchBackendRuntime } from "./adapters/types";
import type { Result, RouterError, WorkerDiagnostic } from "./types";
type RootType = "git" | "non-git";
export type WorkerPoolOptions = {
    maxWorkers: number;
    maxNonGitWorkers: number;
    sweepIntervalMs: number;
    restartBackoffMs: number;
    restartBackoffMaxMs?: number;
    maxTotalWorkerRssBytes?: number;
    maxDeadDiagnostics?: number;
    now?: () => number;
};
export type WorkerStartSpec<TRuntime extends SearchBackendRuntime> = {
    root: string;
    rootType: RootType;
    ttlMs: number;
    start: () => Promise<TRuntime>;
};
export type WorkerLease<TRuntime extends SearchBackendRuntime> = {
    root: string;
    rootType: RootType;
    runtime: TRuntime;
    generation: number;
    coldStart: boolean;
    recordCallStart: () => void;
    recordCallSuccess: () => void;
    recordCallError: (error: string) => void;
    release: () => Promise<void>;
};
export declare class WorkerPool<TRuntime extends SearchBackendRuntime = SearchBackendRuntime> {
    private options;
    private readonly entries;
    private readonly deadDiagnostics;
    private readonly now;
    private sweepTimer;
    private generation;
    private closed;
    constructor(options: WorkerPoolOptions);
    private scheduleSweep;
    updateOptions(options: WorkerPoolOptions, ttl?: {
        gitMs: number;
        nonGitMs: number;
    }): void;
    private toDiagnostic;
    private restartDelay;
    private rememberDead;
    private detachRuntimeObservers;
    private activeEntries;
    private removeIdleLru;
    private reserveCapacity;
    private createEntry;
    private markUnexpectedClose;
    acquire(spec: WorkerStartSpec<TRuntime>): Promise<Result<WorkerLease<TRuntime>, RouterError>>;
    private release;
    invalidate(root: string, generation: number, reason: string): Promise<void>;
    evict(root: string): Promise<boolean>;
    evictAll(): Promise<void>;
    sweep(): Promise<void>;
    getDiagnostics(): WorkerDiagnostic[];
    getResourceSummary(): {
        sampledAt: number;
        workerRssBytes: number;
        measuredWorkers: number;
    };
    getLiveWorkerCount(): number;
    getActiveLeaseCount(): number;
    closeAll(): Promise<void>;
}
export {};
