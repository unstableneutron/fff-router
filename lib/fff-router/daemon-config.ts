import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getDefaultFallbackBackend,
  parseBackend,
  type BackendSelection,
  type SupportedBackendId,
} from "./backend-config";
import { expandHomePath } from "./home-path";
import type { RouterConfig } from "./types";

export const DEFAULT_DAEMON_HOST = "127.0.0.1";
export const DAEMON_PROTOCOL_VERSION = "fff-router-http-daemon-v2";
export const DEFAULT_DAEMON_PORT = 4319;
export const DEFAULT_DAEMON_MCP_PATH = "/mcp";
const DEFAULT_BACKEND: SupportedBackendId = "fff-node";

export type DaemonConfig = {
  host: string;
  port: number;
  mcpPath: string;
};

export type DaemonReloadConfig = {
  backend: BackendSelection;
  router: RouterConfig;
};

export type DaemonFileConfig = {
  host?: string;
  port?: number;
  mcpPath?: string;
  backend?: SupportedBackendId;
  allowlist?: string[];
  promotion?: {
    windowMs?: number;
    requiredHits?: number;
  };
  ttl?: {
    gitMs?: number;
    nonGitMs?: number;
  };
  limits?: {
    maxPersistentDaemons?: number;
    maxPersistentNonGitDaemons?: number;
  };
};

export type DaemonPolicyConfigPaths = {
  dir: string;
  jsonPath: string;
  jsoncPath: string;
};

export type DaemonPaths = {
  dir: string;
  metadataPath: string;
  lockPath: string;
};

function hashFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function configHome(env: NodeJS.ProcessEnv): string {
  return env.HOME || os.homedir();
}

export function getDefaultDaemonConfig(): DaemonConfig {
  return {
    host: DEFAULT_DAEMON_HOST,
    port: DEFAULT_DAEMON_PORT,
    mcpPath: DEFAULT_DAEMON_MCP_PATH,
  };
}

export function getDefaultRouterConfig(): RouterConfig {
  return {
    allowlistedNonGitPrefixes: [],
    promotion: {
      windowMs: 10 * 60 * 1000,
      requiredHits: 2,
    },
    ttl: {
      gitMs: 60 * 60 * 1000,
      nonGitMs: 15 * 60 * 1000,
    },
    limits: {
      maxPersistentDaemons: 12,
      maxPersistentNonGitDaemons: 4,
    },
  };
}

export function getDefaultDaemonReloadConfig(): DaemonReloadConfig {
  return {
    backend: {
      primaryBackendId: DEFAULT_BACKEND,
      fallbackBackendId: getDefaultFallbackBackend(DEFAULT_BACKEND),
    },
    router: getDefaultRouterConfig(),
  };
}

export type DefaultDaemonFileConfig = {
  host: string;
  port: number;
  mcpPath: string;
  backend: SupportedBackendId;
  allowlist: string[];
  promotion: {
    windowMs: number;
    requiredHits: number;
  };
  ttl: {
    gitMs: number;
    nonGitMs: number;
  };
  limits: {
    maxPersistentDaemons: number;
    maxPersistentNonGitDaemons: number;
  };
};

export function getDefaultDaemonFileConfig(): DefaultDaemonFileConfig {
  const daemon = getDefaultDaemonConfig();
  const reload = getDefaultDaemonReloadConfig();
  return {
    host: daemon.host,
    port: daemon.port,
    mcpPath: daemon.mcpPath,
    backend: reload.backend.primaryBackendId,
    allowlist: [],
    promotion: { ...reload.router.promotion },
    ttl: { ...reload.router.ttl },
    limits: { ...reload.router.limits },
  };
}

function serializeDefaultDaemonFileConfig(): string {
  return `${JSON.stringify(getDefaultDaemonFileConfig(), null, 2)}\n`;
}

export function getDaemonPolicyConfigPaths(
  args: { env?: NodeJS.ProcessEnv } = {},
): DaemonPolicyConfigPaths {
  const env = args.env ?? process.env;
  const dir = path.join(configHome(env), ".config", "fff-routerd");
  return {
    dir,
    jsonPath: path.join(dir, "config.json"),
    jsoncPath: path.join(dir, "config.jsonc"),
  };
}

function ensureDefaultConfigFile(paths: DaemonPolicyConfigPaths): { path: string; text: string } {
  mkdirSync(paths.dir, { recursive: true });
  const text = serializeDefaultDaemonFileConfig();
  writeFileSync(paths.jsonPath, text);
  return {
    path: paths.jsonPath,
    text,
  };
}

export function readPreferredDaemonPolicyFile(
  args: {
    env?: NodeJS.ProcessEnv;
  } = {},
): { path: string; text: string } {
  const paths = getDaemonPolicyConfigPaths(args);
  if (existsSync(paths.jsonPath)) {
    return {
      path: paths.jsonPath,
      text: readFileSync(paths.jsonPath, "utf8"),
    };
  }

  if (existsSync(paths.jsoncPath)) {
    return {
      path: paths.jsoncPath,
      text: readFileSync(paths.jsoncPath, "utf8"),
    };
  }

  return ensureDefaultConfigFile(paths);
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }

  return value as Record<string, unknown>;
}

