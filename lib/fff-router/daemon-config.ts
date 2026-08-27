import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expandHomePath } from "./home-path";
import type { RouterConfig } from "./types";

export const DEFAULT_DAEMON_HOST = "127.0.0.1";
export const DAEMON_PROTOCOL_VERSION = "fff-router-v2";
export const DEFAULT_DAEMON_PORT = 4319;
export const DEFAULT_DAEMON_MCP_PATH = "/mcp";
const DEFAULT_BACKEND_TOOL_TIMEOUT_MS = 30_000;
const DEFAULT_SWEEP_INTERVAL_MS = 30_000;
const DEFAULT_RESTART_BACKOFF_MS = 1_000;
const DEFAULT_RESTART_BACKOFF_MAX_MS = 60_000;
const DEFAULT_PROCESS_SAMPLE_INTERVAL_MS = 5_000;
const DEFAULT_PROCESS_SHUTDOWN_GRACE_MS = 500;
const DEFAULT_PROCESS_KILL_GRACE_MS = 1_000;
const DEFAULT_WORKER_ORPHAN_IDLE_TIMEOUT_MS = 30 * 60 * 1_000;
const DEFAULT_DAEMON_IDLE_TIMEOUT_MS = 30 * 60 * 1_000;
const DEFAULT_MAX_WORKER_RSS_BYTES = 768 * 1_024 * 1_024;
const DEFAULT_MAX_TOTAL_WORKER_RSS_BYTES = 2 * 1_024 * 1_024 * 1_024;
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export type DaemonConfig = {
  host: string;
  port: number;
  mcpPath: string;
};

export type DaemonReloadConfig = {
  router: RouterConfig;
};

export type DaemonFileConfig = {
  host?: string;
  port?: number;
  mcpPath?: string;
  allowlist?: string[];
  warmRoots?: string[];
  ttl?: {
    gitMs?: number;
    nonGitMs?: number;
  };
  limits?: {
    maxWorkers?: number;
    maxNonGitWorkers?: number;
    maxWorkerRssBytes?: number;
    maxTotalWorkerRssBytes?: number;
  };
  runtime?: {
    toolTimeoutMs?: number;
    sweepIntervalMs?: number;
    restartBackoffMs?: number;
    restartBackoffMaxMs?: number;
    processSampleIntervalMs?: number;
    processShutdownGraceMs?: number;
    processKillGraceMs?: number;
    workerOrphanIdleTimeoutMs?: number;
    daemonIdleTimeoutMs?: number;
  };
};

export type DaemonPolicyConfigPaths = {
  dir: string;
  jsonPath: string;
  jsoncPath: string;
};

export type DaemonPaths = {
  dir: string;
  authTokenPath: string;
  metadataPath: string;
  lockPath: string;
  stdoutLogPath: string;
  stderrLogPath: string;
};

export const PACKAGE_VERSION = "2.0.0";
// pnpm intentionally omits packageManager from packed manifests. Keep this
// build-time constant aligned with package.json; package-manifest.test.ts
// enforces the invariant.
export const PACKAGE_MANAGER = "pnpm@11.19.0";

function hashFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function packagedDaemonEntrypointPath(): string {
  const primaryCandidatePath = path.resolve(moduleDir, "../../dist/bin/fff-routerd.js");
  const candidatePaths = [
    primaryCandidatePath,
    path.resolve(moduleDir, "../../bin/fff-routerd.js"),
  ];

  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return primaryCandidatePath;
}

function contentFingerprint(pathValue: string): string {
  try {
    return createHash("sha256").update(readFileSync(pathValue)).digest("hex");
  } catch {
    return "missing";
  }
}

export function getDaemonSourceFingerprint(
  args: {
    env?: NodeJS.ProcessEnv;
    daemonEntrypointPath?: string;
  } = {},
): string {
  const env = args.env ?? process.env;
  if (env.FFF_ROUTER_DAEMON_SOURCE_FINGERPRINT) {
    return env.FFF_ROUTER_DAEMON_SOURCE_FINGERPRINT;
  }

  const daemonEntrypointPath =
    args.daemonEntrypointPath ??
    env.FFF_ROUTER_DAEMON_BIN ??
    env.FFF_ROUTER_DAEMON_ENTRYPOINT ??
    ((process.versions as Record<string, string | undefined>).perry
      ? process.execPath
      : packagedDaemonEntrypointPath());
  return hashFingerprint({
    packageVersion: PACKAGE_VERSION,
    daemonEntrypointPath,
    content: contentFingerprint(daemonEntrypointPath),
  });
}

function userHome(env: NodeJS.ProcessEnv): string {
  return env.HOME || os.homedir();
}

function configHome(env: NodeJS.ProcessEnv): string {
  return env.XDG_CONFIG_HOME || path.join(userHome(env), ".config");
}

