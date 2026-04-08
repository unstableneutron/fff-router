import type { RuntimeStartSpec, SearchBackendRuntime } from "./adapters/types";
import type { RuntimeRegistryKey, RuntimeRequestKey, SearchBackendId } from "./types";

type RuntimeEntry<TRuntime extends SearchBackendRuntime> = {
  token: symbol;
  runtime?: TRuntime;
  startup?: Promise<TRuntime>;
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

      const token = Symbol(key);

      const created = Promise.resolve(spec.start())
        .then(async (runtime) => {
          let shouldClose = false;
          await this.withMutationLock(() => {
            const current = this.entries.get(key);
            if (!current || current.token !== token) {
              shouldClose = true;
              return;
            }

            this.entries.set(key, {
              token,
              runtime,
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
              this.entries.delete(key);
            }
          });

          throw error;
        });

      this.entries.set(key, { token, startup: created });
      return created;
    });

    return startup;
  }

  async withRuntime<TResult>(
    spec: RuntimeStartSpec<TRuntime>,
    execute: (runtime: TRuntime) => Promise<TResult>,
  ): Promise<TResult> {
    const runtime = await this.getOrStartRuntime(spec);
    return await execute(runtime);
  }

  async evictRuntime(key: RuntimeRequestKey): Promise<void> {
    const runtime = await this.withMutationLock(() => {
      const registryKey = runtimeRegistryKey(key.backendId, key.persistenceRoot);
      const entry = this.entries.get(registryKey);
      this.entries.delete(registryKey);
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
      this.entries.clear();
      return collected;
    });

    await Promise.all(runtimes.map((runtime) => closeRuntime(runtime)));
  }
}
