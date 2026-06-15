import type { RuntimeStartSpec, SearchBackendRuntime } from "./adapters/types";
import type { RuntimeRegistryKey, RuntimeRequestKey, SearchBackendId } from "./types";

type RuntimeEntry<TRuntime extends SearchBackendRuntime> = {
  token: symbol;
  runtime?: TRuntime;
  startup?: Promise<TRuntime>;
  detachClose?: () => void;
};

export type RuntimeDiagnostic = {
  key: RuntimeRegistryKey;
  backendId: SearchBackendId;
  persistenceRoot: string;
  state: "starting" | "ready" | "dead";
  runtimeId?: string;
  pid?: number | null;
  uptimeMs?: number;
  lastCallAt?: number;
  lastSuccessAt?: number;
  lastError?: string;
  lastErrorAt?: number;
  restartCount: number;
};

type RuntimeStats = {
  key: RuntimeRegistryKey;
  backendId: SearchBackendId;
  persistenceRoot: string;
  state: RuntimeDiagnostic["state"];
  startedAt?: number;
  runtimeId?: string;
  pid?: number | null;
  lastCallAt?: number;
  lastSuccessAt?: number;
  lastError?: string;
  lastErrorAt?: number;
  restartCount: number;
};

function closeRuntime<TRuntime extends SearchBackendRuntime>(runtime: TRuntime): Promise<void> {
  return Promise.resolve(runtime.close());
}

export function runtimeRegistryKey(
  backendId: SearchBackendId,
  persistenceRoot: string,
): RuntimeRegistryKey {
  return `${backendId}::${persistenceRoot}`;
}

export class RuntimeManager<TRuntime extends SearchBackendRuntime = SearchBackendRuntime> {
  private entries = new Map<RuntimeRegistryKey, RuntimeEntry<TRuntime>>();
  private stats = new Map<RuntimeRegistryKey, RuntimeStats>();
  private mutationLocked = false;
  private waitingMutations: Array<() => void> = [];

  private releaseMutationLock(): void {
    const next = this.waitingMutations.shift();
    if (next) {
      next();
      return;
    }

    this.mutationLocked = false;
  }

  private async withMutationLock<T>(callback: () => T): Promise<T> {
    if (this.mutationLocked) {
      await new Promise<void>((resolve) => {
        this.waitingMutations.push(resolve);
      });
    } else {
      this.mutationLocked = true;
    }

    try {
      return callback();
    } finally {
      this.releaseMutationLock();
    }
  }

  private async markRuntimeClosed(key: RuntimeRegistryKey, token: symbol): Promise<void> {
    await this.withMutationLock(() => {
      const current = this.entries.get(key);
      if (current?.token !== token) {
        return;
      }

      current.detachClose?.();
      this.entries.delete(key);
      this.markStatsDead(key);
    });
  }

  private markStatsDead(key: RuntimeRegistryKey): void {
    const current = this.stats.get(key);
    if (!current) {
      return;
    }

    this.stats.set(key, { ...current, state: "dead" });
  }

  private markStatsStarting(
    key: RuntimeRegistryKey,
    spec: RuntimeStartSpec<TRuntime>,
  ): RuntimeStats {
    const previous = this.stats.get(key);
    const next = {
      ...previous,
      key,
      backendId: spec.backendId,
      persistenceRoot: spec.persistenceRoot,
      state: "starting" as const,
      startedAt: Date.now(),
      restartCount: previous ? previous.restartCount + 1 : 0,
    };
    this.stats.set(key, next);
    return next;
  }

  private createStartupLocked(
    key: RuntimeRegistryKey,
    token: symbol,
    spec: RuntimeStartSpec<TRuntime>,
  ): Promise<TRuntime> {
    this.markStatsStarting(key, spec);
    const created = Promise.resolve(spec.start())
      .then(async (runtime) => {
        let shouldClose = false;
        await this.withMutationLock(() => {
          const current = this.entries.get(key);
          if (!current || current.token !== token) {
            shouldClose = true;
            return;
          }

          const detachClose = runtime.onClose?.(() => {
            void this.markRuntimeClosed(key, token);
          });
          this.entries.set(key, {
            token,
            runtime,
            detachClose,
          });
          const currentStats = this.stats.get(key);
          this.stats.set(key, {
            ...(currentStats ?? {
              key,
              backendId: spec.backendId,
              persistenceRoot: spec.persistenceRoot,
              restartCount: 0,
            }),
            state: "ready",
            runtimeId: runtime.id,
            pid: runtime.pid,
          });
        });

        if (shouldClose) {
          await closeRuntime(runtime);
          throw new Error(`Runtime '${key}' was evicted before startup completed`);
        }

        return runtime;
      })
      .catch(async (error) => {
        await this.withMutationLock(() => {
          const current = this.entries.get(key);
          if (current?.token === token) {
            current.detachClose?.();
            this.entries.delete(key);
          }
        });
        const currentStats = this.stats.get(key);
        this.stats.set(key, {
          ...(currentStats ?? {
            key,
            backendId: spec.backendId,
            persistenceRoot: spec.persistenceRoot,
            restartCount: 0,
          }),
          state: "dead",
          lastError: error instanceof Error ? error.message : String(error),
          lastErrorAt: Date.now(),
        });

        throw error;
      });

    this.entries.set(key, { token, startup: created });
    return created;
  }

