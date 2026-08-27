// lib/fff-router/http-client.ts
import path7 from "node:path";

// lib/fff-router/daemon-autostart.ts
import { spawn as spawnChildProcess } from "node:child_process";
import {
  appendFileSync,
  chmodSync as chmodSync2,
  closeSync,
  existsSync as existsSync6,
  fstatSync,
  mkdirSync as mkdirSync4,
  openSync,
  readFileSync as readFileSync5,
  readSync,
  rmSync as rmSync3,
  statSync as statSync4,
  writeFileSync as writeFileSync5
} from "node:fs";
import path6 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// lib/fff-router/daemon-config.ts
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { isIP } from "node:net";
import path2 from "node:path";
import { fileURLToPath } from "node:url";

// lib/fff-router/home-path.ts
import path from "node:path";
function invalid(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function joinHome(home, suffix) {
  return suffix ? path.join(home, suffix) : home;
}
function expandHomePath(candidate, env = process.env) {
  const trimmed = candidate.trim();
  const home = env.HOME?.trim();
  if (trimmed === "~" || trimmed.startsWith("~/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice(2)) };
  }
  if (trimmed === "$HOME" || trimmed.startsWith("$HOME/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice("$HOME/".length)) };
  }
  if (trimmed === "${HOME}" || trimmed.startsWith("${HOME}/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice("${HOME}/".length)) };
  }
  return { ok: true, value: trimmed };
}

// lib/fff-router/daemon-config.ts
var DEFAULT_DAEMON_HOST = "127.0.0.1";
var DAEMON_PROTOCOL_VERSION = "fff-router-v2";
var DEFAULT_DAEMON_PORT = 4319;
var DEFAULT_DAEMON_MCP_PATH = "/mcp";
var DEFAULT_BACKEND_TOOL_TIMEOUT_MS = 3e4;
var DEFAULT_SWEEP_INTERVAL_MS = 3e4;
var DEFAULT_RESTART_BACKOFF_MS = 1e3;
var DEFAULT_RESTART_BACKOFF_MAX_MS = 6e4;
var DEFAULT_PROCESS_SAMPLE_INTERVAL_MS = 5e3;
var DEFAULT_PROCESS_SHUTDOWN_GRACE_MS = 500;
var DEFAULT_PROCESS_KILL_GRACE_MS = 1e3;
var DEFAULT_WORKER_ORPHAN_IDLE_TIMEOUT_MS = 30 * 60 * 1e3;
var DEFAULT_DAEMON_IDLE_TIMEOUT_MS = 30 * 60 * 1e3;
var DEFAULT_MAX_WORKER_RSS_BYTES = 768 * 1024 * 1024;
var DEFAULT_MAX_TOTAL_WORKER_RSS_BYTES = 2 * 1024 * 1024 * 1024;
var moduleDir = path2.dirname(fileURLToPath(import.meta.url));
var PACKAGE_VERSION = "2.0.0";
function hashFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
function packagedDaemonEntrypointPath() {
  const primaryCandidatePath = path2.resolve(moduleDir, "../../dist/bin/fff-routerd.js");
  const candidatePaths = [
    primaryCandidatePath,
    path2.resolve(moduleDir, "../../bin/fff-routerd.js")
  ];
  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return primaryCandidatePath;
}
function contentFingerprint(pathValue) {
  try {
    return createHash("sha256").update(readFileSync(pathValue)).digest("hex");
  } catch {
    return "missing";
  }
}
function getDaemonSourceFingerprint(args = {}) {
  const env = args.env ?? process.env;
  if (env.FFF_ROUTER_DAEMON_SOURCE_FINGERPRINT) {
    return env.FFF_ROUTER_DAEMON_SOURCE_FINGERPRINT;
  }
  const daemonEntrypointPath = args.daemonEntrypointPath ?? env.FFF_ROUTER_DAEMON_BIN ?? env.FFF_ROUTER_DAEMON_ENTRYPOINT ?? (process.versions.perry ? process.execPath : packagedDaemonEntrypointPath());
  return hashFingerprint({
    packageVersion: PACKAGE_VERSION,
    daemonEntrypointPath,
    content: contentFingerprint(daemonEntrypointPath)
  });
}
function userHome(env) {
  return env.HOME || os.homedir();
}
function configHome(env) {
  return env.XDG_CONFIG_HOME || path2.join(userHome(env), ".config");
}
function stateHome(env) {
  return env.XDG_STATE_HOME || path2.join(userHome(env), ".local", "state");
}
function getDefaultDaemonConfig() {
  return {
    host: DEFAULT_DAEMON_HOST,
    port: DEFAULT_DAEMON_PORT,
    mcpPath: DEFAULT_DAEMON_MCP_PATH
  };
}
function getDefaultRouterConfig() {
  return {
    allowlistedNonGitPrefixes: [],
    warmRoots: [],
    ttl: {
      gitMs: 60 * 60 * 1e3,
      nonGitMs: 15 * 60 * 1e3
    },
    limits: {
      maxWorkers: 12,
      maxNonGitWorkers: 4,
      maxWorkerRssBytes: DEFAULT_MAX_WORKER_RSS_BYTES,
      maxTotalWorkerRssBytes: DEFAULT_MAX_TOTAL_WORKER_RSS_BYTES
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
      daemonIdleTimeoutMs: DEFAULT_DAEMON_IDLE_TIMEOUT_MS
    }
  };
}
function getDefaultDaemonReloadConfig() {
  return {
    router: getDefaultRouterConfig()
  };
}
function getDefaultDaemonFileConfig() {
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
      maxTotalWorkerRssBytes: reload.router.limits.maxTotalWorkerRssBytes ?? DEFAULT_MAX_TOTAL_WORKER_RSS_BYTES
    },
    runtime: {
      toolTimeoutMs: reload.router.runtime.toolTimeoutMs,
      sweepIntervalMs: reload.router.runtime.sweepIntervalMs,
      restartBackoffMs: reload.router.runtime.restartBackoffMs,
      restartBackoffMaxMs: reload.router.runtime.restartBackoffMaxMs ?? DEFAULT_RESTART_BACKOFF_MAX_MS,
      processSampleIntervalMs: reload.router.runtime.processSampleIntervalMs ?? DEFAULT_PROCESS_SAMPLE_INTERVAL_MS,
      processShutdownGraceMs: reload.router.runtime.processShutdownGraceMs ?? DEFAULT_PROCESS_SHUTDOWN_GRACE_MS,
      processKillGraceMs: reload.router.runtime.processKillGraceMs ?? DEFAULT_PROCESS_KILL_GRACE_MS,
      workerOrphanIdleTimeoutMs: reload.router.runtime.workerOrphanIdleTimeoutMs ?? DEFAULT_WORKER_ORPHAN_IDLE_TIMEOUT_MS,
      daemonIdleTimeoutMs: reload.router.runtime.daemonIdleTimeoutMs ?? DEFAULT_DAEMON_IDLE_TIMEOUT_MS
    }
  };
}
function serializeDefaultDaemonFileConfig() {
  return `${JSON.stringify(getDefaultDaemonFileConfig(), null, 2)}
`;
}
function getDaemonPolicyConfigPaths(args = {}) {
  const env = args.env ?? process.env;
  const dir = path2.join(configHome(env), "fff-routerd");
  return {
    dir,
    jsonPath: path2.join(dir, "config.json"),
    jsoncPath: path2.join(dir, "config.jsonc")
  };
}
function ensureDefaultConfigFile(paths) {
  mkdirSync(paths.dir, { recursive: true });
  const text = serializeDefaultDaemonFileConfig();
  writeFileSync(paths.jsonPath, text);
  return {
    path: paths.jsonPath,
    text
  };
}
function readPreferredDaemonPolicyFile(args = {}) {
  const paths = getDaemonPolicyConfigPaths(args);
  if (existsSync(paths.jsonPath)) {
    return {
      path: paths.jsonPath,
      text: readFileSync(paths.jsonPath, "utf8")
    };
  }
  if (existsSync(paths.jsoncPath)) {
    return {
      path: paths.jsoncPath,
      text: readFileSync(paths.jsoncPath, "utf8")
    };
  }
  return ensureDefaultConfigFile(paths);
}
function expectObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value;
}
function rejectUnknownKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(
      `${label} contains unknown field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`
    );
  }
}
function readOptionalNumber(value, label) {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}
function readOptionalNonNegativeInteger(value, label) {
  const parsed = readOptionalNumber(value, label);
  if (parsed == null) {
    return void 0;
  }
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}
function readOptionalPositiveInteger(value, label) {
  const parsed = readOptionalNonNegativeInteger(value, label);
  if (parsed === 0) {
    throw new Error(`${label} must be greater than zero`);
  }
  return parsed;
}
function readOptionalPort(value) {
  const parsed = readOptionalNumber(value, "port");
  if (parsed == null) {
    return void 0;
  }
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("port must be an integer between 1 and 65535");
  }
  return parsed;
}
function readOptionalMcpPath(value) {
  const parsed = readOptionalString(value, "mcpPath");
  if (parsed == null) {
    return void 0;
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
function readOptionalHost(value) {
  const host = readOptionalString(value, "host");
  if (host == null) {
    return void 0;
  }
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized !== "localhost" && normalized !== "::1" && !(isIP(normalized) === 4 && normalized.startsWith("127."))) {
    throw new Error("fff-routerd is machine-local; host must be localhost, 127.0.0.0/8, or ::1");
  }
  return host;
}
function readOptionalString(value, label) {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}
function readOptionalStringArray(value, label) {
  if (value == null) {
    return void 0;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value;
}
function expandPathEntries(entries, env) {
  return entries.map((prefix) => expandHomePath(prefix, env)).map((result) => {
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    return result.value;
  }).filter(Boolean).map((entry) => {
    if (!path2.isAbsolute(entry)) {
      throw new Error(`configured paths must be absolute or home-relative: '${entry}'`);
    }
    return path2.normalize(entry);
  });
}
function expandAllowlistEntries(entries, env) {
  return expandPathEntries(entries, env).map((prefix) => ({
    prefix,
    mode: "first-child-root"
  }));
}
function parseJsonWithComments(text) {
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
function normalizeDaemonFileConfig(raw, env) {
  const defaults = getDefaultDaemonFileConfig();
  const fileConfig = expectObject(raw, "fff-routerd config");
  rejectUnknownKeys(
    fileConfig,
    ["host", "port", "mcpPath", "allowlist", "warmRoots", "ttl", "limits", "runtime"],
    "fff-routerd config"
  );
  const ttl = fileConfig.ttl == null ? null : expectObject(fileConfig.ttl, "ttl");
  const limits = fileConfig.limits == null ? null : expectObject(fileConfig.limits, "limits");
  const runtime = fileConfig.runtime == null ? null : expectObject(fileConfig.runtime, "runtime");
  if (ttl) rejectUnknownKeys(ttl, ["gitMs", "nonGitMs"], "ttl");
  if (limits) {
    rejectUnknownKeys(
      limits,
      ["maxWorkers", "maxNonGitWorkers", "maxWorkerRssBytes", "maxTotalWorkerRssBytes"],
      "limits"
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
        "daemonIdleTimeoutMs"
      ],
      "runtime"
    );
  }
  const normalizedEnv = { ...env, HOME: userHome(env) };
  const allowlist = readOptionalStringArray(fileConfig.allowlist, "allowlist") ?? defaults.allowlist;
  const warmRoots = readOptionalStringArray(fileConfig.warmRoots, "warmRoots") ?? defaults.warmRoots;
  const host = readOptionalHost(fileConfig.host) ?? defaults.host;
  const port = readOptionalPort(fileConfig.port) ?? defaults.port;
  const mcpPath = readOptionalMcpPath(fileConfig.mcpPath) ?? defaults.mcpPath;
  const ttlGitMs = readOptionalNonNegativeInteger(ttl?.gitMs, "ttl.gitMs") ?? defaults.ttl.gitMs;
  const ttlNonGitMs = readOptionalNonNegativeInteger(ttl?.nonGitMs, "ttl.nonGitMs") ?? defaults.ttl.nonGitMs;
  const maxWorkers = readOptionalPositiveInteger(limits?.maxWorkers, "limits.maxWorkers") ?? defaults.limits.maxWorkers;
  const maxNonGitWorkers = readOptionalNonNegativeInteger(limits?.maxNonGitWorkers, "limits.maxNonGitWorkers") ?? defaults.limits.maxNonGitWorkers;
  if (maxNonGitWorkers > maxWorkers) {
    throw new Error("limits.maxNonGitWorkers must not exceed limits.maxWorkers");
  }
  const maxWorkerRssBytes = readOptionalPositiveInteger(limits?.maxWorkerRssBytes, "limits.maxWorkerRssBytes") ?? defaults.limits.maxWorkerRssBytes;
  const maxTotalWorkerRssBytes = readOptionalPositiveInteger(limits?.maxTotalWorkerRssBytes, "limits.maxTotalWorkerRssBytes") ?? defaults.limits.maxTotalWorkerRssBytes;
  if (maxTotalWorkerRssBytes < maxWorkerRssBytes) {
    throw new Error("limits.maxTotalWorkerRssBytes must be at least limits.maxWorkerRssBytes");
  }
  const toolTimeoutMs = readOptionalNonNegativeInteger(runtime?.toolTimeoutMs, "runtime.toolTimeoutMs") ?? defaults.runtime.toolTimeoutMs;
  const sweepIntervalMs = readOptionalNonNegativeInteger(runtime?.sweepIntervalMs, "runtime.sweepIntervalMs") ?? defaults.runtime.sweepIntervalMs;
  const restartBackoffMs = readOptionalNonNegativeInteger(runtime?.restartBackoffMs, "runtime.restartBackoffMs") ?? defaults.runtime.restartBackoffMs;
  const restartBackoffMaxMs = readOptionalNonNegativeInteger(runtime?.restartBackoffMaxMs, "runtime.restartBackoffMaxMs") ?? defaults.runtime.restartBackoffMaxMs;
  if (restartBackoffMaxMs < restartBackoffMs) {
    throw new Error("runtime.restartBackoffMaxMs must be at least runtime.restartBackoffMs");
  }
  const processSampleIntervalMs = readOptionalNonNegativeInteger(
    runtime?.processSampleIntervalMs,
    "runtime.processSampleIntervalMs"
  ) ?? defaults.runtime.processSampleIntervalMs;
  const processShutdownGraceMs = readOptionalNonNegativeInteger(
    runtime?.processShutdownGraceMs,
    "runtime.processShutdownGraceMs"
  ) ?? defaults.runtime.processShutdownGraceMs;
  const processKillGraceMs = readOptionalNonNegativeInteger(runtime?.processKillGraceMs, "runtime.processKillGraceMs") ?? defaults.runtime.processKillGraceMs;
  const workerOrphanIdleTimeoutMs = readOptionalNonNegativeInteger(
    runtime?.workerOrphanIdleTimeoutMs,
    "runtime.workerOrphanIdleTimeoutMs"
  ) ?? defaults.runtime.workerOrphanIdleTimeoutMs;
  const daemonIdleTimeoutMs = readOptionalNonNegativeInteger(runtime?.daemonIdleTimeoutMs, "runtime.daemonIdleTimeoutMs") ?? defaults.runtime.daemonIdleTimeoutMs;
  return {
    daemon: {
      host,
      port,
      mcpPath
    },
    reload: {
      router: {
        allowlistedNonGitPrefixes: expandAllowlistEntries(allowlist, normalizedEnv),
        warmRoots: expandPathEntries(warmRoots, normalizedEnv),
        ttl: {
          gitMs: ttlGitMs,
          nonGitMs: ttlNonGitMs
        },
        limits: {
          maxWorkers,
          maxNonGitWorkers,
          maxWorkerRssBytes,
          maxTotalWorkerRssBytes
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
          daemonIdleTimeoutMs
        }
      }
    }
  };
}
function readDaemonConfigFromMetadata(args = {}) {
  const paths = getDaemonPaths(args);
  if (!existsSync(paths.metadataPath)) {
    return null;
  }
  try {
    const metadata = JSON.parse(readFileSync(paths.metadataPath, "utf8"));
    if (typeof metadata.host !== "string" || typeof metadata.port !== "number" || typeof metadata.mcpPath !== "string") {
      return null;
    }
    return {
      host: metadata.host,
      port: metadata.port,
      mcpPath: metadata.mcpPath
    };
  } catch {
    return null;
  }
}
function loadNormalizedDaemonFileConfig(args = {}) {
  const env = args.env ?? process.env;
  const configFile = readPreferredDaemonPolicyFile({ env });
  return normalizeDaemonFileConfig(parseJsonWithComments(configFile.text), env);
}
function getDaemonConfig(args = {}) {
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
function formatDaemonUrlHost(host) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}
function getDaemonOriginFromConfig(config) {
  return `http://${formatDaemonUrlHost(config.host)}:${config.port}`;
}
function getDaemonEndpoint(args = {}) {
  const config = getDaemonConfig(args);
  return `${getDaemonOriginFromConfig(config)}${config.mcpPath}`;
}
function loadDaemonReloadConfig(args = {}) {
  return loadNormalizedDaemonFileConfig(args).reload;
}
function getDaemonServerFingerprint(args = {}) {
  const daemon = getDaemonConfig({ env: args.env });
  return hashFingerprint({
    daemon: {
      ...daemon,
      ...args.daemonConfig
    },
    protocolVersion: DAEMON_PROTOCOL_VERSION,
    daemonSourceFingerprint: getDaemonSourceFingerprint({ env: args.env })
  });
}
function getDaemonReloadFingerprintForConfig(config) {
  return hashFingerprint(config);
}
function getDaemonReloadFingerprint(args = {}) {
  return getDaemonReloadFingerprintForConfig(loadDaemonReloadConfig(args));
}
function getDaemonPaths(args = {}) {
  const env = args.env ?? process.env;
  const dir = path2.join(stateHome(env), "fff-routerd");
  return {
    dir,
    authTokenPath: path2.join(dir, "auth-token"),
    metadataPath: path2.join(dir, "daemon.json"),
    lockPath: path2.join(dir, "startup.lock"),
    stdoutLogPath: path2.join(dir, "daemon.stdout.log"),
    stderrLogPath: path2.join(dir, "daemon.stderr.log")
  };
}

// lib/fff-router/http-daemon.ts
import {
  existsSync as existsSync4,
  mkdirSync as mkdirSync3,
  readFileSync as readFileSync3,
  renameSync,
  rmSync,
  statSync as statSync2,
  writeFileSync as writeFileSync3
} from "node:fs";

// lib/fff-router/process-supervisor.ts
var IS_PERRY = typeof process.versions.perry === "string";

// lib/fff-router/legacy-mcp-client.ts
var IS_PERRY2 = typeof process.versions.perry === "string";
var DEFAULT_MAX_MESSAGE_BYTES = 16 * 1024 * 1024;

// lib/fff-router/tool-resolution.ts
import { existsSync as existsSync2, statSync } from "node:fs";
import path3 from "node:path";
function isExecutable(pathValue) {
  try {
    const stats = statSync(pathValue);
    return stats.isFile() && (process.platform === "win32" || (stats.mode & 73) !== 0);
  } catch {
    return false;
  }
}
function commandExtensions(env) {
  if (process.platform !== "win32") {
    return [""];
  }
  const pathExt = env.PATHEXT?.split(";").filter(Boolean);
  return pathExt && pathExt.length > 0 ? pathExt : [".EXE", ".CMD", ".BAT", ".COM"];
}
function resolveExecutableOnPath(command, env = process.env) {
  const pathValue = env.PATH || process.env.PATH || "";
  const directories = pathValue.split(path3.delimiter).filter(Boolean);
  const extensions = commandExtensions(env);
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidatePath = process.platform === "win32" && extension && !command.toUpperCase().endsWith(extension) ? path3.join(directory, `${command}${extension}`) : path3.join(directory, command);
      if (existsSync2(candidatePath) && isExecutable(candidatePath)) {
        return candidatePath;
      }
    }
  }
  return null;
}

