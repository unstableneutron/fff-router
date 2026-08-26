import { describe, expect, test, vi } from "vitest";
import { WorkerPool } from "./runtime-manager";
import type { SearchBackendRuntime } from "./adapters/types";

type FakeRuntime = SearchBackendRuntime & {
  closed: boolean;
  triggerClose: () => void;
};

function runtime(id: string): FakeRuntime {
  let closeHandler: (() => void) | undefined;
  return {
    id,
    closed: false,
    async close() {
      this.closed = true;
    },
    onClose(handler) {
      closeHandler = handler;
      return () => {
        closeHandler = undefined;
      };
    },
    triggerClose() {
      closeHandler?.();
    },
  };
}

function pool(overrides: Partial<ConstructorParameters<typeof WorkerPool<FakeRuntime>>[0]> = {}) {
  return new WorkerPool<FakeRuntime>({
    maxWorkers: 3,
    maxNonGitWorkers: 1,
    sweepIntervalMs: 60_000,
    restartBackoffMs: 100,
    ...overrides,
  });
}

describe("WorkerPool", () => {
  test("deduplicates concurrent startup and leases one warm worker", async () => {
    const workers = pool();
    let releaseStart!: (value: FakeRuntime) => void;
    const start = vi.fn(
      async () =>
        await new Promise<FakeRuntime>((resolve) => {
          releaseStart = resolve;
        }),
    );

    const firstPromise = workers.acquire({ root: "/a", rootType: "git", ttlMs: 1_000, start });
    const secondPromise = workers.acquire({ root: "/a", rootType: "git", ttlMs: 1_000, start });
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    releaseStart(runtime("a"));
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(start).toHaveBeenCalledTimes(1);
    expect(first.ok && second.ok && first.value.runtime).toBe(second.ok && second.value.runtime);
    expect(workers.getDiagnostics()[0]).toMatchObject({ state: "ready", activeLeases: 2 });
    if (first.ok) await first.value.release();
    if (second.ok) await second.value.release();
    await workers.closeAll();
  });

  test("never closes an actively leased worker", async () => {
    const workers = pool({ maxWorkers: 1 });
    const activeRuntime = runtime("a");
    const active = await workers.acquire({
      root: "/a",
      rootType: "git",
      ttlMs: 1_000,
      start: async () => activeRuntime,
    });
    expect(await workers.evict("/a")).toBe(true);
    expect(activeRuntime.closed).toBe(false);
    expect(workers.getDiagnostics()[0]).toMatchObject({ state: "draining", activeLeases: 1 });
    if (active.ok) await active.value.release();
    expect(activeRuntime.closed).toBe(true);
    await workers.closeAll();
  });

  test("uses idle LRU eviction when capacity is full", async () => {
    const workers = pool({ maxWorkers: 1 });
    const firstRuntime = runtime("a");
    const first = await workers.acquire({
      root: "/a",
      rootType: "git",
      ttlMs: 1_000,
      start: async () => firstRuntime,
    });
    if (first.ok) await first.value.release();
    const second = await workers.acquire({
      root: "/b",
      rootType: "git",
      ttlMs: 1_000,
      start: async () => runtime("b"),
    });
    await vi.waitFor(() => expect(firstRuntime.closed).toBe(true));
    expect(
      workers.getDiagnostics().some((entry) => entry.root === "/b" && entry.state === "ready"),
    ).toBe(true);
    if (second.ok) await second.value.release();
    await workers.closeAll();
  });

  test("expires idle workers by root-specific TTL", async () => {
    let now = 0;
    const workers = pool({ now: () => now });
    const worker = runtime("a");
    const lease = await workers.acquire({
      root: "/a",
      rootType: "git",
      ttlMs: 10,
      start: async () => worker,
    });
    if (lease.ok) await lease.value.release();
    now = 11;
    await workers.sweep();
    expect(worker.closed).toBe(true);
    await workers.closeAll();
  });

  test("backs off failed startup and preserves failure count on retry", async () => {
    let now = 0;
    const workers = pool({ now: () => now, restartBackoffMs: 100 });
    const start = vi
      .fn<() => Promise<FakeRuntime>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(runtime("recovered"));
    const spec = { root: "/a", rootType: "git" as const, ttlMs: 100, start };

    expect(await workers.acquire(spec)).toMatchObject({ ok: false });
    expect(await workers.acquire(spec)).toMatchObject({
      ok: false,
      error: { code: "WORKER_UNAVAILABLE", message: expect.stringContaining("backing off") },
    });
    expect(start).toHaveBeenCalledTimes(1);
    now = 101;
    const recovered = await workers.acquire(spec);
    expect(recovered.ok).toBe(true);
    expect(start).toHaveBeenCalledTimes(2);
    expect(workers.getDiagnostics()[0]?.failureCount).toBe(1);
    if (recovered.ok) await recovered.value.release();
    await workers.closeAll();
  });

  test("reports a busy worker limit without killing work", async () => {
    const workers = pool({ maxWorkers: 1 });
    const first = await workers.acquire({
      root: "/a",
      rootType: "git",
      ttlMs: 100,
      start: async () => runtime("a"),
    });
    expect(
      await workers.acquire({
        root: "/b",
        rootType: "git",
        ttlMs: 100,
        start: async () => runtime("b"),
      }),
    ).toMatchObject({ ok: false, error: { code: "WORKER_LIMIT_REACHED" } });
    if (first.ok) await first.value.release();
    await workers.closeAll();
  });
});