function stateHome(env: NodeJS.ProcessEnv): string {
  return env.XDG_STATE_HOME || path.join(userHome(env), ".local", "state");
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
    warmRoots: [],
    ttl: {
      gitMs: 60 * 60 * 1000,
      nonGitMs: 15 * 60 * 1000,
    },
    limits: {
      maxWorkers: 12,
      maxNonGitWorkers: 4,
      maxWorkerRssBytes: DEFAULT_MAX_WORKER_RSS_BYTES,
      maxTotalWorkerRssBytes: DEFAULT_MAX_TOTAL_WORKER_RSS_BYTES,
    },
    runtime: {
      toolTimeoutMs: DEFAULT_BACKEND_TOOL_TIMEOUT_MS,
      sweepIntervalMs: DEFAULT_SWEEP_INTERVAL_MS,
      restartBackoffMs: DEFAULT_RESTART_BACKOFF_MS,
      restartBackoffMaxMs: DEFAULT_RESTART_BACKOFF_MAX_MS,
      processSampleIntervalMs: DEFAULT_PROCESS_SAMPLE_INTERVAL_MS,
      processShutdownGraceMs: DEFAULT_PROCESS_SHUTDOWN_GRACE_MS,
      processKillGraceMs: DEFAULT_PROCESS_KILL_GRACE_MS,
      workerOrphanIdleTimeoutMs: DEFAULT_WORKER_ORPHAN_IDLE_TIMEOUT_MS,
      daemonIdleTimeoutMs: DEFAULT_DAEMON_IDLE_TIMEOUT_MS,
    },
  };
}

export function getDefaultDaemonReloadConfig(): DaemonReloadConfig {
  return {
    router: getDefaultRouterConfig(),
  };
}

export type DefaultDaemonFileConfig = {
  host: string;
  port: number;
  mcpPath: string;
  allowlist: string[];
  warmRoots: string[];
  ttl: {
    gitMs: number;
    nonGitMs: number;
  };
  limits: {
    maxWorkers: number;
    maxNonGitWorkers: number;
    maxWorkerRssBytes: number;
    maxTotalWorkerRssBytes: number;
  };
  runtime: {
    toolTimeoutMs: number;
    sweepIntervalMs: number;
    restartBackoffMs: number;
    restartBackoffMaxMs: number;
    processSampleIntervalMs: number;
    processShutdownGraceMs: number;
    processKillGraceMs: number;
    workerOrphanIdleTimeoutMs: number;
    daemonIdleTimeoutMs: number;
  };
};

export function getDefaultDaemonFileConfig(): DefaultDaemonFileConfig {
  const daemon = getDefaultDaemonConfig();
  const reload = getDefaultDaemonReloadConfig();
  return {
    host: daemon.host,
    port: daemon.port,
    mcpPath: daemon.mcpPath,
    allowlist: [],
    warmRoots: [],
    ttl: { ...reload.router.ttl },
    limits: {
      maxWorkers: reload.router.limits.maxWorkers,
      maxNonGitWorkers: reload.router.limits.maxNonGitWorkers,
      maxWorkerRssBytes: reload.router.limits.maxWorkerRssBytes ?? DEFAULT_MAX_WORKER_RSS_BYTES,
      maxTotalWorkerRssBytes:
        reload.router.limits.maxTotalWorkerRssBytes ?? DEFAULT_MAX_TOTAL_WORKER_RSS_BYTES,
    },
    runtime: {
      toolTimeoutMs: reload.router.runtime.toolTimeoutMs,
      sweepIntervalMs: reload.router.runtime.sweepIntervalMs,
      restartBackoffMs: reload.router.runtime.restartBackoffMs,
      restartBackoffMaxMs:
        reload.router.runtime.restartBackoffMaxMs ?? DEFAULT_RESTART_BACKOFF_MAX_MS,
      processSampleIntervalMs:
        reload.router.runtime.processSampleIntervalMs ?? DEFAULT_PROCESS_SAMPLE_INTERVAL_MS,
      processShutdownGraceMs:
        reload.router.runtime.processShutdownGraceMs ?? DEFAULT_PROCESS_SHUTDOWN_GRACE_MS,
      processKillGraceMs: reload.router.runtime.processKillGraceMs ?? DEFAULT_PROCESS_KILL_GRACE_MS,
      workerOrphanIdleTimeoutMs:
        reload.router.runtime.workerOrphanIdleTimeoutMs ?? DEFAULT_WORKER_ORPHAN_IDLE_TIMEOUT_MS,
      daemonIdleTimeoutMs:
        reload.router.runtime.daemonIdleTimeoutMs ?? DEFAULT_DAEMON_IDLE_TIMEOUT_MS,
    },
  };
}