// lib/fff-router/public-api.ts
import path4 from "node:path";
var MAX_RESULTS = 50;
var MAX_CONTEXT_LINES = 5;
var MAX_PATTERNS = 20;
var MAX_FILTERS = 30;
var MAX_WITHIN_PATHS = 10;
var MAX_QUERY_LENGTH = 1024;
var ProtocolValidationError = class extends Error {
  constructor(issues) {
    super(issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`).join("; "));
    this.issues = issues;
  }
  issues;
};
function runtimeSchema(jsonSchema, validate) {
  const schema = { ...jsonSchema };
  Object.defineProperties(schema, {
    // Runtime helpers must not leak into tools/list JSON Schema or create a
    // self-reference when the response is serialized.
    jsonSchema: { value: schema, enumerable: false },
    safeParse: { value: validate, enumerable: false },
    parse: {
      enumerable: false,
      value(value) {
        const result = validate(value);
        if (!result.success) {
          throw new ProtocolValidationError(result.error.issues);
        }
        return result.data;
      }
    }
  });
  return schema;
}
function valid(data) {
  return { success: true, data };
}
function invalidValue(pathValue, message) {
  return { success: false, error: { issues: [{ path: pathValue, message }] } };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejectUnknownFields(value, allowed) {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  return unknown ? invalidValue([unknown], "unknown field") : valid(void 0);
}
function readBoundedString(value, field, options) {
  if (typeof value !== "string") {
    return invalidValue([field], "must be a string");
  }
  const normalized = options.trim ? value.trim() : value;
  if (!options.allowBlank && normalized.length === 0) {
    return invalidValue([field], "must not be blank");
  }
  if (normalized.length > options.max) {
    return invalidValue([field], `must contain at most ${options.max} characters`);
  }
  return valid(normalized);
}
function readStringArray(value, field, options) {
  if (!Array.isArray(value)) {
    return invalidValue([field], "must be an array");
  }
  if (value.length < (options.minItems ?? 0)) {
    return invalidValue([field], `must contain at least ${options.minItems ?? 0} item(s)`);
  }
  if (value.length > options.maxItems) {
    return invalidValue([field], `must contain at most ${options.maxItems} item(s)`);
  }
  const output = [];
  for (let index = 0; index < value.length; index += 1) {
    const parsed = readBoundedString(value[index], `${field}.${index}`, {
      max: options.maxLength,
      trim: true
    });
    if (!parsed.success) {
      return parsed;
    }
    output.push(parsed.data);
  }
  return valid(output);
}
function readWithinInput(value) {
  if (typeof value === "string") {
    return readBoundedString(value, "within", { max: 4096, trim: true });
  }
  return readStringArray(value, "within", {
    minItems: 1,
    maxItems: MAX_WITHIN_PATHS,
    maxLength: 4096
  });
}
function normalizeRelativeFilter(value, field) {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (path4.posix.isAbsolute(normalized)) {
    return invalidValue([field], "path filters must be relative");
  }
  if (normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    return invalidValue(
      [field],
      "path filters must not contain empty, current-directory, or parent-directory segments"
    );
  }
  return valid(normalized);
}
function readRelativeFilters(value, field) {
  if (value === void 0) {
    return valid([]);
  }
  const values = readStringArray(value, field, { maxItems: MAX_FILTERS, maxLength: 512 });
  if (!values.success) {
    return values;
  }
  const normalized = [];
  for (let index = 0; index < values.data.length; index += 1) {
    const parsed = normalizeRelativeFilter(values.data[index], `${field}.${index}`);
    if (!parsed.success) {
      return parsed;
    }
    normalized.push(parsed.data);
  }
  return valid([...new Set(normalized)]);
}
function readExtensions(value) {
  if (value === void 0) {
    return valid([]);
  }
  const values = readStringArray(value, "extensions", {
    maxItems: MAX_FILTERS,
    maxLength: 64
  });
  if (!values.success) {
    return values;
  }
  const normalized = [];
  for (let index = 0; index < values.data.length; index += 1) {
    const extension = values.data[index].replace(/^\./, "");
    if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(extension)) {
      return invalidValue(
        ["extensions", index],
        "extensions must be literal suffixes without path or glob syntax"
      );
    }
    normalized.push(extension);
  }
  return valid([...new Set(normalized)]);
}
function readInteger(value, field, options) {
  if (value === void 0) {
    return valid(options.fallback);
  }
  if (!Number.isInteger(value) || value < options.min || value > options.max) {
    return invalidValue([field], `must be an integer between ${options.min} and ${options.max}`);
  }
  return valid(value);
}
function readCursor(value) {
  if (value === void 0 || value === null) {
    return valid(null);
  }
  return readBoundedString(value, "cursor", { max: 4096, trim: false });
}
var JSON_SCHEMA_2020_12 = "https://json-schema.org/draft/2020-12/schema";
var withinJsonSchema = {
  oneOf: [
    { type: "string", minLength: 1, maxLength: 4096 },
    {
      type: "array",
      minItems: 1,
      maxItems: MAX_WITHIN_PATHS,
      items: { type: "string", minLength: 1, maxLength: 4096 }
    }
  ]
};
var commonJsonSchemaProperties = {
  within: withinJsonSchema,
  glob: { type: "string", minLength: 1, maxLength: 512 },
  extensions: {
    type: "array",
    maxItems: MAX_FILTERS,
    items: { type: "string", minLength: 1, maxLength: 64 },
    default: []
  },
  excludePaths: {
    type: "array",
    maxItems: MAX_FILTERS,
    items: { type: "string", minLength: 1, maxLength: 512 },
    default: []
  },
  limit: { type: "integer", minimum: 1, maximum: MAX_RESULTS, default: 20 },
  cursor: { type: ["string", "null"], minLength: 1, maxLength: 4096, default: null }
};
function parseCommonInput(record) {
  const within = readWithinInput(record.within);
  if (!within.success) return within;
  const extensions = readExtensions(record.extensions);
  if (!extensions.success) return extensions;
  const excludePaths = readRelativeFilters(record.excludePaths, "excludePaths");
  if (!excludePaths.success) return excludePaths;
  const limit = readInteger(record.limit, "limit", { min: 1, max: MAX_RESULTS, fallback: 20 });
  if (!limit.success) return limit;
  const cursor = readCursor(record.cursor);
  if (!cursor.success) return cursor;
  let globValue;
  if (record.glob !== void 0) {
    const globString = readBoundedString(record.glob, "glob", { max: 512, trim: true });
    if (!globString.success) return globString;
    const glob = normalizeRelativeFilter(globString.data, "glob");
    if (!glob.success) return glob;
    if (glob.data.startsWith("!")) {
      return invalidValue(["glob"], "glob is an include filter; use excludePaths for exclusions");
    }
    globValue = glob.data;
  }
  return valid({
    within: within.data,
    ...globValue ? { glob: globValue } : {},
    extensions: extensions.data,
    excludePaths: excludePaths.data,
    limit: limit.data,
    cursor: cursor.data
  });
}
function parseFindFilesInput(value) {
  if (!isRecord(value)) return invalidValue([], "request must be an object");
  const known = rejectUnknownFields(value, [
    "query",
    "within",
    "glob",
    "extensions",
    "excludePaths",
    "limit",
    "cursor"
  ]);
  if (!known.success) return known;
  const query = readBoundedString(value.query, "query", { max: MAX_QUERY_LENGTH, trim: true });
  if (!query.success) return query;
  const common = parseCommonInput(value);
  return common.success ? valid({ query: query.data, ...common.data }) : common;
}
function parseGrepInput(value) {
  if (!isRecord(value)) return invalidValue([], "request must be an object");
  const known = rejectUnknownFields(value, [
    "patterns",
    "literal",
    "contextLines",
    "within",
    "glob",
    "extensions",
    "excludePaths",
    "limit",
    "cursor"
  ]);
  if (!known.success) return known;
  const patterns = readStringArray(value.patterns, "patterns", {
    minItems: 1,
    maxItems: MAX_PATTERNS,
    maxLength: MAX_QUERY_LENGTH
  });
  if (!patterns.success) return patterns;
  if (value.literal !== void 0 && typeof value.literal !== "boolean") {
    return invalidValue(["literal"], "must be a boolean");
  }
  const contextLines = readInteger(value.contextLines, "contextLines", {
    min: 0,
    max: MAX_CONTEXT_LINES,
    fallback: 0
  });
  if (!contextLines.success) return contextLines;
  const common = parseCommonInput(value);
  if (!common.success) return common;
  return valid({
    patterns: patterns.data,
    literal: value.literal === void 0 ? true : value.literal,
    contextLines: contextLines.data,
    ...common.data
  });
}
var findFilesInputSchema = runtimeSchema(
  {
    $schema: JSON_SCHEMA_2020_12,
    type: "object",
    additionalProperties: false,
    required: ["query", "within"],
    properties: {
      query: { type: "string", minLength: 1, maxLength: MAX_QUERY_LENGTH },
      ...commonJsonSchemaProperties
    }
  },
  parseFindFilesInput
);
var grepInputSchema = runtimeSchema(
  {
    $schema: JSON_SCHEMA_2020_12,
    type: "object",
    additionalProperties: false,
    required: ["patterns", "within"],
    properties: {
      patterns: {
        type: "array",
        minItems: 1,
        maxItems: MAX_PATTERNS,
        items: { type: "string", minLength: 1, maxLength: MAX_QUERY_LENGTH }
      },
      literal: { type: "boolean", default: true },
      contextLines: {
        type: "integer",
        minimum: 0,
        maximum: MAX_CONTEXT_LINES,
        default: 0
      },
      ...commonJsonSchemaProperties
    }
  },
  parseGrepInput
);
var fileHitJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "absolutePath"],
  properties: { path: { type: "string" }, absolutePath: { type: "string" } }
};
var textHitJsonSchema = {
  type: "object",
  required: ["path", "absolutePath", "line", "text"],
  properties: {
    ...fileHitJsonSchema.properties,
    line: { type: "integer", minimum: 1 },
    text: { type: "string" },
    column: { type: "integer", minimum: 0 },
    contextBefore: { type: "array", items: { type: "string" } },
    contextAfter: { type: "array", items: { type: "string" } },
    isDefinition: { type: "boolean" },
    definitionBody: { type: "array", items: { type: "string" } }
  }
};
var searchResultStatsJsonSchema = {
  type: "object",
  required: ["resultCount", "coldStart", "workerId", "workerGeneration"],
  properties: {
    resultCount: { type: "integer", minimum: 0 },
    upstreamShownCount: { type: "integer", minimum: 0 },
    upstreamTotalCount: { type: "integer", minimum: 0 },
    coldStart: { type: "boolean" },
    workerId: { type: "string", minLength: 1 },
    workerGeneration: { type: "integer", minimum: 1 }
  }
};
function validateFileHit(value, pathPrefix) {
  if (!isRecord(value)) return invalidValue(pathPrefix, "must be an object");
  if (typeof value.path !== "string")
    return invalidValue([...pathPrefix, "path"], "must be a string");
  if (typeof value.absolutePath !== "string") {
    return invalidValue([...pathPrefix, "absolutePath"], "must be a string");
  }
  return valid(void 0);
}
function validateStats(value) {
  if (!isRecord(value)) return invalidValue(["stats"], "must be an object");
  if (!Number.isInteger(value.resultCount) || value.resultCount < 0) {
    return invalidValue(["stats", "resultCount"], "must be a non-negative integer");
  }
  if (typeof value.coldStart !== "boolean")
    return invalidValue(["stats", "coldStart"], "must be a boolean");
  if (typeof value.workerId !== "string" || value.workerId.length === 0) {
    return invalidValue(["stats", "workerId"], "must be a non-empty string");
  }
  if (!Number.isInteger(value.workerGeneration) || value.workerGeneration < 1) {
    return invalidValue(["stats", "workerGeneration"], "must be a positive integer");
  }
  return valid(void 0);
}
function validateSearchResultBase(value, expectedTool) {
  if (!isRecord(value)) return invalidValue([], "result must be an object");
  if (value.tool !== expectedTool) return invalidValue(["tool"], `must equal '${expectedTool}'`);
  if (typeof value.root !== "string") return invalidValue(["root"], "must be a string");
  if (value.backend !== "fff-mcp") return invalidValue(["backend"], "must equal 'fff-mcp'");
  if (value.nextCursor !== null && typeof value.nextCursor !== "string") {
    return invalidValue(["nextCursor"], "must be a string or null");
  }
  const stats = validateStats(value.stats);
  if (!stats.success) return stats;
  if (!Array.isArray(value.items)) return invalidValue(["items"], "must be an array");
  return valid(value);
}
var findFilesResultJsonSchema = {
  $schema: JSON_SCHEMA_2020_12,
  type: "object",
  required: ["tool", "root", "backend", "items", "nextCursor", "stats"],
  properties: {
    tool: { const: "find_files" },
    root: { type: "string" },
    backend: { const: "fff-mcp" },
    items: { type: "array", items: fileHitJsonSchema },
    nextCursor: { type: ["string", "null"] },
    stats: searchResultStatsJsonSchema
  }
};
var grepResultJsonSchema = {
  $schema: JSON_SCHEMA_2020_12,
  type: "object",
  required: ["tool", "root", "backend", "items", "nextCursor", "stats"],
  properties: {
    tool: { const: "grep" },
    root: { type: "string" },
    backend: { const: "fff-mcp" },
    items: { type: "array", items: textHitJsonSchema },
    nextCursor: { type: ["string", "null"] },
    stats: searchResultStatsJsonSchema
  }
};
var findFilesResultSchema = runtimeSchema(
  findFilesResultJsonSchema,
  (value) => {
    const base = validateSearchResultBase(value, "find_files");
    if (!base.success) return base;
    const items = base.data.items;
    for (let index = 0; index < items.length; index += 1) {
      const item = validateFileHit(items[index], ["items", index]);
      if (!item.success) return item;
    }
    return valid(value);
  }
);
var grepResultSchema = runtimeSchema(grepResultJsonSchema, (value) => {
  const base = validateSearchResultBase(value, "grep");
  if (!base.success) return base;
  const items = base.data.items;
  for (let index = 0; index < items.length; index += 1) {
    const item = validateFileHit(items[index], ["items", index]);
    if (!item.success) return item;
    const record = items[index];
    if (!Number.isInteger(record.line) || record.line < 1) {
      return invalidValue(["items", index, "line"], "must be a positive integer");
    }
    if (typeof record.text !== "string") {
      return invalidValue(["items", index, "text"], "must be a string");
    }
  }
  return valid(value);
});
var publicToolResultSchema = runtimeSchema(
  { oneOf: [findFilesResultJsonSchema, grepResultJsonSchema] },
  (value) => isRecord(value) && value.tool === "find_files" ? findFilesResultSchema.safeParse(value) : grepResultSchema.safeParse(value)
);
function validateWorkerDiagnostic(value, index) {
  if (!isRecord(value)) return invalidValue(["workers", index], "must be an object");
  if (typeof value.root !== "string")
    return invalidValue(["workers", index, "root"], "must be a string");
  if (value.rootType !== "git" && value.rootType !== "non-git") {
    return invalidValue(["workers", index, "rootType"], "must be 'git' or 'non-git'");
  }
  if (!["starting", "ready", "draining", "dead"].includes(String(value.state))) {
    return invalidValue(["workers", index, "state"], "invalid worker state");
  }
  if (!Number.isInteger(value.generation) || value.generation < 1) {
    return invalidValue(["workers", index, "generation"], "must be a positive integer");
  }
  if (!Number.isInteger(value.activeLeases) || value.activeLeases < 0) {
    return invalidValue(["workers", index, "activeLeases"], "must be a non-negative integer");
  }
  return valid(void 0);
}
var workerDiagnosticJsonSchema = {
  type: "object",
  required: [
    "root",
    "rootType",
    "state",
    "generation",
    "activeLeases",
    "lastUsedAt",
    "failureCount"
  ],
  properties: {
    root: { type: "string" },
    rootType: { enum: ["git", "non-git"] },
    state: { enum: ["starting", "ready", "draining", "dead"] },
    workerId: { type: "string" },
    pid: { type: ["integer", "null"] },
    generation: { type: "integer", minimum: 1 },
    activeLeases: { type: "integer", minimum: 0 },
    startedAt: { type: "number", minimum: 0 },
    lastUsedAt: { type: "number", minimum: 0 },
    lastCallAt: { type: "number", minimum: 0 },
    lastSuccessAt: { type: "number", minimum: 0 },
    lastError: { type: "string" },
    lastErrorAt: { type: "number", minimum: 0 },
    failureCount: { type: "integer", minimum: 0 },
    retryAfter: { type: "number", minimum: 0 },
    resources: {
      type: "object",
      properties: {
        sampledAt: { type: "number", minimum: 0 },
        rssBytes: { type: "integer", minimum: 0 },
        cpuTimeMs: { type: "number", minimum: 0 },
        threads: { type: "integer", minimum: 0 },
        processCount: { type: "integer", minimum: 1 }
      }
    },
    terminationReason: { type: "string" }
  }
};
var routerStatusJsonSchema = {
  $schema: JSON_SCHEMA_2020_12,
  type: "object",
  required: ["workers", "limits"],
  properties: {
    workers: { type: "array", items: workerDiagnosticJsonSchema },
    limits: {
      type: "object",
      required: ["maxWorkers", "maxNonGitWorkers"],
      properties: {
        maxWorkers: { type: "integer", minimum: 1 },
        maxNonGitWorkers: { type: "integer", minimum: 0 },
        maxWorkerRssBytes: { type: "integer", minimum: 1 },
        maxTotalWorkerRssBytes: { type: "integer", minimum: 1 }
      }
    },
    resources: {
      type: "object",
      properties: {
        sampledAt: { type: "number", minimum: 0 },
        daemonRssBytes: { type: "integer", minimum: 0 },
        workerRssBytes: { type: "integer", minimum: 0 },
        totalRssBytes: { type: "integer", minimum: 0 },
        measuredWorkers: { type: "integer", minimum: 0 }
      }
    }
  }
};
var routerStatusSchema = runtimeSchema(routerStatusJsonSchema, (value) => {
  if (!isRecord(value)) return invalidValue([], "status must be an object");
  if (!Array.isArray(value.workers)) return invalidValue(["workers"], "must be an array");
  for (let index = 0; index < value.workers.length; index += 1) {
    const worker = validateWorkerDiagnostic(value.workers[index], index);
    if (!worker.success) return worker;
  }
  if (!isRecord(value.limits)) return invalidValue(["limits"], "must be an object");
  if (!Number.isInteger(value.limits.maxWorkers) || value.limits.maxWorkers < 1) {
    return invalidValue(["limits", "maxWorkers"], "must be a positive integer");
  }
  if (!Number.isInteger(value.limits.maxNonGitWorkers) || value.limits.maxNonGitWorkers < 0) {
    return invalidValue(["limits", "maxNonGitWorkers"], "must be a non-negative integer");
  }
  return valid(value);
});
var warmResultJsonSchema = {
  type: "object",
  required: ["workers"],
  properties: { workers: { type: "array", items: workerDiagnosticJsonSchema } }
};
var warmResultSchema = runtimeSchema(
  warmResultJsonSchema,
  (value) => {
    if (!isRecord(value) || !Array.isArray(value.workers)) {
      return invalidValue(["workers"], "must be an array");
    }
    for (let index = 0; index < value.workers.length; index += 1) {
      const worker = validateWorkerDiagnostic(value.workers[index], index);
      if (!worker.success) return worker;
    }
    return valid(value);
  }
);
var evictResultJsonSchema = {
  type: "object",
  required: ["evicted"],
  properties: { evicted: { type: "array", items: { type: "string" } } }
};
var evictResultSchema = runtimeSchema(
  evictResultJsonSchema,
  (value) => isRecord(value) && Array.isArray(value.evicted) && value.evicted.every((item) => typeof item === "string") ? valid(value) : invalidValue(["evicted"], "must be an array of strings")
);
var PUBLIC_TOOL_DEFINITIONS = [
  {
    name: "find_files",
    description: "Fuzzy-search file names and paths using a shared warm fff-mcp index. within must be one or more absolute paths under the same repository or configured non-Git root.",
    inputSchema: findFilesInputSchema,
    outputSchema: findFilesResultJsonSchema
  },
  {
    name: "grep",
    description: "Search file contents through a shared warm fff-mcp index. Multiple patterns use OR semantics; literal matching is the safe default and regex matching must be selected explicitly.",
    inputSchema: grepInputSchema,
    outputSchema: grepResultJsonSchema
  }
];
function invalid2(message) {
  return { ok: false, error: { code: "INVALID_REQUEST", message } };
}
function formatValidationError(error) {
  return error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "request"}: ${issue.message}`).join("; ");
}
function normalizeWithin(value, env) {
  const values = Array.isArray(value) ? value : [value];
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of values) {
    const expanded = expandHomePath(entry.trim(), env);
    if (!expanded.ok) return invalid2(expanded.error.message);
    if (!path4.isAbsolute(expanded.value)) {
      return invalid2("within paths must be absolute on the daemon wire protocol");
    }
    const clean = path4.normalize(expanded.value);
    if (seen.has(clean)) return invalid2(`within contains duplicate path '${clean}'`);
    seen.add(clean);
    normalized.push(clean);
  }
  return { ok: true, value: normalized };
}
function rejectWildcardOnlyRegex(patterns, literal) {
  if (literal) return { ok: true, value: void 0 };
  const wildcardOnly = /^(?:[.^$]*(?:[.][*+?]|[*+])[.^$]*|[.^$\s]*|\.\*[+?]?|\.\+[?]?|[.*?])$/;
  const rejected = patterns.find((pattern) => wildcardOnly.test(pattern.trim()));
  return rejected ? invalid2(`regex '${rejected}' matches everything; provide a concrete expression`) : { ok: true, value: void 0 };
}
function normalizePublicToolInput(tool, input, env = process.env) {
  const parsed = tool === "find_files" ? findFilesInputSchema.safeParse(input) : grepInputSchema.safeParse(input);
  if (!parsed.success) return invalid2(formatValidationError(parsed.error));
  const resolvedWithin = normalizeWithin(parsed.data.within, env);
  if (!resolvedWithin.ok) return resolvedWithin;
  const common = {
    within: resolvedWithin.value,
    ...parsed.data.glob ? { glob: parsed.data.glob } : {},
    extensions: parsed.data.extensions,
    excludePaths: parsed.data.excludePaths,
    limit: parsed.data.limit,
    cursor: parsed.data.cursor
  };
  if (tool === "find_files") {
    const data2 = parsed.data;
    const request2 = { tool, query: data2.query, ...common };
    return { ok: true, value: request2 };
  }
  const data = parsed.data;
  const concreteRegex = rejectWildcardOnlyRegex(data.patterns, data.literal);
  if (!concreteRegex.ok) return concreteRegex;
  const request = {
    tool,
    patterns: [...new Set(data.patterns)],
    literal: data.literal,
    contextLines: data.contextLines,
    ...common
  };
  return { ok: true, value: request };
}

