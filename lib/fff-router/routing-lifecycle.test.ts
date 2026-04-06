import { describe, expect, test } from "bun:test";
import { planRoutingLifecycle } from "./daemon-state";
import type { DaemonRegistryState, RouterConfig } from "./types";

const config: RouterConfig = {
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

function emptyState(now: number): DaemonRegistryState {
	return {
		daemons: {},
		nonGitRecentHits: {},
		now,
	};
}

describe("planRoutingLifecycle", () => {
	test("plans git-backed lifecycle work for grep queries", () => {
		const result = planRoutingLifecycle({
			queryKind: "grep",
			realPath: "/repo/project/src/router.ts",
			statType: "file",
			gitRoot: "/repo/project",
			config,
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
			config,
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
			config,
			state: emptyState(3_000),
		});
		expect(initial.ok).toBe(true);
		if (!initial.ok) throw new Error("expected success");

		const next = planRoutingLifecycle({
			queryKind: "grep",
			realPath: "/repo/project/src/router.ts",
			statType: "file",
			gitRoot: "/repo/project",
			config,
			state: {
				...initial.value.nextState,
				now: 3_500,
			},
		});

		expect(next.ok).toBe(true);
		if (!next.ok) throw new Error("expected success");
		expect(next.value.action.type).toBe("reuse-persistent");
		expect(next.value.action.key).toBe("/repo/project");
	});

	test("blocks lifecycle planning outside git and allowlist for any query kind", () => {
		const result = planRoutingLifecycle({
			queryKind: "find_files",
			realPath: "/private/tmp/random-tree",
			statType: "directory",
			gitRoot: null,
			config,
			state: emptyState(4_000),
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("OUTSIDE_ALLOWED_SCOPE");
	});
});
