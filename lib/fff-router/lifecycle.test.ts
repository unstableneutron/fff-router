import { describe, expect, test } from "bun:test";
import { planDaemonAction, planRoutingLifecycle } from "./lifecycle";
import type { DaemonRegistryState, RouterConfig, RoutingTarget } from "./types";

const config: RouterConfig = {
	allowlistedNonGitPrefixes: [],
	promotion: { windowMs: 10 * 60 * 1000, requiredHits: 2 },
	ttl: { gitMs: 60 * 60 * 1000, nonGitMs: 15 * 60 * 1000 },
	limits: { maxPersistentDaemons: 2, maxPersistentNonGitDaemons: 1 },
};

const gitTargetA: RoutingTarget = {
	rootType: "git",
	persistenceRoot: "/repo/a",
	searchScope: "/repo/a/src",
	backendMode: "persistent",
	ttlMs: 60 * 60 * 1000,
};

const gitTargetB: RoutingTarget = {
	rootType: "git",
	persistenceRoot: "/repo/b",
	searchScope: "/repo/b/src",
	backendMode: "persistent",
	ttlMs: 60 * 60 * 1000,
};

const nonGitTargetA: RoutingTarget = {
	rootType: "non-git",
	persistenceRoot: "/allow/pkg-a",
	searchScope: "/allow/pkg-a/src",
	backendMode: "ephemeral-candidate",
	ttlMs: 15 * 60 * 1000,
};

const nonGitTargetB: RoutingTarget = {
	rootType: "non-git",
	persistenceRoot: "/allow/pkg-b",
	searchScope: "/allow/pkg-b/src",
	backendMode: "ephemeral-candidate",
	ttlMs: 15 * 60 * 1000,
};

function emptyState(now: number): DaemonRegistryState {
	return {
		daemons: {},
		nonGitRecentHits: {},
		now,
	};
}