function readOptionalNumber(value: unknown, label: string): number | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function readOptionalNonNegativeInteger(value: unknown, label: string): number | undefined {
  const parsed = readOptionalNumber(value, label);
  if (parsed == null) {
    return undefined;
  }
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function readOptionalPort(value: unknown): number | undefined {
  const parsed = readOptionalNumber(value, "port");
  if (parsed == null) {
    return undefined;
  }
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error("port must be an integer between 1 and 65535");
  }
  return parsed;
}

function readOptionalMcpPath(value: unknown): string | undefined {
  const parsed = readOptionalString(value, "mcpPath");
  if (parsed == null) {
    return undefined;
  }
  if (!parsed.startsWith("/")) {
    throw new Error("mcpPath must start with '/'");
  }
  return parsed;
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function readOptionalStringArray(value: unknown, label: string): string[] | undefined {
  if (value == null) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value;
}

function readOptionalBackend(value: unknown): SupportedBackendId | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("backend must be a string");
  }
  return parseBackend(value);
}

function expandAllowlistEntries(entries: string[], env: NodeJS.ProcessEnv) {
  return entries
    .map((prefix) => expandHomePath(prefix, env))
    .map((result) => {
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.value;
    })
    .filter(Boolean)
    .map((prefix) => ({ prefix, mode: "first-child-root" as const }));
}