// lib/fff-router/mcp-tools.ts
var adminWithinJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["within"],
  properties: {
    within: {
      oneOf: [
        { type: "string", minLength: 1 },
        {
          type: "array",
          minItems: 1,
          maxItems: 32,
          items: { type: "string", minLength: 1 }
        }
      ]
    }
  }
};
var READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};
var MCP_TOOLS = [
  ...PUBLIC_TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema.jsonSchema,
    outputSchema: tool.outputSchema,
    annotations: READ_ONLY_ANNOTATIONS
  })),
  {
    name: "router_status",
    description: "Show the shared fff-routerd worker pool, resource usage, and health state.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false
    },
    outputSchema: routerStatusJsonSchema,
    annotations: READ_ONLY_ANNOTATIONS
  },
  {
    name: "router_warm",
    description: "Start and retain warm fff-mcp workers for one or more absolute paths.",
    inputSchema: adminWithinJsonSchema,
    outputSchema: warmResultJsonSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "router_evict",
    description: "Drain and remove fff-mcp workers for one or more absolute paths.",
    inputSchema: adminWithinJsonSchema,
    outputSchema: evictResultJsonSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  }
];
var MCP_INPUT_SCHEMAS = {
  find_files: findFilesInputSchema.jsonSchema,
  grep: grepInputSchema.jsonSchema,
  router_status: MCP_TOOLS.find((tool) => tool.name === "router_status").inputSchema,
  router_warm: adminWithinJsonSchema,
  router_evict: adminWithinJsonSchema
};

