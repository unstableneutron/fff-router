import type { SearchBackendRuntime } from "./adapters/types";
import type { Result, RouterError, WorkerDiagnostic } from "./types";

type RootType = "git" | "non-git";

export type WorkerPoolOptions = {
  maxWorkers: number;
  maxNonGitWorkers: number;
  sweepIntervalMs: number;
  restartBackoffMs: number;
  maxDeadDiagnostics?: number;
  now?: () => number;
};

export type WorkerStartSpec<TRuntime extends SearchBackendRuntime> = {
  root: string;
  rootType: RootType;
  ttlMs: number;
  start: () => Promise<TRuntime>;
};

type WorkerEntry<TRuntime extends SearchBackendRuntime> = {
  token: symbol;
  root: string;
  rootType: RootType;
  state: WorkerDiagnostic["state"];
  generation: number;
  activeLeases: number;
  ttlMs: number;
  createdAt: number;
  lastUsedAt: number;
  startedAt?: number;
  lastCallAt?: number;
  lastSuccessAt?: number;
  lastError?: string;
  lastErrorAt?: number;
  failureCount: number;
  retryAfter?: number;
  runtime?: TRuntime;
  startup?: Promise<TRuntime>;
  detachClose?: () => void;
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

function unavailable(message: string, retryable = true): Result<never, RouterError> {
  return {
    ok: false,
    error: { code: "WORKER_UNAVAILABLE", message, retryable },
  };
}

async function closeBestEffort(runtime: SearchBackendRuntime | undefined): Promise<void> {
  if (!runtime) {
    return;
  }
  await Promise.resolve(runtime.close()).catch(() => {});
}

export class WorkerPool<TRuntime extends SearchBackendRuntime = SearchBackendRuntime> {
  private readonly entries = new Map<string, WorkerEntry<TRuntime>>();
  private readonly deadDiagnostics: WorkerDiagnostic[] = [];
  private readonly now: () => number;
  private sweepTimer: ReturnType<typeof setInterval>;
  private generation = 0;
  private closed = false;

  constructor(private options: WorkerPoolOptions) {
    this.now = options.now ?? Date.now;
    this.sweepTimer = this.createSweepTimer(options.sweepIntervalMs);
  }

  private createSweepTimer(intervalMs: number): ReturnType<typeof setInterval> {
    const timer = setInterval(() => void this.sweep(), Math.max(100, intervalMs));
    timer.unref?.();
    return timer;
  }

  updateOptions(options: WorkerPoolOptions, ttl?: { gitMs: number; nonGitMs: number }): void {
    if (!this.closed && options.sweepIntervalMs !== this.options.sweepIntervalMs) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = this.createSweepTimer(options.sweepIntervalMs);
    }
    this.options = { ...options, now: this.options.now };
    if (ttl) {
      for (const entry of this.entries.values()) {
        entry.ttlMs = entry.rootType === "git" ? ttl.gitMs : ttl.nonGitMs;
      }
    }
  }

  private toDiagnostic(entry: WorkerEntry<TRuntime>): WorkerDiagnostic {
    return {
      root: entry.root,
      rootType: entry.rootType,
      state: entry.state,
      ...(entry.runtime?.id ? { workerId: entry.runtime.id } : {}),
      ...(entry.runtime?.pid !== undefined ? { pid: entry.runtime.pid } : {}),
      generation: entry.generation,
      activeLeases: entry.activeLeases,
      ...(entry.startedAt !== undefined ? { startedAt: entry.startedAt } : {}),
      lastUsedAt: entry.lastUsedAt,
      ...(entry.lastCallAt !== undefined ? { lastCallAt: entry.lastCallAt } : {}),
      ...(entry.lastSuccessAt !== undefined ? { lastSuccessAt: entry.lastSuccessAt } : {}),
      ...(entry.lastError !== undefined ? { lastError: entry.lastError } : {}),
      ...(entry.lastErrorAt !== undefined ? { lastErrorAt: entry.lastErrorAt } : {}),
      failureCount: entry.failureCount,
      ...(entry.retryAfter !== undefined ? { retryAfter: entry.retryAfter } : {}),
    };
  }

  private rememberDead(entry: WorkerEntry<TRuntime>): void {
    const diagnostic = this.toDiagnostic({ ...entry, state: "dead" });
    this.deadDiagnostics.unshift(diagnostic);
    this.deadDiagnostics.splice(this.options.maxDeadDiagnostics ?? 32);
  }

  private activeEntries(rootType?: RootType): WorkerEntry<TRuntime>[] {
    return [...this.entries.values()].filter(
      (entry) => entry.state !== "dead" && (rootType === undefined || entry.rootType === rootType),
    );
  }

  private removeIdleLru(rootType?: RootType): TRuntime | undefined {
    const candidate = this.activeEntries(rootType)
      .filter((entry) => entry.activeLeases === 0 && entry.state !== "starting")
      .sort((left, right) => left.lastUsedAt - right.lastUsedAt)[0];
    if (!candidate) {
      return undefined;
    }
    candidate.detachClose?.();
    candidate.state = "draining";
    this.entries.delete(candidate.root);
    return candidate.runtime;
  }

  private reserveCapacity(rootType: RootType): Result<TRuntime[], RouterError> {
    const toClose: TRuntime[] = [];

    if (
      rootType === "non-git" &&
      this.activeEntries("non-git").length >= this.options.maxNonGitWorkers
    ) {
      const runtime = this.removeIdleLru("non-git");
      if (!runtime) {
        return {
          ok: false,
          error: {
            code: "WORKER_LIMIT_REACHED",
            message: "all non-Git worker slots are busy",
            retryable: true,
          },
        };
      }
      toClose.push(runtime);
    }

    if (this.activeEntries().length >= this.options.maxWorkers) {
      const runtime = this.removeIdleLru();
      if (!runtime) {
        return {
          ok: false,
          error: {
            code: "WORKER_LIMIT_REACHED",
            message: "all fff-mcp worker slots are busy",
            retryable: true,
          },
        };
      }
      toClose.push(runtime);
    }

    return { ok: true, value: toClose };
  }

  private createEntry(
    spec: WorkerStartSpec<TRuntime>,
    previousFailures = 0,
  ): WorkerEntry<TRuntime> {
    const now = this.now();
    const entry: WorkerEntry<TRuntime> = {
      token: Symbol(spec.root),
      root: spec.root,
      rootType: spec.rootType,
      state: "starting",
      generation: ++this.generation,
      activeLeases: 0,
      ttlMs: spec.ttlMs,
      createdAt: now,
      lastUsedAt: now,
      failureCount: previousFailures,
    };

    entry.startup = Promise.resolve()
      .then(spec.start)
      .then(async (runtime) => {
        const current = this.entries.get(spec.root);
        if (this.closed || current?.token !== entry.token) {
          await closeBestEffort(runtime);
          throw new Error(`worker for '${spec.root}' was evicted during startup`);
        }
        const draining = entry.state === "draining";
        entry.runtime = runtime;
        entry.startup = undefined;
        entry.state = draining ? "draining" : "ready";
        entry.startedAt = this.now();
        entry.retryAfter = undefined;
        entry.detachClose = runtime.onClose?.(() => {
          this.markUnexpectedClose(spec.root, entry.token);
        });
        return runtime;
      })
      .catch((error) => {
        const current = this.entries.get(spec.root);
        if (current?.token === entry.token) {
          const now = this.now();
          entry.startup = undefined;
          entry.state = "dead";
          entry.lastError = error instanceof Error ? error.message : String(error);
          entry.lastErrorAt = now;
          entry.failureCount += 1;
          entry.retryAfter = now + this.options.restartBackoffMs * entry.failureCount;
        }
        throw error;
      });

    this.entries.set(spec.root, entry);
    return entry;
  }

  private markUnexpectedClose(root: string, token: symbol): void {
    const entry = this.entries.get(root);
    if (!entry || entry.token !== token || entry.state === "draining") {
      return;
    }
    const now = this.now();
    entry.detachClose?.();
    entry.detachClose = undefined;
    entry.runtime = undefined;
    entry.state = "dead";
    entry.lastError = "fff-mcp worker exited unexpectedly";
    entry.lastErrorAt = now;
    entry.failureCount += 1;
    entry.retryAfter = now + this.options.restartBackoffMs * entry.failureCount;
  }

  async acquire(
    spec: WorkerStartSpec<TRuntime>,
  ): Promise<Result<WorkerLease<TRuntime>, RouterError>> {
    if (this.closed) {
      return unavailable("worker pool is closed", false);
    }

    const now = this.now();
    let entry = this.entries.get(spec.root);
    let coldStart = false;
    let runtimesToClose: TRuntime[] = [];
    let previousFailures = 0;

    if (entry?.state === "dead") {
      if (entry.activeLeases > 0 || (entry.retryAfter ?? 0) > now) {
        return unavailable(
          `fff-mcp worker for '${spec.root}' is backing off after ${entry.failureCount} failure(s)`,
        );
      }
      previousFailures = entry.failureCount;
      this.rememberDead(entry);
      this.entries.delete(spec.root);
      entry = undefined;
    }

    if (entry?.state === "draining") {
      return unavailable(`fff-mcp worker for '${spec.root}' is draining`);
    }

    if (!entry) {
      const capacity = this.reserveCapacity(spec.rootType);
      if (!capacity.ok) {
        return capacity;
      }
      runtimesToClose = capacity.value;
      const start = spec.start;
      entry = this.createEntry(
        {
          ...spec,
          start: async () => {
            await Promise.all(runtimesToClose.map(closeBestEffort));
            return await start();
          },
        },
        previousFailures,
      );
      coldStart = true;
    }

    entry.activeLeases += 1;
    entry.lastUsedAt = now;
    entry.ttlMs = spec.ttlMs;

    let runtime: TRuntime;
    try {
      runtime = entry.runtime ?? (await entry.startup!);
    } catch (error) {
      await this.release(entry.root, entry.token);
      return unavailable(error instanceof Error ? error.message : String(error));
    }

    const token = entry.token;
    const generation = entry.generation;
    let released = false;
    return {
      ok: true,
      value: {
        root: entry.root,
        rootType: entry.rootType,
        runtime,
        generation,
        coldStart,
        recordCallStart: () => {
          const current = this.entries.get(entry!.root);
          if (current?.token === token) {
            current.lastCallAt = this.now();
          }
        },
        recordCallSuccess: () => {
          const current = this.entries.get(entry!.root);
          if (current?.token === token) {
            current.lastSuccessAt = this.now();
            current.failureCount = 0;
          }
        },
        recordCallError: (error) => {
          const current = this.entries.get(entry!.root);
          if (current?.token === token) {
            current.lastError = error;
            current.lastErrorAt = this.now();
          }
        },
        release: async () => {
          if (released) {
            return;
          }
          released = true;
          await this.release(entry!.root, token);
        },
      },
    };
  }

  private async release(root: string, token: symbol): Promise<void> {
    const entry = this.entries.get(root);
    if (!entry || entry.token !== token) {
      return;
    }
    entry.activeLeases = Math.max(0, entry.activeLeases - 1);
    entry.lastUsedAt = this.now();
    if (entry.activeLeases === 0 && entry.state === "draining") {
      entry.detachClose?.();
      this.entries.delete(root);
      this.rememberDead(entry);
      await closeBestEffort(entry.runtime);
    }
  }

  async invalidate(root: string, generation: number, reason: string): Promise<void> {
    const entry = this.entries.get(root);
    if (!entry || entry.generation !== generation) {
      return;
    }
    entry.lastError = reason;
    entry.lastErrorAt = this.now();
    entry.failureCount += 1;
    entry.state = "draining";
    if (entry.activeLeases === 0) {
      entry.detachClose?.();
      this.entries.delete(root);
      this.rememberDead(entry);
      await closeBestEffort(entry.runtime);
    }
  }

  async evict(root: string): Promise<boolean> {
    const entry = this.entries.get(root);
    if (!entry) {
      return false;
    }
    entry.state = "draining";
    if (entry.activeLeases === 0) {
      entry.detachClose?.();
      this.entries.delete(root);
      this.rememberDead(entry);
      await closeBestEffort(entry.runtime);
    }
    return true;
  }

  async evictAll(): Promise<void> {
    await Promise.all([...this.entries.keys()].map((root) => this.evict(root)));
  }

  async sweep(): Promise<void> {
    if (this.closed) {
      return;
    }
    const now = this.now();
    const expired = [...this.entries.values()].filter(
      (entry) =>
        entry.state === "ready" &&
        entry.activeLeases === 0 &&
        entry.lastUsedAt + entry.ttlMs <= now,
    );
    await Promise.all(expired.map((entry) => this.evict(entry.root)));

    const capacityClosures: TRuntime[] = [];
    while (this.activeEntries("non-git").length > this.options.maxNonGitWorkers) {
      const runtime = this.removeIdleLru("non-git");
      if (!runtime) {
        break;
      }
      capacityClosures.push(runtime);
    }
    while (this.activeEntries().length > this.options.maxWorkers) {
      const runtime = this.removeIdleLru();
      if (!runtime) {
        break;
      }
      capacityClosures.push(runtime);
    }
    await Promise.all(capacityClosures.map(closeBestEffort));
  }

  getDiagnostics(): WorkerDiagnostic[] {
    return [
      ...[...this.entries.values()]
        .sort((left, right) => left.root.localeCompare(right.root))
        .map((entry) => this.toDiagnostic(entry)),
      ...this.deadDiagnostics,
    ];
  }

  async closeAll(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    clearInterval(this.sweepTimer);
    const entries = [...this.entries.values()];
    this.entries.clear();
    for (const entry of entries) {
      entry.detachClose?.();
      entry.state = "draining";
    }
    await Promise.all(entries.map((entry) => closeBestEffort(entry.runtime)));
    await Promise.all(entries.map((entry) => entry.startup?.catch(() => {})));
  }
}