export function parseJsonWithComments(text: string): unknown {
  let withoutComments = "";
  let index = 0;
  let inString = false;
  let stringQuote = '"';
  let escaped = false;

  while (index < text.length) {
    const current = text[index] ?? "";
    const next = text[index + 1] ?? "";

    if (inString) {
      withoutComments += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === stringQuote) {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (current === '"' || current === "'") {
      inString = true;
      stringQuote = current;
      withoutComments += current;
      index += 1;
      continue;
    }

    if (current === "/" && next === "/") {
      index += 2;
      while (index < text.length && text[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (current === "/" && next === "*") {
      index += 2;
      while (index < text.length) {
        if (text[index] === "*" && text[index + 1] === "/") {
          index += 2;
          break;
        }
        index += 1;
      }
      continue;
    }

    withoutComments += current;
    index += 1;
  }

  let normalized = "";
  index = 0;
  inString = false;
  escaped = false;

  while (index < withoutComments.length) {
    const current = withoutComments[index] ?? "";

    if (inString) {
      normalized += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === stringQuote) {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (current === '"' || current === "'") {
      inString = true;
      stringQuote = current;
      normalized += current;
      index += 1;
      continue;
    }

    if (current === ",") {
      let lookahead = index + 1;
      while (lookahead < withoutComments.length && /\s/.test(withoutComments[lookahead] ?? "")) {
        lookahead += 1;
      }
      const nextNonWhitespace = withoutComments[lookahead] ?? "";
      if (nextNonWhitespace === "}" || nextNonWhitespace === "]") {
        index += 1;
        continue;
      }
    }

    normalized += current;
    index += 1;
  }

  return JSON.parse(normalized);
}

function normalizeDaemonFileConfig(
  raw: unknown,
  env: NodeJS.ProcessEnv,
): {
  daemon: DaemonConfig;
  reload: DaemonReloadConfig;
} {
  const defaults = getDefaultDaemonFileConfig();
  const fileConfig = expectObject(raw, "fff-routerd config");
  const promotion =
    fileConfig.promotion == null ? null : expectObject(fileConfig.promotion, "promotion");
  const ttl = fileConfig.ttl == null ? null : expectObject(fileConfig.ttl, "ttl");
  const limits = fileConfig.limits == null ? null : expectObject(fileConfig.limits, "limits");

  const normalizedEnv = { ...env, HOME: configHome(env) } as NodeJS.ProcessEnv;
  const backendId = readOptionalBackend(fileConfig.backend) ?? defaults.backend;
  const allowlist =
    readOptionalStringArray(fileConfig.allowlist, "allowlist") ?? defaults.allowlist;
  const host = readOptionalString(fileConfig.host, "host") ?? defaults.host;
  const port = readOptionalPort(fileConfig.port) ?? defaults.port;
  const mcpPath = readOptionalMcpPath(fileConfig.mcpPath) ?? defaults.mcpPath;

  const promotionWindowMs =
    readOptionalNonNegativeInteger(promotion?.windowMs, "promotion.windowMs") ??
    defaults.promotion.windowMs;
  const promotionRequiredHits =
    readOptionalNonNegativeInteger(promotion?.requiredHits, "promotion.requiredHits") ??
    defaults.promotion.requiredHits;
  const ttlGitMs = readOptionalNonNegativeInteger(ttl?.gitMs, "ttl.gitMs") ?? defaults.ttl.gitMs;
  const ttlNonGitMs =
    readOptionalNonNegativeInteger(ttl?.nonGitMs, "ttl.nonGitMs") ?? defaults.ttl.nonGitMs;
  const maxPersistentDaemons =
    readOptionalNonNegativeInteger(limits?.maxPersistentDaemons, "limits.maxPersistentDaemons") ??
    defaults.limits.maxPersistentDaemons;
  const maxPersistentNonGitDaemons =
    readOptionalNonNegativeInteger(
      limits?.maxPersistentNonGitDaemons,
      "limits.maxPersistentNonGitDaemons",
    ) ?? defaults.limits.maxPersistentNonGitDaemons;

  return {
    daemon: {
      host,
      port,
      mcpPath,
    },
    reload: {
      backend: {
        primaryBackendId: backendId,
        fallbackBackendId: getDefaultFallbackBackend(backendId),
      },
      router: {
        allowlistedNonGitPrefixes: expandAllowlistEntries(allowlist, normalizedEnv),
        promotion: {
          windowMs: promotionWindowMs,
          requiredHits: promotionRequiredHits,
        },
        ttl: {
          gitMs: ttlGitMs,
          nonGitMs: ttlNonGitMs,
        },
        limits: {
          maxPersistentDaemons,
          maxPersistentNonGitDaemons,
        },
      },
    },
  };
}

function readDaemonConfigFromMetadata(args: { env?: NodeJS.ProcessEnv } = {}): DaemonConfig | null {
  const paths = getDaemonPaths(args);
  if (!existsSync(paths.metadataPath)) {
    return null;
  }

  try {
    const metadata = JSON.parse(readFileSync(paths.metadataPath, "utf8")) as {
      host?: string;
      port?: number;
      mcpPath?: string;
    };
    if (
      typeof metadata.host !== "string" ||
      typeof metadata.port !== "number" ||
      typeof metadata.mcpPath !== "string"
    ) {
      return null;
    }
    return {
      host: metadata.host,
      port: metadata.port,
      mcpPath: metadata.mcpPath,
    };
  } catch {
    return null;
  }
}

function loadNormalizedDaemonFileConfig(args: { env?: NodeJS.ProcessEnv } = {}) {
  const env = args.env ?? process.env;
  const configFile = readPreferredDaemonPolicyFile({ env });
  return normalizeDaemonFileConfig(parseJsonWithComments(configFile.text), env);
}

export function getDaemonConfig(args: { env?: NodeJS.ProcessEnv } = {}): DaemonConfig {
  try {
    return loadNormalizedDaemonFileConfig(args).daemon;
  } catch (error) {
    const fallback = readDaemonConfigFromMetadata(args);
    if (fallback) {
      return fallback;
    }
    throw error;
  }
}

export function getDaemonEndpoint(args: { env?: NodeJS.ProcessEnv } = {}): string {
  const config = getDaemonConfig(args);
  return `http://${config.host}:${config.port}${config.mcpPath}`;
}

export function loadDaemonReloadConfig(args: { env?: NodeJS.ProcessEnv } = {}): DaemonReloadConfig {
  return loadNormalizedDaemonFileConfig(args).reload;
}

export function getDaemonServerFingerprint(
  args: {
    env?: NodeJS.ProcessEnv;
    daemonConfig?: Partial<DaemonConfig>;
  } = {},
): string {
  const daemon = getDaemonConfig({ env: args.env });
  return hashFingerprint({
    daemon: {
      ...daemon,
      ...args.daemonConfig,
    },
    protocolVersion: DAEMON_PROTOCOL_VERSION,
  });
}

export function getDaemonReloadFingerprintForConfig(config: DaemonReloadConfig): string {
  return hashFingerprint(config);
}

export function getDaemonReloadFingerprint(args: { env?: NodeJS.ProcessEnv } = {}): string {
  return getDaemonReloadFingerprintForConfig(loadDaemonReloadConfig(args));
}

export function getDaemonConfigFingerprint(
  args: {
    env?: NodeJS.ProcessEnv;
    daemonConfig?: Partial<DaemonConfig>;
  } = {},
): string {
  return hashFingerprint({
    serverFingerprint: getDaemonServerFingerprint(args),
    reloadFingerprint: getDaemonReloadFingerprint(args),
  });
}

export function getDaemonPaths(args: { env?: NodeJS.ProcessEnv } = {}): DaemonPaths {
  const env = args.env ?? process.env;
  const home = configHome(env);
  const base = env.XDG_RUNTIME_DIR || env.TMPDIR || path.join(home, ".cache", "fff-router");
  const dir = path.join(base, "fff-router-daemon");
  return {
    dir,
    metadataPath: path.join(dir, "daemon.json"),
    lockPath: path.join(dir, "startup.lock"),
  };
}