describe("planDaemonAction", () => {
	test("creates persistent daemon immediately for git roots", () => {
		const result = planDaemonAction(emptyState(1_000), gitTargetA, config);
		expect(result.action.type).toBe("start-persistent");
		expect(result.nextState.daemons["/repo/a"].ttlMs).toBe(60 * 60 * 1000);
	});

	test("reuses existing persistent daemons and refreshes lastUsedAt", () => {
		const state: DaemonRegistryState = {
			daemons: {
				"/repo/a": {
					key: "/repo/a",
					persistenceRoot: "/repo/a",
					rootType: "git",
					status: "running",
					createdAt: 100,
					lastUsedAt: 200,
					ttlMs: 60 * 60 * 1000,
				},
			},
			nonGitRecentHits: {},
			now: 500,
		};

		const result = planDaemonAction(state, gitTargetA, config);
		expect(result.action.type).toBe("reuse-persistent");
		expect(result.nextState.daemons["/repo/a"].lastUsedAt).toBe(500);
	});

	test("keeps first non-git hit ephemeral", () => {
		const result = planDaemonAction(emptyState(2_000), nonGitTargetA, config);
		expect(result.action.type).toBe("run-ephemeral");
		expect(result.nextState.nonGitRecentHits["/allow/pkg-a"]).toEqual([2_000]);
	});

	test("does not promote stale non-git hits outside the promotion window", () => {
		const staleState: DaemonRegistryState = {
			daemons: {},
			nonGitRecentHits: { "/allow/pkg-a": [0] },
			now: 20 * 60 * 1000,
		};

		const result = planDaemonAction(staleState, nonGitTargetA, config);
		expect(result.action.type).toBe("run-ephemeral");
		expect(result.nextState.nonGitRecentHits["/allow/pkg-a"]).toEqual([
			20 * 60 * 1000,
		]);
	});

	test("promotes repeated non-git hits inside the promotion window and clears recent hits", () => {
		const initial = planDaemonAction(
			emptyState(3_000),
			nonGitTargetA,
			config,
		).nextState;
		const result = planDaemonAction(
			{ ...initial, now: 3_000 + 5 * 60 * 1000 },
			nonGitTargetA,
			config,
		);
		expect(result.action.type).toBe("start-persistent");
		expect(result.nextState.daemons["/allow/pkg-a"].rootType).toBe("non-git");
		expect(result.nextState.nonGitRecentHits["/allow/pkg-a"]).toBeUndefined();
	});

	test("expires idle daemons before planning the next action", () => {
		const state: DaemonRegistryState = {
			daemons: {
				"/repo/expired": {
					key: "/repo/expired",
					persistenceRoot: "/repo/expired",
					rootType: "git",
					status: "running",
					createdAt: 0,
					lastUsedAt: 0,
					ttlMs: 1_000,
				},
			},
			nonGitRecentHits: {},
			now: 5_000,
		};

		const result = planDaemonAction(state, gitTargetA, config);
		expect(result.evicted).toContain("/repo/expired");
		expect(result.action.type).toBe("start-persistent");
	});

	test("evicts the global least-recently-used daemon when the global cap is exceeded", () => {
		const state: DaemonRegistryState = {
			daemons: {
				"/repo/a": {
					key: "/repo/a",
					persistenceRoot: "/repo/a",
					rootType: "git",
					status: "running",
					createdAt: 0,
					lastUsedAt: 100,
					ttlMs: 60 * 60 * 1000,
				},
				"/repo/b": {
					key: "/repo/b",
					persistenceRoot: "/repo/b",
					rootType: "git",
					status: "running",
					createdAt: 0,
					lastUsedAt: 200,
					ttlMs: 60 * 60 * 1000,
				},
			},
			nonGitRecentHits: {},
			now: 500,
		};

		const result = planDaemonAction(
			state,
			{
				rootType: "git",
				persistenceRoot: "/repo/c",
				searchScope: "/repo/c/src",
				backendMode: "persistent",
				ttlMs: 60 * 60 * 1000,
			},
			config,
		);

		expect(result.evicted).toContain("/repo/a");
		expect(result.nextState.daemons["/repo/c"]).toBeDefined();
	});

	test("evicts the oldest non-git daemon when the non-git cap is exceeded", () => {
		const state: DaemonRegistryState = {
			daemons: {
				"/allow/pkg-a": {
					key: "/allow/pkg-a",
					persistenceRoot: "/allow/pkg-a",
					rootType: "non-git",
					status: "running",
					createdAt: 0,
					lastUsedAt: 100,
					ttlMs: 15 * 60 * 1000,
				},
			},
			nonGitRecentHits: { "/allow/pkg-b": [1_000] },
			now: 1_001,
		};

		const result = planDaemonAction(state, nonGitTargetB, config);
		expect(result.action.type).toBe("start-persistent");
		expect(result.evicted).toContain("/allow/pkg-a");
		expect(result.nextState.daemons["/allow/pkg-b"]).toBeDefined();
	});

	test("expires daemons at the exact TTL boundary", () => {
		const state: DaemonRegistryState = {
			daemons: {
				"/repo/a": {
					key: "/repo/a",
					persistenceRoot: "/repo/a",
					rootType: "git",
					status: "running",
					createdAt: 0,
					lastUsedAt: 100,
					ttlMs: 50,
				},
			},
			nonGitRecentHits: {},
			now: 150,
		};

		const result = planDaemonAction(state, gitTargetB, config);
		expect(result.evicted).toEqual(["/repo/a"]);
		expect(result.action.type).toBe("start-persistent");
	});

	test("avoids over-evicting when one non-git eviction satisfies both caps", () => {
		const state: DaemonRegistryState = {
			daemons: {
				"/repo/a": {
					key: "/repo/a",
					persistenceRoot: "/repo/a",
					rootType: "git",
					status: "running",
					createdAt: 0,
					lastUsedAt: 100,
					ttlMs: 60 * 60 * 1000,
				},
				"/allow/pkg-a": {
					key: "/allow/pkg-a",
					persistenceRoot: "/allow/pkg-a",
					rootType: "non-git",
					status: "running",
					createdAt: 0,
					lastUsedAt: 200,
					ttlMs: 15 * 60 * 1000,
				},
			},
			nonGitRecentHits: { "/allow/pkg-b": [250] },
			now: 251,
		};

		const result = planDaemonAction(state, nonGitTargetB, config);
		expect(result.action.type).toBe("start-persistent");
		expect(result.evicted).toEqual(["/allow/pkg-a"]);
		expect(result.nextState.daemons["/repo/a"]).toBeDefined();
		expect(result.nextState.daemons["/allow/pkg-b"]).toBeDefined();
	});

	test("falls back to ephemeral when promotion cannot survive capacity limits", () => {
		const constrainedConfig: RouterConfig = {
			...config,
			limits: { maxPersistentDaemons: 0, maxPersistentNonGitDaemons: 0 },
		};
		const state: DaemonRegistryState = {
			daemons: {},
			nonGitRecentHits: { "/allow/pkg-b": [1_000] },
			now: 1_001,
		};

		const result = planDaemonAction(state, nonGitTargetB, constrainedConfig);
		expect(result.action.type).toBe("run-ephemeral");
		expect(result.nextState.daemons["/allow/pkg-b"]).toBeUndefined();
	});
});

