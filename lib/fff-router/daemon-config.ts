import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { getBackendSelection } from "./backend-config";
import type { RouterConfig } from "./types";

export const DEFAULT_DAEMON_HOST = "127.0.0.1";
export const DAEMON_PROTOCOL_VERSION = "fff-router-http-daemon-v1";
export const DEFAULT_DAEMON_PORT = 4319;
export const DEFAULT_DAEMON_MCP_PATH = "/mcp";

export type DaemonConfig = {
  host: string;
  port: number;
  mcpPath: string;
};

export type DaemonPaths = {
  dir: string;
  metadataPath: string;
  lockPath: string;
};

export function getDaemonConfig(args: { env?: NodeJS.ProcessEnv } = {}): DaemonConfig {
  const env = args.env ?? process.env;
  const port = Number(env.FFF_ROUTER_PORT || DEFAULT_DAEMON_PORT);
  return {
    host: env.FFF_ROUTER_HOST || DEFAULT_DAEMON_HOST,
    port: Number.isFinite(port) ? port : DEFAULT_DAEMON_PORT,
    mcpPath: env.FFF_ROUTER_MCP_PATH || DEFAULT_DAEMON_MCP_PATH,
  };
}

export function getDaemonEndpoint(args: { env?: NodeJS.ProcessEnv } = {}): string {
  const config = getDaemonConfig(args);
  return `http://${config.host}:${config.port}${config.mcpPath}`;
}

function parseNumber(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseAllowlist(raw: string | undefined): RouterConfig["allowlistedNonGitPrefixes"] {
  if (!raw) {
    return [];
  }

  return raw
    .split(":")
    .map((prefix) => prefix.trim())
    .filter(Boolean)
    .map((prefix) => ({ prefix, mode: "first-child-root" as const }));
}

export function loadRouterConfig(args: { env?: NodeJS.ProcessEnv } = {}): RouterConfig {
  const env = args.env ?? process.env;
  return {
    allowlistedNonGitPrefixes: parseAllowlist(env.FFF_ROUTER_ALLOWLIST),
    promotion: {
      windowMs: parseNumber(env.FFF_ROUTER_PROMOTION_WINDOW_MS, 10 * 60 * 1000),
      requiredHits: parseNumber(env.FFF_ROUTER_PROMOTION_REQUIRED_HITS, 2),
    },
    ttl: {
      gitMs: parseNumber(env.FFF_ROUTER_GIT_TTL_MS, 60 * 60 * 1000),
      nonGitMs: parseNumber(env.FFF_ROUTER_NON_GIT_TTL_MS, 15 * 60 * 1000),
    },
    limits: {
      maxPersistentDaemons: parseNumber(env.FFF_ROUTER_MAX_PERSISTENT, 12),
      maxPersistentNonGitDaemons: parseNumber(env.FFF_ROUTER_MAX_PERSISTENT_NON_GIT, 4),
    },
  };
}

export function getDaemonConfigFingerprint(
  args: {
    env?: NodeJS.ProcessEnv;
    daemonConfig?: Partial<DaemonConfig>;
  } = {},
): string {
  const env = args.env ?? process.env;
  const fingerprintSource = JSON.stringify({
    daemon: {
      ...getDaemonConfig({ env }),
      ...args.daemonConfig,
    },
    backend: getBackendSelection({ env }),
    router: loadRouterConfig({ env }),
  });
  return createHash("sha256").update(fingerprintSource).digest("hex").slice(0, 16);
}

export function getDaemonPaths(args: { env?: NodeJS.ProcessEnv } = {}): DaemonPaths {
  const env = args.env ?? process.env;
  const base =
    env.XDG_RUNTIME_DIR || env.TMPDIR || path.join(env.HOME || os.tmpdir(), ".cache", "fff-router");
  const dir = path.join(base, "fff-router-daemon");
  return {
    dir,
    metadataPath: path.join(dir, "daemon.json"),
    lockPath: path.join(dir, "startup.lock"),
  };
}