  async getOrStartRuntime(spec: RuntimeStartSpec<TRuntime>): Promise<TRuntime> {
    const key = runtimeRegistryKey(spec.backendId, spec.persistenceRoot);

    const startup = await this.withMutationLock(() => {
      const existing = this.entries.get(key);
      if (existing?.runtime) {
        return Promise.resolve(existing.runtime);
      }

      if (existing?.startup) {
        return existing.startup;
      }

      return this.createStartupLocked(key, Symbol(key), spec);
    });

    return startup;
  }

  async restartRuntime(
    spec: RuntimeStartSpec<TRuntime>,
    staleRuntime?: TRuntime,
  ): Promise<TRuntime> {
    const key = runtimeRegistryKey(spec.backendId, spec.persistenceRoot);
    let runtimeToClose: TRuntime | undefined;

    const startup = await this.withMutationLock(() => {
      const existing = this.entries.get(key);

      if (staleRuntime && existing?.startup) {
        return existing.startup;
      }

      if (staleRuntime && existing?.runtime && existing.runtime !== staleRuntime) {
        return Promise.resolve(existing.runtime);
      }

      existing?.detachClose?.();
      runtimeToClose = existing?.runtime;
      return this.createStartupLocked(key, Symbol(key), spec);
    });

    if (runtimeToClose) {
      await closeRuntime(runtimeToClose);
    }

    return startup;
  }

  async withRuntime<TResult>(
    spec: RuntimeStartSpec<TRuntime>,
    execute: (runtime: TRuntime) => Promise<TResult>,
  ): Promise<TResult> {
    const runtime = await this.getOrStartRuntime(spec);
    return await execute(runtime);
  }

  recordRuntimeCallStart(args: RuntimeRequestKey & { at?: number }): void {
    const key = runtimeRegistryKey(args.backendId, args.persistenceRoot);
    const current = this.stats.get(key) ?? {
      key,
      backendId: args.backendId,
      persistenceRoot: args.persistenceRoot,
      state: "dead" as const,
      restartCount: 0,
    };
    this.stats.set(key, {
      ...current,
      lastCallAt: args.at ?? Date.now(),
    });
  }

  recordRuntimeCallSuccess(args: RuntimeRequestKey & { at?: number }): void {
    const key = runtimeRegistryKey(args.backendId, args.persistenceRoot);
    const current = this.stats.get(key) ?? {
      key,
      backendId: args.backendId,
      persistenceRoot: args.persistenceRoot,
      state: "dead" as const,
      restartCount: 0,
    };
    this.stats.set(key, {
      ...current,
      lastSuccessAt: args.at ?? Date.now(),
    });
  }

  recordRuntimeCallError(args: RuntimeRequestKey & { error: string; at?: number }): void {
    const key = runtimeRegistryKey(args.backendId, args.persistenceRoot);
    const current = this.stats.get(key) ?? {
      key,
      backendId: args.backendId,
      persistenceRoot: args.persistenceRoot,
      state: "dead" as const,
      restartCount: 0,
    };
    this.stats.set(key, {
      ...current,
      lastError: args.error,
      lastErrorAt: args.at ?? Date.now(),
    });
  }

  getDiagnostics(now: () => number = Date.now): RuntimeDiagnostic[] {
    return Array.from(this.stats.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((stats) => {
        const entry = this.entries.get(stats.key);
        const state: RuntimeDiagnostic["state"] = entry?.runtime
          ? "ready"
          : entry?.startup
            ? "starting"
            : stats.state;
        const runtime = entry?.runtime;
        return {
          key: stats.key,
          backendId: stats.backendId,
          persistenceRoot: stats.persistenceRoot,
          state,
          ...((runtime?.id ?? stats.runtimeId)
            ? { runtimeId: runtime?.id ?? stats.runtimeId }
            : {}),
          ...(runtime?.pid !== undefined || stats.pid !== undefined
            ? { pid: runtime?.pid ?? stats.pid }
            : {}),
          ...(stats.startedAt !== undefined
            ? { uptimeMs: Math.max(0, now() - stats.startedAt) }
            : {}),
          ...(stats.lastCallAt !== undefined ? { lastCallAt: stats.lastCallAt } : {}),
          ...(stats.lastSuccessAt !== undefined ? { lastSuccessAt: stats.lastSuccessAt } : {}),
          ...(stats.lastError !== undefined ? { lastError: stats.lastError } : {}),
          ...(stats.lastErrorAt !== undefined ? { lastErrorAt: stats.lastErrorAt } : {}),
          restartCount: stats.restartCount,
        };
      });
  }

  async evictRuntime(key: RuntimeRequestKey): Promise<void> {
    const runtime = await this.withMutationLock(() => {
      const registryKey = runtimeRegistryKey(key.backendId, key.persistenceRoot);
      const entry = this.entries.get(registryKey);
      entry?.detachClose?.();
      this.entries.delete(registryKey);
      this.markStatsDead(registryKey);
      return entry?.runtime;
    });

    if (runtime) {
      await closeRuntime(runtime);
    }
  }

  async closeAll(): Promise<void> {
    const runtimes = await this.withMutationLock(() => {
      const collected = Array.from(this.entries.values())
        .map((entry) => entry.runtime)
        .filter((runtime): runtime is TRuntime => runtime != null);
      for (const entry of this.entries.values()) {
        entry.detachClose?.();
      }
      for (const key of this.entries.keys()) {
        this.markStatsDead(key);
      }
      this.entries.clear();
      return collected;
    });

    await Promise.all(runtimes.map((runtime) => closeRuntime(runtime)));
  }
}