function serializeDefaultDaemonFileConfig(): string {
  return `${JSON.stringify(getDefaultDaemonFileConfig(), null, 2)}\n`;
}

export function getDaemonPolicyConfigPaths(
  args: { env?: NodeJS.ProcessEnv } = {},
): DaemonPolicyConfigPaths {
  const env = args.env ?? process.env;
  const dir = path.join(configHome(env), "fff-routerd");
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

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(
      `${label} contains unknown field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`,
    );
  }
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

function readOptionalPositiveInteger(value: unknown, label: string): number | undefined {
  const parsed = readOptionalNonNegativeInteger(value, label);
  if (parsed === 0) {
    throw new Error(`${label} must be greater than zero`);
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
  if (parsed.includes("?") || parsed.includes("#")) {
    throw new Error("mcpPath must be a pathname without query or hash");
  }
  if (parsed === "/health" || parsed === "/control") {
    throw new Error(`mcpPath '${parsed}' is reserved`);
  }
  return parsed;
}

function readOptionalHost(value: unknown): string | undefined {
  const host = readOptionalString(value, "host");
  if (host == null) {
    return undefined;
  }
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalized !== "localhost" &&
    normalized !== "::1" &&
    !(isIP(normalized) === 4 && normalized.startsWith("127."))
  ) {
    throw new Error("fff-routerd is machine-local; host must be localhost, 127.0.0.0/8, or ::1");
  }
  return host;
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

function expandPathEntries(entries: string[], env: NodeJS.ProcessEnv): string[] {
  return entries
    .map((prefix) => expandHomePath(prefix, env))
    .map((result) => {
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.value;
    })
    .filter(Boolean)
    .map((entry) => {
      if (!path.isAbsolute(entry)) {
        throw new Error(`configured paths must be absolute or home-relative: '${entry}'`);
      }
      return path.normalize(entry);
    });
}

function expandAllowlistEntries(entries: string[], env: NodeJS.ProcessEnv) {
  return expandPathEntries(entries, env).map((prefix) => ({
    prefix,
    mode: "first-child-root" as const,
  }));
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
  rejectUnknownKeys(
    fileConfig,
    ["host", "port", "mcpPath", "allowlist", "warmRoots", "ttl", "limits", "runtime"],
    "fff-routerd config",
  );
  const ttl = fileConfig.ttl == null ? null : expectObject(fileConfig.ttl, "ttl");
  const limits = fileConfig.limits == null ? null : expectObject(fileConfig.limits, "limits");
  const runtime = fileConfig.runtime == null ? null : expectObject(fileConfig.runtime, "runtime");
  if (ttl) rejectUnknownKeys(ttl, ["gitMs", "nonGitMs"], "ttl");
  if (limits) {
    rejectUnknownKeys(
      limits,
      ["maxWorkers", "maxNonGitWorkers", "maxWorkerRssBytes", "maxTotalWorkerRssBytes"],
      "limits",
    );
  }
  if (runtime) {
    rejectUnknownKeys(
      runtime,
      [
        "toolTimeoutMs",
        "sweepIntervalMs",
        "restartBackoffMs",
        "restartBackoffMaxMs",
        "processSampleIntervalMs",
        "processShutdownGraceMs",
        "processKillGraceMs",
        "workerOrphanIdleTimeoutMs",
        "daemonIdleTimeoutMs",
      ],
      "runtime",
    );
  }

  const normalizedEnv = { ...env, HOME: userHome(env) } as NodeJS.ProcessEnv;
  const allowlist =
    readOptionalStringArray(fileConfig.allowlist, "allowlist") ?? defaults.allowlist;
  const warmRoots =
    readOptionalStringArray(fileConfig.warmRoots, "warmRoots") ?? defaults.warmRoots;
  const host = readOptionalHost(fileConfig.host) ?? defaults.host;
  const port = readOptionalPort(fileConfig.port) ?? defaults.port;
  const mcpPath = readOptionalMcpPath(fileConfig.mcpPath) ?? defaults.mcpPath;

  const ttlGitMs = readOptionalNonNegativeInteger(ttl?.gitMs, "ttl.gitMs") ?? defaults.ttl.gitMs;
  const ttlNonGitMs =
    readOptionalNonNegativeInteger(ttl?.nonGitMs, "ttl.nonGitMs") ?? defaults.ttl.nonGitMs;
  const maxWorkers =
    readOptionalPositiveInteger(limits?.maxWorkers, "limits.maxWorkers") ??
    defaults.limits.maxWorkers;
  const maxNonGitWorkers =
    readOptionalNonNegativeInteger(limits?.maxNonGitWorkers, "limits.maxNonGitWorkers") ??
    defaults.limits.maxNonGitWorkers;
  if (maxNonGitWorkers > maxWorkers) {
    throw new Error("limits.maxNonGitWorkers must not exceed limits.maxWorkers");
  }
  const maxWorkerRssBytes =
    readOptionalPositiveInteger(limits?.maxWorkerRssBytes, "limits.maxWorkerRssBytes") ??
    defaults.limits.maxWorkerRssBytes;
  const maxTotalWorkerRssBytes =
    readOptionalPositiveInteger(limits?.maxTotalWorkerRssBytes, "limits.maxTotalWorkerRssBytes") ??
    defaults.limits.maxTotalWorkerRssBytes;
  if (maxTotalWorkerRssBytes < maxWorkerRssBytes) {
    throw new Error("limits.maxTotalWorkerRssBytes must be at least limits.maxWorkerRssBytes");
  }
  const toolTimeoutMs =
    readOptionalNonNegativeInteger(runtime?.toolTimeoutMs, "runtime.toolTimeoutMs") ??
    defaults.runtime.toolTimeoutMs;
  const sweepIntervalMs =
    readOptionalNonNegativeInteger(runtime?.sweepIntervalMs, "runtime.sweepIntervalMs") ??
    defaults.runtime.sweepIntervalMs;
  const restartBackoffMs =
    readOptionalNonNegativeInteger(runtime?.restartBackoffMs, "runtime.restartBackoffMs") ??
    defaults.runtime.restartBackoffMs;
  const restartBackoffMaxMs =
    readOptionalNonNegativeInteger(runtime?.restartBackoffMaxMs, "runtime.restartBackoffMaxMs") ??
    defaults.runtime.restartBackoffMaxMs;
  if (restartBackoffMaxMs < restartBackoffMs) {
    throw new Error("runtime.restartBackoffMaxMs must be at least runtime.restartBackoffMs");
  }
  const processSampleIntervalMs =
    readOptionalNonNegativeInteger(
      runtime?.processSampleIntervalMs,
      "runtime.processSampleIntervalMs",
    ) ?? defaults.runtime.processSampleIntervalMs;
  const processShutdownGraceMs =
    readOptionalNonNegativeInteger(
      runtime?.processShutdownGraceMs,
      "runtime.processShutdownGraceMs",
    ) ?? defaults.runtime.processShutdownGraceMs;
  const processKillGraceMs =
    readOptionalNonNegativeInteger(runtime?.processKillGraceMs, "runtime.processKillGraceMs") ??
    defaults.runtime.processKillGraceMs;
  const workerOrphanIdleTimeoutMs =
    readOptionalNonNegativeInteger(
      runtime?.workerOrphanIdleTimeoutMs,
      "runtime.workerOrphanIdleTimeoutMs",
    ) ?? defaults.runtime.workerOrphanIdleTimeoutMs;
  const daemonIdleTimeoutMs =
    readOptionalNonNegativeInteger(runtime?.daemonIdleTimeoutMs, "runtime.daemonIdleTimeoutMs") ??
    defaults.runtime.daemonIdleTimeoutMs;

  return {
    daemon: {
      host,
      port,
      mcpPath,
    },
    reload: {
      router: {
        allowlistedNonGitPrefixes: expandAllowlistEntries(allowlist, normalizedEnv),
        warmRoots: expandPathEntries(warmRoots, normalizedEnv),
        ttl: {
          gitMs: ttlGitMs,
          nonGitMs: ttlNonGitMs,
        },
        limits: {
          maxWorkers,
          maxNonGitWorkers,
          maxWorkerRssBytes,
          maxTotalWorkerRssBytes,
        },
        runtime: {
          toolTimeoutMs,
          sweepIntervalMs,
          restartBackoffMs,
          restartBackoffMaxMs,
          processSampleIntervalMs,
          processShutdownGraceMs,
          processKillGraceMs,
          workerOrphanIdleTimeoutMs,
          daemonIdleTimeoutMs,
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

export function formatDaemonUrlHost(host: string): string {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

export function getDaemonOriginFromConfig(config: DaemonConfig): string {
  return `http://${formatDaemonUrlHost(config.host)}:${config.port}`;
}

export function getDaemonEndpoint(args: { env?: NodeJS.ProcessEnv } = {}): string {
  const config = getDaemonConfig(args);
  return `${getDaemonOriginFromConfig(config)}${config.mcpPath}`;
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
    daemonSourceFingerprint: getDaemonSourceFingerprint({ env: args.env }),
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
  const dir = path.join(stateHome(env), "fff-routerd");
  return {
    dir,
    authTokenPath: path.join(dir, "auth-token"),
    metadataPath: path.join(dir, "daemon.json"),
    lockPath: path.join(dir, "startup.lock"),
    stdoutLogPath: path.join(dir, "daemon.stdout.log"),
    stderrLogPath: path.join(dir, "daemon.stderr.log"),
  };
}