// lib/fff-router/mcp-server.ts
var MCP_PROTOCOL_VERSION = "2026-07-28";

// lib/fff-router/local-auth.ts
import { chmodSync, existsSync as existsSync3, mkdirSync as mkdirSync2, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "node:fs";
function validToken(value) {
  return /^[A-Za-z0-9_-]{32,}$/.test(value);
}
async function readDaemonAuthToken(env = process.env) {
  const tokenPath = getDaemonPaths({ env }).authTokenPath;
  if (!existsSync3(tokenPath)) {
    return null;
  }
  try {
    const token = readFileSync2(tokenPath, "utf8").trim();
    return validToken(token) ? token : null;
  } catch {
    return null;
  }
}
function bearerHeaders(token) {
  return token ? { authorization: `Bearer ${token}` } : {};
}

// lib/fff-router/http-daemon.ts
var MAX_REQUEST_BODY_BYTES = 1024 * 1024;
var IS_PERRY3 = typeof process.versions.perry === "string";
async function readDaemonMetadata(pathValue) {
  if (!existsSync4(pathValue)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync3(pathValue, "utf8"));
  } catch {
    return null;
  }
}

// lib/fff-router/http-json.ts
import { spawn } from "node:child_process";
import { existsSync as existsSync5, readFileSync as readFileSync4, rmSync as rmSync2, statSync as statSync3, writeFileSync as writeFileSync4 } from "node:fs";
import os2 from "node:os";
import path5 from "node:path";
var IS_PERRY4 = typeof process.versions.perry === "string";
var MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function stopDetachedProcess(pid) {
  if (!pid) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, "SIGKILL");
  } catch {
  }
}
function assertLocalHttpUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" && url.hostname !== "::1" && url.hostname !== "localhost") {
    throw new Error(`native daemon HTTP requests must target loopback, got ${url.origin}`);
  }
}
function parsePayload(text) {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
async function curlJsonRequest(url, request) {
  assertLocalHttpUrl(url);
  const timeoutMs = Math.max(250, request.timeoutMs ?? 3e4);
  const nonce = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const basePath = path5.join(os2.tmpdir(), `.fff-router-http.${nonce}`);
  const bodyPath = `${basePath}.response`;
  const codePath = `${basePath}.code`;
  const stderrPath = `${basePath}.stderr`;
  const statusPath = `${basePath}.status`;
  const requestPath = `${basePath}.request`;
  if (request.body !== void 0) writeFileSync4(requestPath, request.body, { mode: 384 });
  const shell = 'status_path="$1"; code_path="$2"; stderr_path="$3"; shift 3; "$@" >"$code_path" 2>"$stderr_path"; code=$?; printf "%s\\n" "$code" >"$status_path"';
  const curlArgs = [
    "--silent",
    "--show-error",
    "--connect-timeout",
    String(Math.max(1, Math.ceil(Math.min(timeoutMs, 5e3) / 1e3))),
    "--max-time",
    String(Math.max(1, Math.ceil(timeoutMs / 1e3))),
    "--request",
    request.method ?? "GET",
    ...Object.entries(request.headers ?? {}).flatMap(([name, value]) => [
      "--header",
      `${name}: ${value}`
    ]),
    "--output",
    bodyPath,
    "--write-out",
    "%{http_code}",
    ...request.body !== void 0 ? ["--data-binary", `@${requestPath}`] : [],
    url
  ];
  const child = spawn(
    "/bin/sh",
    ["-c", shell, "fff-router-http", statusPath, codePath, stderrPath, "curl", ...curlArgs],
    { detached: process.platform !== "win32", stdio: "ignore" }
  );
  child.unref();
  const deadline = Date.now() + timeoutMs + 2e3;
  try {
    while (!existsSync5(statusPath)) {
      if (Date.now() >= deadline) {
        stopDetachedProcess(child.pid);
        throw new Error(`daemon HTTP ${request.method ?? "GET"} ${url} timed out`);
      }
      await wait(10);
    }
    const exitCode = Number(readFileSync4(statusPath, "utf8").trim());
    if (exitCode !== 0) {
      const stderr = existsSync5(stderrPath) ? readFileSync4(stderrPath, "utf8").trim() : "";
      throw new Error(
        `daemon HTTP ${request.method ?? "GET"} ${url} failed with curl exit ${exitCode}: ${stderr || "unknown error"}`
      );
    }
    const status = Number(existsSync5(codePath) ? readFileSync4(codePath, "utf8").trim() : "");
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      throw new Error(`daemon HTTP ${request.method ?? "GET"} ${url} returned no status`);
    }
    if (existsSync5(bodyPath) && statSync3(bodyPath).size > MAX_RESPONSE_BYTES) {
      throw new Error(`daemon HTTP response exceeds ${MAX_RESPONSE_BYTES} bytes`);
    }
    const payload = existsSync5(bodyPath) ? parsePayload(readFileSync4(bodyPath, "utf8")) : null;
    return { status, ok: status >= 200 && status < 300, payload };
  } finally {
    rmSync2(bodyPath, { force: true });
    rmSync2(codePath, { force: true });
    rmSync2(stderrPath, { force: true });
    rmSync2(statusPath, { force: true });
    rmSync2(requestPath, { force: true });
  }
}
async function requestJson(url, request = {}) {
  if (IS_PERRY4) return await curlJsonRequest(url, request);
  const response = await fetch(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: AbortSignal.timeout(request.timeoutMs ?? 3e4)
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, payload };
}

