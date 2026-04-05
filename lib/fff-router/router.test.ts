import { describe, expect, test } from "bun:test";
import { planRequest } from "./router";
import type {
	DaemonRegistryState,
	ResolvedSearchPath,
	Result,
	RouterConfig,
} from "./types";

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

const emptyState: DaemonRegistryState = {
	daemons: {},
	nonGitRecentHits: {},
	now: 1_000,
};

function successResolved(
	value: ResolvedSearchPath,
): Promise<Result<ResolvedSearchPath>> {
	return Promise.resolve({ ok: true, value });
}

describe("planRequest", () => {
	test("returns persistent git routing decisions", async () => {
		const result = await planRequest({
			rawRequest: {
				tool: "search_code",
				search_path: "/repo/project/src",
				any_of: ["ActorAuth"],
			},
			config,
			state: emptyState,
			resolvePath: () =>
				successResolved({
					realPath: "/repo/project/src",
					statType: "directory",
					gitRoot: "/repo/project",
				}),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.value.action.type).toBe("start-persistent");
		expect(result.value.response.backend_mode).toBe("persistent");
		expect(result.value.response.persistence_root).toBe("/repo/project");
	});

	test("returns ephemeral non-git decisions before promotion", async () => {
		const result = await planRequest({
			rawRequest: {
				tool: "find_files",
				search_path:
					"/Users/thinh/.local/share/mise/installs/npm-gitchamber/latest",
				query: "auth model",
			},
			config,
			state: emptyState,
			resolvePath: () =>
				successResolved({
					realPath:
						"/Users/thinh/.local/share/mise/installs/npm-gitchamber/latest",
					statType: "directory",
					gitRoot: null,
				}),
		});

		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("expected success");
		expect(result.value.action.type).toBe("run-ephemeral");
		expect(result.value.response.backend_mode).toBe("ephemeral");
	});

	test("propagates structured path-resolution errors", async () => {
		const result = await planRequest({
			rawRequest: {
				tool: "find_files",
				search_path: "/tmp/missing",
				query: "auth model",
			},
			config,
			state: emptyState,
			resolvePath: async () => ({
				ok: false,
				error: {
					code: "SEARCH_PATH_NOT_FOUND",
					message: "missing path",
				},
			}),
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("SEARCH_PATH_NOT_FOUND");
	});

	test("blocks paths outside git and allowlist", async () => {
		const result = await planRequest({
			rawRequest: {
				tool: "find_files",
				search_path: "/tmp/random-tree",
				query: "auth model",
			},
			config,
			state: emptyState,
			resolvePath: () =>
				successResolved({
					realPath: "/private/tmp/random-tree",
					statType: "directory",
					gitRoot: null,
				}),
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("OUTSIDE_ALLOWED_SCOPE");
	});

	test("maps thrown resolvePath errors to SEARCH_PATH_REALPATH_FAILED", async () => {
		const result = await planRequest({
			rawRequest: {
				tool: "find_files",
				search_path: "/tmp/random-tree",
				query: "auth model",
			},
			config,
			state: emptyState,
			resolvePath: async () => {
				throw new Error("boom");
			},
		});

		expect(result.ok).toBe(false);
		if (result.ok) throw new Error("expected failure");
		expect(result.error.code).toBe("SEARCH_PATH_REALPATH_FAILED");
	});
});
