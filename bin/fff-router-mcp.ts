#!/usr/bin/env bun
import { createFffMcpAdapter } from "../lib/fff-router/adapters/fff-mcp";
import { createRgFdAdapter } from "../lib/fff-router/adapters/rg-fd";
import { createSearchCoordinator } from "../lib/fff-router/coordinator";
import { createMcpServer } from "../lib/fff-router/mcp-server";
import { RuntimeManager } from "../lib/fff-router/runtime-manager";
import type { RouterConfig } from "../lib/fff-router/types";

function envNumber(name: string, fallback: number): number {
	const raw = process.env[name];
	if (!raw) {
		return fallback;
	}

	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function envAllowlist(): RouterConfig["allowlistedNonGitPrefixes"] {
	const raw = process.env.FFF_ROUTER_ALLOWLIST;
	if (!raw) {
		return [];
	}

	return raw
		.split(":")
		.map((prefix) => prefix.trim())
		.filter(Boolean)
		.map((prefix) => ({ prefix, mode: "first-child-root" as const }));
}

const config: RouterConfig = {
	allowlistedNonGitPrefixes: envAllowlist(),
	promotion: {
		windowMs: envNumber("FFF_ROUTER_PROMOTION_WINDOW_MS", 10 * 60 * 1000),
		requiredHits: envNumber("FFF_ROUTER_PROMOTION_REQUIRED_HITS", 2),
	},
	ttl: {
		gitMs: envNumber("FFF_ROUTER_GIT_TTL_MS", 60 * 60 * 1000),
		nonGitMs: envNumber("FFF_ROUTER_NON_GIT_TTL_MS", 15 * 60 * 1000),
	},
	limits: {
		maxPersistentDaemons: envNumber("FFF_ROUTER_MAX_PERSISTENT", 12),
		maxPersistentNonGitDaemons: envNumber(
			"FFF_ROUTER_MAX_PERSISTENT_NON_GIT",
			4,
		),
	},
};

const coordinator = createSearchCoordinator({
	config,
	primaryAdapter: createFffMcpAdapter(),
	fallbackAdapter: createRgFdAdapter(),
	runtimeManager: new RuntimeManager(),
});

const server = createMcpServer({ coordinator });

server.connectStdio().catch((error) => {
	console.error("fff-router-mcp failed:", error);
	process.exit(1);
});