// lib/fff-router/daemon-autostart.ts
var moduleDir2 = path6.dirname(fileURLToPath2(import.meta.url));
var STARTUP_LOCK_TIMEOUT_MS = 15e3;
var DaemonHealthMismatchError = class extends Error {
  constructor(message, mismatchKind2, metadata) {
    super(message);
    this.mismatchKind = mismatchKind2;
    this.metadata = metadata;
  }
  mismatchKind;
  metadata;
};
function packagedDaemonEntrypointPath2() {
  const primaryCandidatePath = path6.resolve(moduleDir2, "../../dist/bin/fff-routerd.js");
  const candidatePaths = [
    primaryCandidatePath,
    path6.resolve(moduleDir2, "../../bin/fff-routerd.js")
  ];
  for (const candidatePath of candidatePaths) {
    if (existsSync6(candidatePath)) {
      return candidatePath;
    }
  }
  return primaryCandidatePath;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function resolveDaemonLaunchCommand(env = process.env, deps = {}) {
  if (env.FFF_ROUTER_DAEMON_BIN) {
    return { command: env.FFF_ROUTER_DAEMON_BIN, args: [], source: "env" };
  }
  if (env.FFF_ROUTER_DAEMON_ENTRYPOINT) {
    return { command: process.execPath, args: [env.FFF_ROUTER_DAEMON_ENTRYPOINT], source: "env" };
  }
  if (deps.nativeRuntime ?? Boolean(process.versions.perry)) {
    return { command: process.execPath, args: ["__daemon"], source: "native" };
  }
  if (!deps.preferPackaged && env.FFF_ROUTER_DAEMON_ALLOW_PATH === "1") {
    const resolvedCommand = (deps.resolveExecutableOnPath ?? ((command) => resolveExecutableOnPath(command, env)))("fff-routerd");
    if (resolvedCommand) {
      return { command: resolvedCommand, args: [], source: "path" };
    }
  }
  return {
    command: process.execPath,
    args: [packagedDaemonEntrypointPath2()],
    source: "packaged"
  };
}
async function fetchHealthMetadata(env) {
  const config = getDaemonConfig({ env });
  const response = await requestJson(`${getDaemonOriginFromConfig(config)}/health`, {
    headers: bearerHeaders(await readDaemonAuthToken(env))
  });
  if (!response.ok) {
    throw new Error(`daemon healthcheck failed with status ${response.status}`);
  }
  const payload = response.payload;
  if (!payload.ok || !payload.metadata) {
    throw new Error("daemon healthcheck returned an invalid payload");
  }
  return payload.metadata;
}
function parsePackageVersion(version) {
  if (typeof version !== "string") {
    return null;
  }
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[.-].*)?$/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function comparePackageVersions(left, right) {
  const leftParts = parsePackageVersion(left);
  const rightParts = parsePackageVersion(right);
  if (!leftParts || !rightParts) {
    return null;
  }
  for (const index of [0, 1, 2]) {
    if (leftParts[index] < rightParts[index]) {
      return -1;
    }
    if (leftParts[index] > rightParts[index]) {
      return 1;
    }
  }
  return 0;
}
function endpointMatchesConfig(metadata, config = getDaemonConfig()) {
  return metadata.host === config.host && metadata.port === config.port && metadata.mcpPath === config.mcpPath;
}
function isNewerCompatibleDaemon(metadata, env) {
  if (!metadata) {
    return false;
  }
  return comparePackageVersions(metadata.packageVersion, PACKAGE_VERSION) === 1 && metadata.protocolVersion === DAEMON_PROTOCOL_VERSION && endpointMatchesConfig(metadata, getDaemonConfig({ env }));
}
function assertCompatibleProtocolAndVersion(metadata, env) {
  const versionComparison = comparePackageVersions(metadata.packageVersion, PACKAGE_VERSION);
  const runningDaemonIsNewer = versionComparison === 1;
  if (metadata.protocolVersion !== DAEMON_PROTOCOL_VERSION) {
    if (runningDaemonIsNewer) {
      throw new Error(
        `newer incompatible fff-routerd is already running: expected protocol ${DAEMON_PROTOCOL_VERSION}, got ${metadata.protocolVersion}. Update this client or stop fff-routerd manually.`
      );
    }
    throw new DaemonHealthMismatchError(
      `daemon protocol mismatch: expected ${DAEMON_PROTOCOL_VERSION}, got ${metadata.protocolVersion}`,
      "protocol",
      metadata
    );
  }
  if (versionComparison === 1) {
    if (!endpointMatchesConfig(metadata, getDaemonConfig({ env }))) {
      throw new Error(
        "newer fff-routerd is already running at this endpoint, but its metadata does not match the expected daemon endpoint. Stop fff-routerd manually before starting this client."
      );
    }
    return "running-newer";
  }
  if (versionComparison !== 0 || metadata.packageVersion !== PACKAGE_VERSION) {
    throw new DaemonHealthMismatchError(
      `daemon package version mismatch: expected ${PACKAGE_VERSION}, got ${metadata.packageVersion}`,
      "version",
      metadata
    );
  }
  return "same";
}
async function checkDaemonBaseHealth(env) {
  const metadata = await fetchHealthMetadata(env);
  if (assertCompatibleProtocolAndVersion(metadata, env) === "running-newer") {
    return;
  }
  const expectedServerFingerprint = getDaemonServerFingerprint({ env });
  if (metadata.serverFingerprint !== expectedServerFingerprint) {
    throw new DaemonHealthMismatchError(
      "daemon server config mismatch; restart required",
      "server",
      metadata
    );
  }
}
async function checkDaemonHealth(env) {
  const metadata = await fetchHealthMetadata(env);
  if (assertCompatibleProtocolAndVersion(metadata, env) === "running-newer") {
    return;
  }
  const expectedServerFingerprint = getDaemonServerFingerprint({ env });
  if (metadata.serverFingerprint !== expectedServerFingerprint) {
    throw new DaemonHealthMismatchError(
      "daemon server config mismatch; restart required",
      "server",
      metadata
    );
  }
  const expectedReloadFingerprint = getDaemonReloadFingerprint({ env });
  if (metadata.reloadFingerprint !== expectedReloadFingerprint) {
    throw new DaemonHealthMismatchError(
      "daemon reload config mismatch; send SIGHUP to reload configuration",
      "reload",
      metadata
    );
  }
}
function shouldReclaimStartupLock(args) {
  const now = args.now ?? Date.now();
  let pid = 0;
  let createdAt = args.mtimeMs;
  try {
    const parsed = JSON.parse(args.contents);
    if (typeof parsed === "number") {
      pid = parsed;
    } else if (parsed && typeof parsed === "object") {
      const record = parsed;
      pid = typeof record.pid === "number" ? record.pid : 0;
      createdAt = typeof record.createdAt === "number" ? record.createdAt : args.mtimeMs;
    }
  } catch {
    pid = Number.parseInt(args.contents.trim(), 10);
  }
  if (!Number.isFinite(pid) || pid <= 0) {
    return true;
  }
  if (!Number.isFinite(createdAt) || now - createdAt >= STARTUP_LOCK_TIMEOUT_MS) {
    return true;
  }
  return !(args.isAlive ?? isProcessAlive)(pid);
}
async function withStartupLock(callback, env) {
  const paths = getDaemonPaths({ env });
  mkdirSync4(paths.dir, { recursive: true, mode: 448 });
  if (process.platform !== "win32") {
    chmodSync2(paths.dir, 448);
  }
  const startedAt = Date.now();
  while (true) {
    let lockFd;
    try {
      lockFd = openSync(paths.lockPath, "wx", 384);
      writeFileSync5(lockFd, JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
    } catch (error) {
      if (typeof error !== "object" || !error || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      let contents = "";
      let lockStat = null;
      try {
        contents = readFileSync5(paths.lockPath, "utf8");
        lockStat = statSync4(paths.lockPath);
      } catch {
      }
      if (!lockStat || shouldReclaimStartupLock({ contents, mtimeMs: lockStat.mtimeMs, now: Date.now() })) {
        rmSync3(paths.lockPath, { force: true });
        continue;
      }
      if (Date.now() - startedAt > STARTUP_LOCK_TIMEOUT_MS) {
        throw new Error("timed out while waiting for the daemon startup lock");
      }
      await sleep(50);
      continue;
    }
    try {
      return await callback();
    } finally {
      closeSync(lockFd);
      rmSync3(paths.lockPath, { force: true });
    }
  }
}
function isRecoverableHealthError(error) {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = error.message.toLowerCase();
  return code === "ECONNREFUSED" || code === "ConnectionRefused" || message.includes("fetch") || message.includes("econnrefused") || message.includes("connectionrefused") || message.includes("unable to connect") || message.includes("healthcheck failed");
}
function mismatchKind(error) {
  if (error instanceof DaemonHealthMismatchError) {
    return error.mismatchKind;
  }
  if (typeof error === "object" && error && "mismatchKind" in error && (error.mismatchKind === "protocol" || error.mismatchKind === "version" || error.mismatchKind === "server" || error.mismatchKind === "reload")) {
    return error.mismatchKind;
  }
  return null;
}
function mismatchPid(error) {
  if (error instanceof DaemonHealthMismatchError && typeof error.metadata?.pid === "number") {
    return error.metadata.pid;
  }
  if (typeof error === "object" && error && "metadata" in error && typeof error.metadata === "object" && error.metadata && "pid" in error.metadata && typeof error.metadata.pid === "number") {
    return error.metadata.pid;
  }
  return null;
}
function mismatchMetadata(error) {
  if (error instanceof DaemonHealthMismatchError) {
    return error.metadata;
  }
  if (typeof error === "object" && error && "metadata" in error && typeof error.metadata === "object" && error.metadata) {
    return error.metadata;
  }
  return null;
}
function shouldPreserveNewerDaemonMismatch(error, env) {
  return mismatchKind(error) !== null && isNewerCompatibleDaemon(mismatchMetadata(error), env);
}
function spawnDaemon(env, options) {
  const launchCommand = resolveDaemonLaunchCommand(env ?? process.env, options);
  const paths = getDaemonPaths({ env });
  mkdirSync4(paths.dir, { recursive: true, mode: 448 });
  if (process.platform !== "win32") {
    chmodSync2(paths.dir, 448);
  }
  const stdoutFd = openSync(paths.stdoutLogPath, "a", 384);
  const stderrFd = openSync(paths.stderrLogPath, "a", 384);
  let child;
  try {
    child = spawnChildProcess(launchCommand.command, launchCommand.args, {
      env: env ?? process.env,
      detached: true,
      stdio: ["ignore", stdoutFd, stderrFd]
    });
  } finally {
    closeSync(stdoutFd);
    closeSync(stderrFd);
  }
  child.once("error", (error) => {
    try {
      appendFileSync(paths.stderrLogPath, `fff-routerd spawn failed: ${error.message}
`, {
        mode: 384
      });
    } catch {
    }
  });
  return {
    unref: () => child.unref(),
    source: launchCommand.source
  };
}
async function readLogTail(pathValue, maxBytes = 4096) {
  let fd;
  try {
    fd = openSync(pathValue, "r");
    const details = fstatSync(fd);
    const length = Math.min(details.size, maxBytes);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, Math.max(0, details.size - length));
    return buffer.toString("utf8").trimEnd();
  } catch {
    return "";
  } finally {
    if (fd !== void 0) {
      try {
        closeSync(fd);
      } catch {
      }
    }
  }
}
async function formatDaemonStartupError(error, env) {
  const paths = getDaemonPaths({ env });
  const message = error instanceof Error ? error.message : String(error);
  const stderrTail = await readLogTail(paths.stderrLogPath);
  const details = [
    message,
    `daemon stdout log: ${paths.stdoutLogPath}`,
    `daemon stderr log: ${paths.stderrLogPath}`,
    ...stderrTail ? [`recent daemon stderr:
${stderrTail}`] : []
  ];
  return new Error(details.join("\n"));
}
async function waitForDaemonReady(env) {
  let lastError;
  for (const delay of [50, 100, 200, 400, 800, 1200]) {
    const metadata = await readRunningDaemonMetadata(env);
    if (!metadata || !isProcessAlive(metadata.pid)) {
      lastError = new Error("daemon metadata is not ready");
      await sleep(delay);
      continue;
    }
    try {
      await checkDaemonHealth(env);
      return;
    } catch (error) {
      lastError = error;
      await sleep(delay);
    }
  }
  throw await formatDaemonStartupError(lastError, env);
}
async function signalProcess(pid, signal) {
  if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) {
    return;
  }
  try {
    process.kill(pid, signal);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ESRCH") {
      return;
    }
    throw error;
  }
}
async function terminateProcess(pid) {
  if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) {
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
  for (const delay of [25, 50, 100, 200, 400, 800]) {
    if (!isProcessAlive(pid)) {
      return;
    }
    await sleep(delay);
  }
  if (isProcessAlive(pid)) {
    process.kill(pid, "SIGKILL");
  }
}
async function ensureDaemonRunningWithDeps(env, deps) {
  const processIsAlive = deps.isProcessAlive ?? isProcessAlive;
  const initialMetadata = await deps.readRunningDaemonMetadata(env);
  if (initialMetadata && processIsAlive(initialMetadata.pid)) {
    try {
      await deps.checkDaemonHealth(env);
      return;
    } catch (error) {
      if (shouldPreserveNewerDaemonMismatch(error, env)) {
        return;
      }
      if (!isRecoverableHealthError(error) && mismatchKind(error) === null) {
        throw error;
      }
    }
  }
  await deps.withStartupLock(async () => {
    const lockedMetadata = await deps.readRunningDaemonMetadata(env);
    if (lockedMetadata && processIsAlive(lockedMetadata.pid)) {
      try {
        await deps.checkDaemonHealth(env);
        return;
      } catch (error) {
        if (shouldPreserveNewerDaemonMismatch(error, env)) {
          return;
        }
        const pid = mismatchPid(error);
        if (mismatchKind(error) === "reload") {
          if (pid) {
            try {
              await deps.signalProcess(pid, "SIGHUP");
              await deps.waitForDaemonReady(env);
              return;
            } catch {
            }
          }
        }
        if (mismatchKind(error) === "protocol" || mismatchKind(error) === "version" || mismatchKind(error) === "server" || mismatchKind(error) === "reload") {
          if (pid) {
            await deps.terminateProcess(pid);
          }
        } else if (!isRecoverableHealthError(error)) {
          throw error;
        }
      }
    }
    let child = deps.spawnDaemon(env);
    try {
      try {
        await deps.waitForDaemonReady(env);
      } catch (error) {
        if (shouldPreserveNewerDaemonMismatch(error, env)) {
          return;
        }
        if (child.source === "path" && (mismatchKind(error) === "protocol" || mismatchKind(error) === "version")) {
          const spawnedPid = mismatchPid(error) ?? (await deps.readRunningDaemonMetadata(env))?.pid ?? null;
          if (spawnedPid) {
            await deps.terminateProcess(spawnedPid);
          }
          child = deps.spawnDaemon(env, { preferPackaged: true });
          await deps.waitForDaemonReady(env);
        } else {
          throw error;
        }
      }
    } finally {
      child.unref();
    }
  }, env);
}
async function ensureDaemonRunning(env) {
  await ensureDaemonRunningWithDeps(env, {
    checkDaemonHealth,
    checkDaemonBaseHealth,
    readRunningDaemonMetadata,
    signalProcess,
    terminateProcess,
    spawnDaemon,
    waitForDaemonReady,
    withStartupLock
  });
}
async function readRunningDaemonMetadata(env) {
  const paths = getDaemonPaths({ env });
  return await readDaemonMetadata(paths.metadataPath);
}

