import { describe, expect, test } from "bun:test";
import type { SearchBackendRuntime } from "./adapters/types";
import { RuntimeManager, runtimeRegistryKey } from "./runtime-manager";

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	const promise = new Promise<T>((nextResolve) => {
		resolve = nextResolve;
	});

	return { promise, resolve };
}

describe("RuntimeManager", () => {
	test("starts the same backend/root only once under concurrent demand", async () => {
		const startGate = deferred<SearchBackendRuntime>();
		let startCount = 0;
		const manager = new RuntimeManager();

		const first = manager.withRuntime(
			{
				backendId: "fff-mcp",
				persistenceRoot: "/repo/project",
				start: async () => {
					startCount += 1;
					return await startGate.promise;
				},
			},
			async (runtime) => runtime.id,
		);

		const second = manager.withRuntime(
			{
				backendId: "fff-mcp",
				persistenceRoot: "/repo/project",
				start: async () => {
					startCount += 1;
					return await startGate.promise;
				},
			},
			async (runtime) => runtime.id,
		);

		expect(startCount).toBe(1);
		startGate.resolve({
			id: "shared-runtime",
			close: async () => {},
		});

		expect(await first).toBe("shared-runtime");
		expect(await second).toBe("shared-runtime");
	});

	test("reuses the same runtime after startup completes", async () => {
		let startCount = 0;
		const manager = new RuntimeManager();

		const first = await manager.withRuntime(
			{
				backendId: "fff-mcp",
				persistenceRoot: "/repo/project",
				start: async () => {
					startCount += 1;
					return {
						id: "runtime-1",
						close: async () => {},
					} satisfies SearchBackendRuntime;
				},
			},
			async (runtime) => runtime.id,
		);

		const second = await manager.withRuntime(
			{
				backendId: "fff-mcp",
				persistenceRoot: "/repo/project",
				start: async () => {
					startCount += 1;
					return {
						id: "runtime-2",
						close: async () => {},
					} satisfies SearchBackendRuntime;
				},
			},
			async (runtime) => runtime.id,
		);

		expect(first).toBe("runtime-1");
		expect(second).toBe("runtime-1");
		expect(startCount).toBe(1);
	});

	test("evicted runtimes close exactly once", async () => {
		let closeCount = 0;
		const manager = new RuntimeManager();

		await manager.withRuntime(
			{
				backendId: "fff-mcp",
				persistenceRoot: "/repo/project",
				start: async () => ({
					id: "runtime-1",
					close: async () => {
						closeCount += 1;
					},
				}),
			},
			async () => undefined,
		);

		await manager.evictRuntime({
			backendId: "fff-mcp",
			persistenceRoot: "/repo/project",
		});
		await manager.evictRuntime({
			backendId: "fff-mcp",
			persistenceRoot: "/repo/project",
		});

		expect(closeCount).toBe(1);
	});

	test("evicting during startup closes the eventual runtime and forces a fresh start", async () => {
		const firstStart = deferred<SearchBackendRuntime>();
		let startCount = 0;
		let closeCount = 0;
		const manager = new RuntimeManager();

		const pending = manager.withRuntime(
			{
				backendId: "fff-mcp",
				persistenceRoot: "/repo/project",
				start: async () => {
					startCount += 1;
					return await firstStart.promise;
				},
			},
			async (runtime) => runtime.id,
		);

		await manager.evictRuntime({
			backendId: "fff-mcp",
			persistenceRoot: "/repo/project",
		});

		firstStart.resolve({
			id: "runtime-1",
			close: async () => {
				closeCount += 1;
			},
		});

		await expect(pending).rejects.toThrow(
			"Runtime 'fff-mcp::/repo/project' was evicted before startup completed",
		);
		expect(closeCount).toBe(1);

		const next = await manager.withRuntime(
			{
				backendId: "fff-mcp",
				persistenceRoot: "/repo/project",
				start: async () => {
					startCount += 1;
					return {
						id: "runtime-2",
						close: async () => {
							closeCount += 1;
						},
					} satisfies SearchBackendRuntime;
				},
			},
			async (runtime) => runtime.id,
		);

		expect(next).toBe("runtime-2");
		expect(startCount).toBe(2);
	});

	test("search execution is not performed under the mutation lock", async () => {
		let secondStartCount = 0;
		const manager = new RuntimeManager();
		const firstExecuteGate = deferred<void>();

		const first = manager.withRuntime(
			{
				backendId: "fff-mcp",
				persistenceRoot: "/repo/project-a",
				start: async () => ({
					id: "runtime-a",
					close: async () => {},
				}),
			},
			async () => {
				const second = manager.withRuntime(
					{
						backendId: "fff-mcp",
						persistenceRoot: "/repo/project-b",
						start: async () => {
							secondStartCount += 1;
							return {
								id: "runtime-b",
								close: async () => {},
							} satisfies SearchBackendRuntime;
						},
					},
					async (runtime) => runtime.id,
				);

				await Promise.resolve();
				expect(secondStartCount).toBe(1);
				firstExecuteGate.resolve();
				return await second;
			},
		);

		await firstExecuteGate.promise;
		expect(await first).toBe("runtime-b");
	});

	test("retries after startup failure and clears the failed in-flight state", async () => {
		let startCount = 0;
		const manager = new RuntimeManager();

		await expect(
			manager.withRuntime(
				{
					backendId: "fff-mcp",
					persistenceRoot: "/repo/project",
					start: async () => {
						startCount += 1;
						throw new Error("boom");
					},
				},
				async (runtime) => runtime.id,
			),
		).rejects.toThrow("boom");

		const next = await manager.withRuntime(
			{
				backendId: "fff-mcp",
				persistenceRoot: "/repo/project",
				start: async () => {
					startCount += 1;
					return {
						id: "runtime-2",
						close: async () => {},
					} satisfies SearchBackendRuntime;
				},
			},
			async (runtime) => runtime.id,
		);

		expect(next).toBe("runtime-2");
		expect(startCount).toBe(2);
	});

	test("builds stable runtime registry keys", () => {
		expect(runtimeRegistryKey("fff-mcp", "/repo/project")).toBe(
			"fff-mcp::/repo/project",
		);
	});
});