// Merged tests from routing-lifecycle.test.ts
// Additional config for planRoutingLifecycle tests
const routingConfig: RouterConfig = {
	allowlistedNonGitPrefixes: [
		{
			prefix: "/Users/thinh/.local/share/mise/installs",
			mode: "first-child-root",
		},
	],
	promotion: { windowMs: 10 * 60 * 1000, requiredHits: 2 },
	ttl: { gitMs: 60 * 60 * 1000, nonGitMs: 15 * 60 * 1000 },
	limits: { maxPersistentDaemons: 12, maxPersistentNonGitDaemons: 4 },
};

describe("planRoutingLifecycle", () => {
	test("plans git-backed lifecycle work for grep queries", () => {
		const result = planRoutingLifecycle({
			queryKind: "grep",
			realPath: "/repo/project/src/router.ts",
			statType: "file",
			gitRoot: "/repo/project",
			config: routingConfig,
			state: emptyState(1_000),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.value.queryKind).toBe("grep");
		expect(result.value.target.persistenceRoot).toBe("/repo/project");
		expect(result.value.action.type).toBe("start-persistent");
	});

	test("plans non-git lifecycle work for search_terms queries", () => {
		const result = planRoutingLifecycle({
			queryKind: "search_terms",
			realPath:
				"/Users/thinh/.local/share/mise/installs/npm-gitchamber/latest/node_modules/foo",
			statType: "directory",
			gitRoot: null,
			config: routingConfig,
			state: emptyState(2_000),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.value.queryKind).toBe("search_terms");
		expect(result.value.target.rootType).toBe("non-git");
		expect(result.value.action.type).toBe("run-ephemeral");
	});

	test("reuses the same persistent lifecycle root across query kinds", () => {
		const initial = planRoutingLifecycle({
			queryKind: "find_files",
			realPath: "/repo/project/src",
			statType: "directory",
			gitRoot: "/repo/project",
			config: routingConfig,
			state: emptyState(3_000),
		});
		expect(initial.ok).toBe(true);
		if (!initial.ok) throw new Error("expected success");

		const next = planRoutingLifecycle({
			queryKind: "grep",
			realPath: "/repo/project/src/router.ts",
			statType: "file",
			gitRoot: "/repo/project",
			config: routingConfig,
			state: {
				...initial.value.nextState,
				now: 3_500,
			},
		});

		expect(next.ok).toBe(true);
		if (!next.ok) throw new Error("expected success");
		expect(next.value.target.persistenceRoot).toBe("/repo/project");
		expect(next.value.action.type).toBe("reuse-persistent");
		expect(next.value.action.key).toBe("/repo/project");
	});

	test("blocks lifecycle planning outside git and allowlist for any query kind", () => {
		const result = planRoutingLifecycle({
			queryKind: "find_files",
			realPath: "/tmp/random-tree/src",
			statType: "directory",
			gitRoot: null,
			config: routingConfig,
			state: emptyState(4_000),
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("OUTSIDE_ALLOWED_SCOPE");
	});
});