// lib/fff-router/http-client.ts
function clientError(message) {
  return { ok: false, error: { code: "DAEMON_UNAVAILABLE", message, retryable: true } };
}
function errorFromResponse(response) {
  const text = response.content?.find((item) => item.type === "text")?.text ?? "tool call failed";
  try {
    const parsed = JSON.parse(text);
    return {
      code: parsed.code ?? "INTERNAL_ERROR",
      message: parsed.message ?? text
    };
  } catch {
    return { code: "INTERNAL_ERROR", message: text };
  }
}
function structured(response, schema) {
  if (response.isError) return { ok: false, error: errorFromResponse(response) };
  if (response.structuredContent === void 0) {
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "fff-routerd returned no structured content" }
    };
  }
  const parsed = schema.safeParse(response.structuredContent);
  if (!parsed.success) {
    const details = parsed.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".") || "result"}: ${issue.message}`).join("; ");
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: `fff-routerd returned incompatible structured content: ${details}`
      }
    };
  }
  return { ok: true, value: parsed.data };
}
function resolveWithin(within, cwd, env) {
  const values = within === void 0 ? [cwd] : Array.isArray(within) ? within : [within];
  return values.map((value) => {
    const expanded = expandHomePath(value, env);
    if (!expanded.ok) throw new Error(expanded.error.message);
    return path7.isAbsolute(expanded.value) ? path7.normalize(expanded.value) : path7.resolve(cwd, expanded.value);
  });
}
function encodeMcpHeader(value) {
  if (/^[\x21-\x7e](?:[\x20-\x7e]*[\x21-\x7e])?$/.test(value) && !value.startsWith("=?base64?")) {
    return value;
  }
  return `=?base64?${Buffer.from(value, "utf8").toString("base64")}?=`;
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var RouterClient = class {
  endpoint = null;
  authToken = null;
  connecting = null;
  closed = false;
  requestId = 0;
  env;
  cwd;
  autoStart;
  get isClosed() {
    return this.closed;
  }
  constructor(options = {}) {
    this.env = options.env ?? process.env;
    this.cwd = path7.resolve(options.cwd ?? process.cwd());
    this.autoStart = options.autoStart !== false;
  }
  async connect() {
    if (this.closed) throw new Error("fff-router client is closed");
    if (this.endpoint && this.authToken) return;
    if (this.connecting) return await this.connecting;
    this.connecting = (async () => {
      if (this.autoStart) await ensureDaemonRunning(this.env);
      const authToken = await readDaemonAuthToken(this.env);
      if (!authToken)
        throw new Error("fff-routerd authentication token is missing; restart the daemon");
      this.endpoint = getDaemonEndpoint({ env: this.env });
      this.authToken = authToken;
    })();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }
  disconnect() {
    this.endpoint = null;
    this.authToken = null;
  }
  async request(method, params, name) {
    await this.connect();
    const id = ++this.requestId;
    const body = {
      jsonrpc: "2.0",
      id,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientInfo": {
            name: "fff-router-client",
            version: PACKAGE_VERSION
          },
          "io.modelcontextprotocol/clientCapabilities": {}
        }
      }
    };
    const response = await requestJson(this.endpoint, {
      method: "POST",
      headers: {
        ...bearerHeaders(this.authToken),
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": MCP_PROTOCOL_VERSION,
        "mcp-method": method,
        ...name ? { "mcp-name": encodeMcpHeader(name) } : {}
      },
      body: JSON.stringify(body)
    });
    const payload = response.payload;
    if (!isRecord2(payload) || payload.jsonrpc !== "2.0" || payload.id !== id) {
      throw new Error(`fff-routerd returned an invalid MCP response (HTTP ${response.status})`);
    }
    if (isRecord2(payload.error)) {
      const code = typeof payload.error.code === "number" ? payload.error.code : -32603;
      const message = typeof payload.error.message === "string" ? payload.error.message : "MCP request failed";
      throw new Error(`MCP ${code}: ${message}`);
    }
    if (!("result" in payload)) throw new Error("fff-routerd MCP response has no result");
    return payload.result;
  }
  async callMcpTool(name, input, allowReconnect = true) {
    try {
      return await this.request("tools/call", { name, arguments: input }, name);
    } catch (caught) {
      this.disconnect();
      if (allowReconnect) return await this.callMcpTool(name, input, false);
      throw caught;
    }
  }
  async callTool(name, input, schema) {
    try {
      return structured(await this.callMcpTool(name, input), schema);
    } catch (caught) {
      return clientError(caught instanceof Error ? caught.message : String(caught));
    }
  }
  async findFiles(input) {
    return await this.callTool(
      "find_files",
      { ...input, within: resolveWithin(input.within, this.cwd, this.env) },
      findFilesResultSchema
    );
  }
  async grep(input) {
    return await this.callTool(
      "grep",
      {
        ...input,
        patterns: Array.isArray(input.patterns) ? input.patterns : [input.patterns],
        within: resolveWithin(input.within, this.cwd, this.env)
      },
      grepResultSchema
    );
  }
  async warm(within) {
    return await this.callTool(
      "router_warm",
      { within: resolveWithin(within, this.cwd, this.env) },
      warmResultSchema
    );
  }
  async evict(within) {
    return await this.callTool(
      "router_evict",
      { within: resolveWithin(within, this.cwd, this.env) },
      evictResultSchema
    );
  }
  async status() {
    return await this.callTool("router_status", {}, routerStatusSchema);
  }
  async close() {
    this.closed = true;
    this.disconnect();
  }
};
async function connectRouter(options = {}) {
  const client = new RouterClient(options);
  const status = await client.status();
  if (!status.ok) {
    await client.close();
    throw new Error(`${status.error.code}: ${status.error.message}`);
  }
  return client;
}
var CLIENTS_KEY = "__fffRouterClientsV2__";
function globalClients() {
  const global = globalThis;
  return global[CLIENTS_KEY] ??= /* @__PURE__ */ new Map();
}
async function getRouterClient(options = {}) {
  const env = options.env ?? process.env;
  const key = `${getDaemonEndpoint({ env })}::${getDaemonPaths({ env }).authTokenPath}::${path7.resolve(options.cwd ?? process.cwd())}::${options.autoStart !== false}`;
  const clients = globalClients();
  let client = clients.get(key);
  if (!client) {
    client = connectRouter(options).catch((caught) => {
      clients.delete(key);
      throw caught;
    });
    clients.set(key, client);
  }
  const resolved = await client;
  if (resolved.isClosed) {
    clients.delete(key);
    return await getRouterClient(options);
  }
  return resolved;
}
export {
  MAX_CONTEXT_LINES,
  MAX_FILTERS,
  MAX_PATTERNS,
  MAX_QUERY_LENGTH,
  MAX_RESULTS,
  MAX_WITHIN_PATHS,
  PUBLIC_TOOL_DEFINITIONS,
  ProtocolValidationError,
  RouterClient,
  connectRouter,
  evictResultJsonSchema,
  evictResultSchema,
  findFilesInputSchema,
  findFilesResultJsonSchema,
  findFilesResultSchema,
  getRouterClient,
  grepInputSchema,
  grepResultJsonSchema,
  grepResultSchema,
  normalizePublicToolInput,
  publicToolResultSchema,
  routerStatusJsonSchema,
  routerStatusSchema,
  warmResultJsonSchema,
  warmResultSchema,
  workerDiagnosticJsonSchema
};
