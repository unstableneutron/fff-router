#!/usr/bin/env node

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
var DAEMON_PROTOCOL_VERSION = "fff-router-v1";
var DEFAULT_DAEMON_PORT = 4319;
var DEFAULT_DAEMON_MCP_PATH = "/mcp";
var DEFAULT_BACKEND_TOOL_TIMEOUT_MS = 3e4;
var DEFAULT_SWEEP_INTERVAL_MS = 3e4;
var DEFAULT_RESTART_BACKOFF_MS = 1e3;
var moduleDir = path2.dirname(fileURLToPath(import.meta.url));
function packageVersion() {
  const candidatePaths = [
    path2.resolve(moduleDir, "../../package.json"),
    path2.resolve(moduleDir, "../../../package.json")
  ];
  for (const candidatePath of candidatePaths) {
    if (!existsSync(candidatePath)) {
      continue;
    }
    const parsed = JSON.parse(readFileSync(candidatePath, "utf8"));
    if (typeof parsed.version === "string" && parsed.version.length > 0) {
      return parsed.version;
    }
  }
  throw new Error("Unable to determine fff-router package version");
}
var PACKAGE_VERSION = packageVersion();
var PACKAGE_MANAGER = "pnpm@11.19.0";
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
  const daemonEntrypointPath = args.daemonEntrypointPath ?? env.FFF_ROUTER_DAEMON_BIN ?? env.FFF_ROUTER_DAEMON_ENTRYPOINT ?? packagedDaemonEntrypointPath();
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
      maxNonGitWorkers: 4
    },
    runtime: {
      toolTimeoutMs: DEFAULT_BACKEND_TOOL_TIMEOUT_MS,
      sweepIntervalMs: DEFAULT_SWEEP_INTERVAL_MS,
      restartBackoffMs: DEFAULT_RESTART_BACKOFF_MS
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
    limits: { ...reload.router.limits },
    runtime: {
      ...reload.router.runtime
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
  if (parsed === "/health") {
    throw new Error("mcpPath '/health' is reserved");
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
    throw new Error("fff-routerd v1 is machine-local; host must be localhost, 127.0.0.0/8, or ::1");
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
  if (limits) rejectUnknownKeys(limits, ["maxWorkers", "maxNonGitWorkers"], "limits");
  if (runtime) {
    rejectUnknownKeys(runtime, ["toolTimeoutMs", "sweepIntervalMs", "restartBackoffMs"], "runtime");
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
  const maxNonGitWorkers = readOptionalPositiveInteger(limits?.maxNonGitWorkers, "limits.maxNonGitWorkers") ?? defaults.limits.maxNonGitWorkers;
  if (maxNonGitWorkers > maxWorkers) {
    throw new Error("limits.maxNonGitWorkers must not exceed limits.maxWorkers");
  }
  const toolTimeoutMs = readOptionalNonNegativeInteger(runtime?.toolTimeoutMs, "runtime.toolTimeoutMs") ?? defaults.runtime.toolTimeoutMs;
  const sweepIntervalMs = readOptionalNonNegativeInteger(runtime?.sweepIntervalMs, "runtime.sweepIntervalMs") ?? defaults.runtime.sweepIntervalMs;
  const restartBackoffMs = readOptionalNonNegativeInteger(runtime?.restartBackoffMs, "runtime.restartBackoffMs") ?? defaults.runtime.restartBackoffMs;
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
          maxNonGitWorkers
        },
        runtime: {
          toolTimeoutMs,
          sweepIntervalMs,
          restartBackoffMs
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

// lib/fff-router/daemon-autostart.ts
import { spawn as spawnChildProcess } from "node:child_process";
import { appendFileSync, chmodSync, closeSync, existsSync as existsSync3, mkdirSync as mkdirSync2, openSync } from "node:fs";
import { chmod as chmod2, mkdir as mkdir3, open, readFile as readFile3, rm as rm2, stat } from "node:fs/promises";
import path6 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// lib/fff-router/http-daemon.ts
import { mkdir as mkdir2, readFile as readFile2, rename, rm, writeFile as writeFile2 } from "node:fs/promises";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// lib/fff-router/adapters/fff-mcp-stdio.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// lib/fff-router/adapters/common.ts
import picomatch from "picomatch";

// lib/fff-router/tool-resolution.ts
import { spawn } from "node:child_process";
import { constants as fsConstants, accessSync, existsSync as existsSync2 } from "node:fs";
import os2 from "node:os";
import path3 from "node:path";
var TOOL_ENV_VARS = {
  "fff-mcp": "FFF_ROUTER_FFF_MCP_BIN"
};
function managedInstallPath(env) {
  const installDir = env.FFF_MCP_INSTALL_DIR || path3.join(env.HOME || os2.homedir(), ".local", "bin");
  return path3.join(installDir, process.platform === "win32" ? "fff-mcp.exe" : "fff-mcp");
}
function isExecutable(pathValue) {
  try {
    accessSync(pathValue, fsConstants.X_OK);
    return true;
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
    for (const extension2 of extensions) {
      const candidatePath = process.platform === "win32" && extension2 && !command.toUpperCase().endsWith(extension2) ? path3.join(directory, `${command}${extension2}`) : path3.join(directory, command);
      if (existsSync2(candidatePath) && isExecutable(candidatePath)) {
        return candidatePath;
      }
    }
  }
  return null;
}
function remediation(tool, envVar) {
  return `Install ${tool} or set ${envVar} to an executable path.`;
}
function resolveToolCommand(tool, deps = {}) {
  const env = deps.env ?? process.env;
  const envVar = TOOL_ENV_VARS[tool];
  const executableCheck = deps.isExecutable ?? isExecutable;
  const override = env[envVar];
  if (override) {
    const executable = executableCheck(override);
    return {
      tool,
      command: override,
      source: "env",
      envVar,
      executable,
      ...!executable ? { remediation: remediation(tool, envVar) } : {}
    };
  }
  const pathCommand = (deps.resolveExecutableOnPath ?? ((command) => resolveExecutableOnPath(command, env)))(tool);
  if (pathCommand) {
    return {
      tool,
      command: pathCommand,
      source: "path",
      envVar,
      executable: executableCheck(pathCommand),
      ...!executableCheck(pathCommand) ? { remediation: remediation(tool, envVar) } : {}
    };
  }
  const managedCommand = managedInstallPath(env);
  if (existsSync2(managedCommand)) {
    const executable = executableCheck(managedCommand);
    return {
      tool,
      command: managedCommand,
      source: "managed",
      envVar,
      executable,
      ...!executable ? { remediation: remediation(tool, envVar) } : {}
    };
  }
  return {
    tool,
    command: null,
    source: "missing",
    envVar,
    executable: false,
    remediation: remediation(tool, envVar)
  };
}
function readStream(stream) {
  if (!stream) {
    return Promise.resolve("");
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    stream.once("error", reject);
    stream.once("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}
async function runVersion(command, options) {
  try {
    const proc = spawn(command, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, options.timeoutMs);
    const [stdout, stderr] = await Promise.all([
      readStream(proc.stdout),
      readStream(proc.stderr),
      new Promise((resolve, reject) => {
        proc.once("error", reject);
        proc.once("close", resolve);
      })
    ]);
    clearTimeout(timeout);
    if (timedOut) {
      return void 0;
    }
    return (stdout || stderr).trim().split(/\r?\n/)[0] || void 0;
  } catch {
    return void 0;
  }
}
async function runVersionWithTimeout(run, command, timeoutMs) {
  let timeout;
  try {
    return await Promise.race([
      run(command, { timeoutMs }),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve(void 0), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
async function getToolDiagnostic(tool, deps = {}) {
  const resolution = resolveToolCommand(tool, deps);
  if (!resolution.command || !resolution.executable) {
    return resolution;
  }
  const version = (await runVersionWithTimeout(
    deps.runVersion ?? runVersion,
    resolution.command,
    deps.versionTimeoutMs ?? 1e3
  ))?.trim();
  return {
    ...resolution,
    ...version ? { version: version.split(/\r?\n/)[0] } : {}
  };
}

// lib/fff-router/mcp-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// lib/fff-router/mcp-tools.ts
import path5 from "node:path";
import * as z2 from "zod/v4";

// lib/fff-router/public-api.ts
import path4 from "node:path";
import * as z from "zod/v4";
var MAX_RESULTS = 50;
var MAX_CONTEXT_LINES = 5;
var MAX_PATTERNS = 20;
var MAX_FILTERS = 30;
var MAX_WITHIN_PATHS = 10;
var MAX_QUERY_LENGTH = 1024;
var extension = z.string().min(1).max(64).refine(
  (value) => /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value.trim().replace(/^\./, "")),
  "extensions must be literal suffixes without path or glob syntax"
);
var relativeFilter = z.string().min(1).max(512).refine(
  (value) => !path4.posix.isAbsolute(value.trim().replace(/\\/g, "/").replace(/^\.\//, "")),
  "path filters must be relative"
).refine(
  (value) => !value.trim().replace(/\\/g, "/").replace(/^\.\//, "").split("/").some((segment) => segment === "" || segment === "." || segment === ".."),
  "path filters must not contain empty, current-directory, or parent-directory segments"
);
var glob = relativeFilter.refine(
  (value) => !value.trim().startsWith("!"),
  "glob is an include filter; use excludePaths for exclusions"
);
var within = z.union([
  z.string().min(1).max(4096).refine((value) => value.trim().length > 0),
  z.array(
    z.string().min(1).max(4096).refine((value) => value.trim().length > 0)
  ).min(1).max(MAX_WITHIN_PATHS)
]);
var commonShape = {
  within,
  glob: glob.optional(),
  extensions: z.array(extension).max(MAX_FILTERS).optional().default([]),
  excludePaths: z.array(relativeFilter).max(MAX_FILTERS).optional().default([]),
  limit: z.number().int().min(1).max(MAX_RESULTS).optional().default(20),
  cursor: z.string().min(1).max(4096).nullable().optional().default(null)
};
var findFilesInputSchema = z.strictObject({
  query: z.string().min(1).max(MAX_QUERY_LENGTH).refine((value) => value.trim().length > 0, "query must not be blank"),
  ...commonShape
});
var grepInputSchema = z.strictObject({
  patterns: z.array(
    z.string().min(1).max(MAX_QUERY_LENGTH).refine((value) => value.trim().length > 0, "patterns must not be blank")
  ).min(1).max(MAX_PATTERNS),
  literal: z.boolean().optional().default(true),
  contextLines: z.number().int().min(0).max(MAX_CONTEXT_LINES).optional().default(0),
  ...commonShape
});
var fileHitSchema = z.object({
  path: z.string(),
  absolutePath: z.string()
});
var textHitSchema = z.object({
  ...fileHitSchema.shape,
  line: z.number().int().min(1),
  text: z.string(),
  column: z.number().int().min(0).optional(),
  contextBefore: z.array(z.string()).optional(),
  contextAfter: z.array(z.string()).optional(),
  isDefinition: z.boolean().optional(),
  definitionBody: z.array(z.string()).optional()
});
var searchResultStatsSchema = z.object({
  resultCount: z.number().int().min(0),
  upstreamShownCount: z.number().int().min(0).optional(),
  upstreamTotalCount: z.number().int().min(0).optional(),
  coldStart: z.boolean(),
  workerId: z.string().min(1),
  workerGeneration: z.number().int().min(1)
});
var readRecommendationSchema = z.object({
  path: z.string(),
  absolutePath: z.string(),
  reason: z.string().optional()
});
var searchResultBaseShape = {
  root: z.string(),
  backend: z.literal("fff-mcp"),
  nextCursor: z.string().nullable(),
  stats: searchResultStatsSchema,
  readRecommendation: readRecommendationSchema.optional(),
  displayText: z.string().optional()
};
var findFilesResultSchema = z.object({
  tool: z.literal("find_files"),
  ...searchResultBaseShape,
  items: z.array(fileHitSchema)
});
var grepResultSchema = z.object({
  tool: z.literal("grep"),
  ...searchResultBaseShape,
  items: z.array(textHitSchema)
});
var publicToolResultSchema = z.discriminatedUnion("tool", [
  findFilesResultSchema,
  grepResultSchema
]);
var workerDiagnosticSchema = z.object({
  root: z.string(),
  rootType: z.enum(["git", "non-git"]),
  state: z.enum(["starting", "ready", "draining", "dead"]),
  workerId: z.string().optional(),
  pid: z.number().int().nullable().optional(),
  generation: z.number().int().min(1),
  activeLeases: z.number().int().min(0),
  startedAt: z.number().min(0).optional(),
  lastUsedAt: z.number().min(0),
  lastCallAt: z.number().min(0).optional(),
  lastSuccessAt: z.number().min(0).optional(),
  lastError: z.string().optional(),
  lastErrorAt: z.number().min(0).optional(),
  failureCount: z.number().int().min(0),
  retryAfter: z.number().min(0).optional()
});
var routerStatusSchema = z.object({
  workers: z.array(workerDiagnosticSchema),
  limits: z.object({
    maxWorkers: z.number().int().min(1),
    maxNonGitWorkers: z.number().int().min(0)
  })
});
var warmResultSchema = z.object({ workers: z.array(workerDiagnosticSchema) });
var evictResultSchema = z.object({ evicted: z.array(z.string()) });
var PUBLIC_TOOL_DEFINITIONS = [
  {
    name: "find_files",
    description: "Fuzzy-search file names and paths using a shared warm fff-mcp index. within must be one or more absolute paths under the same repository or configured non-Git root.",
    inputSchema: findFilesInputSchema
  },
  {
    name: "grep",
    description: "Search file contents through a shared warm fff-mcp index. Multiple patterns use OR semantics; literal matching is the safe default and regex matching must be selected explicitly.",
    inputSchema: grepInputSchema
  }
];
function invalid2(message) {
  return { ok: false, error: { code: "INVALID_REQUEST", message } };
}
function formatZodError(error) {
  return error.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join(".") : "request";
    return `${field}: ${issue.message}`;
  }).join("; ");
}
function normalizeWithin(value, env) {
  const values = Array.isArray(value) ? value : [value];
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of values) {
    const expanded = expandHomePath(entry.trim(), env);
    if (!expanded.ok) {
      return invalid2(expanded.error.message);
    }
    if (!path4.isAbsolute(expanded.value)) {
      return invalid2("within paths must be absolute on the daemon wire protocol");
    }
    const clean = path4.normalize(expanded.value);
    if (seen.has(clean)) {
      return invalid2(`within contains duplicate path '${clean}'`);
    }
    seen.add(clean);
    normalized.push(clean);
  }
  return { ok: true, value: normalized };
}
function rejectWildcardOnlyRegex(patterns, literal2) {
  if (literal2) {
    return { ok: true, value: void 0 };
  }
  const wildcardOnly = /^(?:[.^$]*(?:[.][*+?]|[*+])[.^$]*|[.^$\s]*|\.\*[+?]?|\.\+[?]?|[.*?])$/;
  const rejected = patterns.find((pattern) => wildcardOnly.test(pattern.trim()));
  return rejected ? invalid2(`regex '${rejected}' matches everything; provide a concrete expression`) : { ok: true, value: void 0 };
}
function normalizePublicToolInput(tool, input, env = process.env) {
  const schema = tool === "find_files" ? findFilesInputSchema : grepInputSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return invalid2(formatZodError(parsed.error));
  }
  const resolvedWithin = normalizeWithin(parsed.data.within, env);
  if (!resolvedWithin.ok) {
    return resolvedWithin;
  }
  const common = {
    within: resolvedWithin.value,
    ...parsed.data.glob ? { glob: parsed.data.glob.trim().replace(/\\/g, "/").replace(/^\.\//, "") } : {},
    extensions: [
      ...new Set(parsed.data.extensions.map((value) => value.trim().replace(/^\./, "")))
    ],
    excludePaths: [
      ...new Set(
        parsed.data.excludePaths.map(
          (value) => value.trim().replace(/\\/g, "/").replace(/^\.\//, "")
        )
      )
    ],
    limit: parsed.data.limit,
    cursor: parsed.data.cursor
  };
  if (tool === "find_files") {
    const data2 = parsed.data;
    const request2 = {
      tool,
      query: data2.query.trim(),
      ...common
    };
    return { ok: true, value: request2 };
  }
  const data = parsed.data;
  const concreteRegex = rejectWildcardOnlyRegex(data.patterns, data.literal);
  if (!concreteRegex.ok) {
    return concreteRegex;
  }
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
var absoluteWithin = z2.string().min(1).refine((value) => path5.isAbsolute(value), "within paths must be absolute");
var adminWithinSchema = z2.strictObject({
  within: z2.union([absoluteWithin, z2.array(absoluteWithin).min(1).max(32)])
});
var MCP_TOOLS = [
  ...PUBLIC_TOOL_DEFINITIONS,
  {
    name: "router_status",
    description: "Show the shared fff-routerd worker pool and health state.",
    inputSchema: z2.strictObject({})
  },
  {
    name: "router_warm",
    description: "Start and retain warm fff-mcp workers for one or more absolute paths.",
    inputSchema: adminWithinSchema
  },
  {
    name: "router_evict",
    description: "Drain and remove fff-mcp workers for one or more absolute paths.",
    inputSchema: adminWithinSchema
  }
];
function formatResult(result) {
  if (result.displayText) {
    return result.displayText;
  }
  if (result.tool === "find_files") {
    return result.items.length > 0 ? result.items.map((item) => item.path).join("\n") : "0 results.";
  }
  return result.items.length > 0 ? result.items.map((item) => `${item.path}
  ${item.line}: ${item.text}`).join("\n--\n") : "0 matches.";
}
function errorResponse(code, message) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({ ok: false, code, message })
      }
    ]
  };
}
function successResponse(text, structuredContent) {
  return {
    isError: false,
    content: [{ type: "text", text }],
    structuredContent
  };
}
function normalizeAdminWithin(input) {
  const parsed = adminWithinSchema.parse(input);
  const values = Array.isArray(parsed.within) ? parsed.within : [parsed.within];
  return values.map((value) => path5.normalize(value));
}
function listMcpTools() {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: z2.toJSONSchema(tool.inputSchema)
  }));
}
async function executeMcpTool(args) {
  try {
    switch (args.name) {
      case "find_files":
      case "grep": {
        const normalized = normalizePublicToolInput(args.name, args.input, args.env);
        if (!normalized.ok) {
          return errorResponse(normalized.error.code, normalized.error.message);
        }
        const result = await args.service.execute(normalized.value);
        if (!result.ok) {
          return errorResponse(result.error.code, result.error.message);
        }
        return successResponse(
          formatResult(result.value),
          result.value
        );
      }
      case "router_status": {
        const status = args.service.status();
        return successResponse(
          JSON.stringify(status, null, 2),
          status
        );
      }
      case "router_warm": {
        const result = await args.service.warm(normalizeAdminWithin(args.input));
        if (!result.ok) {
          return errorResponse(result.error.code, result.error.message);
        }
        const payload = { workers: result.value };
        return successResponse(
          JSON.stringify(payload, null, 2),
          payload
        );
      }
      case "router_evict": {
        const result = await args.service.evict(normalizeAdminWithin(args.input));
        if (!result.ok) {
          return errorResponse(result.error.code, result.error.message);
        }
        return successResponse(
          JSON.stringify(result.value, null, 2),
          result.value
        );
      }
    }
  } catch (caught) {
    if (caught instanceof z2.ZodError) {
      return errorResponse(
        "INVALID_REQUEST",
        caught.issues.map((issue) => issue.message).join("; ")
      );
    }
    return errorResponse(
      "INTERNAL_ERROR",
      caught instanceof Error ? caught.message : String(caught)
    );
  }
}
var MCP_INPUT_SCHEMAS = {
  find_files: findFilesInputSchema,
  grep: grepInputSchema,
  router_status: z2.strictObject({}),
  router_warm: adminWithinSchema,
  router_evict: adminWithinSchema
};

// lib/fff-router/mcp-server.ts
function createMcpServer(args) {
  if (!args.service && !args.handler) {
    throw new Error("createMcpServer requires a RouterService or MCP tool handler");
  }
  async function callTool(name, input) {
    if (args.handler) {
      return await args.handler(name, input);
    }
    return await executeMcpTool({
      service: args.service,
      name,
      input,
      env: args.env
    });
  }
  function toSdkServer() {
    const server = new McpServer({
      name: "fff-router",
      version: PACKAGE_VERSION
    });
    for (const tool of MCP_TOOLS) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: MCP_INPUT_SCHEMAS[tool.name].shape
        },
        async (input) => await callTool(tool.name, input)
      );
    }
    return server;
  }
  return {
    listTools: async () => listMcpTools(),
    callTool,
    toSdkServer,
    async connectStdio(options = {}) {
      const transport = new StdioServerTransport();
      transport.onclose = options.onClose;
      const server = toSdkServer();
      await server.connect(transport);
      return { server, transport };
    }
  };
}

// lib/fff-router/local-auth.ts
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
function validToken(value) {
  return /^[A-Za-z0-9_-]{32,}$/.test(value);
}
async function readDaemonAuthToken(env = process.env) {
  try {
    const token = (await readFile(getDaemonPaths({ env }).authTokenPath, "utf8")).trim();
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
async function readDaemonMetadata(pathValue) {
  try {
    return JSON.parse(await readFile2(pathValue, "utf8"));
  } catch {
    return null;
  }
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
    if (existsSync3(candidatePath)) {
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
  const response = await fetch(new URL(`/health`, getDaemonOriginFromConfig(config)), {
    headers: bearerHeaders(await readDaemonAuthToken(env))
  });
  if (!response.ok) {
    throw new Error(`daemon healthcheck failed with status ${response.status}`);
  }
  const payload = await response.json();
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
  await mkdir3(paths.dir, { recursive: true, mode: 448 });
  if (process.platform !== "win32") {
    await chmod2(paths.dir, 448);
  }
  const startedAt = Date.now();
  while (true) {
    try {
      const handle = await open(paths.lockPath, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
      try {
        return await callback();
      } finally {
        await handle.close().catch(() => {
        });
        await rm2(paths.lockPath, { force: true }).catch(() => {
        });
      }
    } catch (error) {
      if (typeof error !== "object" || !error || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      const [contents, lockStat] = await Promise.all([
        readFile3(paths.lockPath, "utf8").catch(() => ""),
        stat(paths.lockPath).catch(() => null)
      ]);
      if (!lockStat || shouldReclaimStartupLock({ contents, mtimeMs: lockStat.mtimeMs, now: Date.now() })) {
        await rm2(paths.lockPath, { force: true }).catch(() => {
        });
        continue;
      }
      if (Date.now() - startedAt > STARTUP_LOCK_TIMEOUT_MS) {
        throw new Error("timed out while waiting for the daemon startup lock");
      }
      await sleep(50);
    }
  }
}
function isRecoverableHealthError(error) {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "ECONNREFUSED" || code === "ConnectionRefused" || error.message.includes("fetch") || error.message.includes("ECONNREFUSED") || error.message.includes("ConnectionRefused") || error.message.includes("Unable to connect") || error.message.includes("healthcheck failed");
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
  mkdirSync2(paths.dir, { recursive: true, mode: 448 });
  if (process.platform !== "win32") {
    chmodSync(paths.dir, 448);
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
  let handle;
  try {
    handle = await open(pathValue, "r");
    const stat2 = await handle.stat();
    const length = Math.min(stat2.size, maxBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, Math.max(0, stat2.size - length));
    return buffer.toString("utf8").trimEnd();
  } catch {
    return "";
  } finally {
    await handle?.close().catch(() => {
    });
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
async function readDaemonLogs(env) {
  const paths = getDaemonPaths({ env });
  return {
    stdoutPath: paths.stdoutLogPath,
    stderrPath: paths.stderrLogPath,
    stdout: await readLogTail(paths.stdoutLogPath),
    stderr: await readLogTail(paths.stderrLogPath)
  };
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
  await deps.withStartupLock(async () => {
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

// lib/fff-router/fff-mcp-installer.ts
function detectFffMcpTarget(platform = process.platform, arch = process.arch) {
  switch (platform) {
    case "linux":
      switch (arch) {
        case "x64":
          return "x86_64-unknown-linux-musl";
        case "arm64":
          return "aarch64-unknown-linux-musl";
        default:
          throw new Error(`Unsupported architecture: ${arch}`);
      }
    case "darwin":
      switch (arch) {
        case "x64":
          return "x86_64-apple-darwin";
        case "arm64":
          return "aarch64-apple-darwin";
        default:
          throw new Error(`Unsupported architecture: ${arch}`);
      }
    case "win32":
      switch (arch) {
        case "x64":
          return "x86_64-pc-windows-msvc";
        case "arm64":
          return "aarch64-pc-windows-msvc";
        default:
          throw new Error(`Unsupported architecture: ${arch}`);
      }
    default:
      throw new Error(`Unsupported OS: ${platform}`);
  }
}
async function getDoctorFffMcpStatus(env = process.env) {
  const diagnostic = await getToolDiagnostic("fff-mcp", { env });
  if (!diagnostic.command) {
    return {
      found: false,
      source: "missing",
      executable: false,
      envVar: diagnostic.envVar,
      ...diagnostic.remediation ? { remediation: diagnostic.remediation } : {}
    };
  }
  return {
    found: true,
    path: diagnostic.command,
    source: diagnostic.source === "env" ? "env" : diagnostic.source === "managed" ? "managed" : "path",
    executable: diagnostic.executable,
    envVar: diagnostic.envVar,
    ...diagnostic.version ? { version: diagnostic.version } : {},
    ...diagnostic.remediation ? { remediation: diagnostic.remediation } : {}
  };
}

// lib/fff-router/daemon-cli.ts
function isProcessAlive2(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function fetchHealth(env) {
  try {
    const config = getDaemonConfig({ env });
    const response = await fetch(new URL("/health", getDaemonOriginFromConfig(config)), {
      headers: bearerHeaders(await readDaemonAuthToken(env))
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    return payload.ok && payload.metadata ? { metadata: payload.metadata, workers: payload.workers ?? [] } : null;
  } catch {
    return null;
  }
}
async function getDaemonStatus(env = process.env) {
  const health = await fetchHealth(env);
  return health ? { running: true, metadata: health.metadata, workers: health.workers } : { running: false, metadata: null };
}
async function reloadDaemon(env = process.env, options = {}) {
  const status = await getDaemonStatus(env);
  if (!status.metadata) {
    return false;
  }
  try {
    process.kill(status.metadata.pid, options.clearRuntimes ? "SIGUSR2" : "SIGHUP");
    return true;
  } catch (caught) {
    if (typeof caught === "object" && caught && "code" in caught && caught.code === "ESRCH") {
      return false;
    }
    throw caught;
  }
}
function sleep2(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function stopDaemon(env = process.env) {
  const status = await getDaemonStatus(env);
  if (!status.metadata) {
    return false;
  }
  try {
    process.kill(status.metadata.pid, "SIGTERM");
  } catch (caught) {
    if (typeof caught === "object" && caught && "code" in caught && caught.code === "ESRCH") {
      return false;
    }
    throw caught;
  }
  for (const delay of [25, 50, 100, 200, 400, 800]) {
    if (!isProcessAlive2(status.metadata.pid)) {
      return true;
    }
    await sleep2(delay);
  }
  if (isProcessAlive2(status.metadata.pid)) {
    process.kill(status.metadata.pid, "SIGKILL");
  }
  return true;
}
async function getDoctorReport(env = process.env) {
  const status = await getDaemonStatus(env);
  const policyPaths = getDaemonPolicyConfigPaths({ env });
  const daemonPaths = getDaemonPaths({ env });
  return {
    ...status,
    endpoint: getDaemonEndpoint({ env }),
    configPath: policyPaths.jsonPath,
    stateDir: daemonPaths.dir,
    daemonConfig: getDaemonConfig({ env }),
    fffMcp: await getDoctorFffMcpStatus(env),
    daemon: resolveDaemonLaunchCommand(env)
  };
}

// lib/fff-router/daemon-update.ts
import { createHash as createHash2 } from "node:crypto";
import { spawn as spawn2 } from "node:child_process";
import { access, chmod as chmod3, mkdir as mkdir4, rename as rename2, rm as rm3, writeFile as writeFile3 } from "node:fs/promises";
import { constants as fsConstants2 } from "node:fs";
import os3 from "node:os";
import path7 from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
var execFileAsync = promisify(execFile);
var FFF_MCP_REPO = "dmtrKovalenko/fff";
var FFF_ROUTER_GITHUB_PACKAGE_JSON = "https://raw.githubusercontent.com/unstableneutron/fff-router/main/package.json";
var FFF_ROUTER_GITHUB_SPEC = "github:unstableneutron/fff-router";
function defaultInstallDir(env) {
  return env.FFF_MCP_INSTALL_DIR || path7.join(env.HOME || os3.homedir(), ".local", "bin");
}
function fffMcpBinaryPath(env, target) {
  return path7.join(defaultInstallDir(env), target.includes("windows") ? "fff-mcp.exe" : "fff-mcp");
}
function releaseFilename(target) {
  const extension2 = target.includes("windows") ? ".exe" : "";
  return `fff-mcp-${target}${extension2}`;
}
function stripLeadingV(version) {
  return version.replace(/^v/i, "");
}
function compareVersions(left, right) {
  const leftParts = stripLeadingV(left).split(/[.-]/).map((part) => Number(part));
  const rightParts = stripLeadingV(right).split(/[.-]/).map((part) => Number(part));
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;
    if (leftValue < rightValue) {
      return -1;
    }
    if (leftValue > rightValue) {
      return 1;
    }
  }
  return 0;
}
function parseFffMcpVersion(text) {
  const match = text.match(/fff-mcp\s+([0-9]+(?:\.[0-9]+){1,3})/i) ?? text.match(/([0-9]+(?:\.[0-9]+){1,3})/);
  return match?.[1] ?? null;
}
async function readInstalledFffMcpVersion(binaryPath) {
  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, ["--version"], { timeout: 5e3 });
    return parseFffMcpVersion(`${stdout}
${stderr}`);
  } catch {
    return null;
  }
}
async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json, application/json",
      "user-agent": "fff-routerd-update"
    }
  });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
  return await response.json();
}
async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "fff-routerd-update" }
  });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
  return await response.text();
}
function isReleaseAsset(value) {
  return typeof value === "object" && value !== null && "name" in value && typeof value.name === "string" && "browser_download_url" in value && typeof value.browser_download_url === "string";
}
function isStableReleaseTag(tag) {
  return /^v?\d+\.\d+\.\d+$/.test(tag);
}
function selectLatestFffMcpRelease(releases, target) {
  if (!Array.isArray(releases)) {
    throw new Error("GitHub releases response was not an array");
  }
  const filename = releaseFilename(target);
  for (const release of releases) {
    if (typeof release !== "object" || release === null) {
      continue;
    }
    const releaseRecord = release;
    const tag = typeof releaseRecord.tag_name === "string" ? releaseRecord.tag_name : null;
    if (!tag || releaseRecord.prerelease === true || !isStableReleaseTag(tag)) {
      continue;
    }
    const assets = Array.isArray(releaseRecord.assets) ? releaseRecord.assets : [];
    const asset = assets.find(
      (candidate) => isReleaseAsset(candidate) && candidate.name === filename
    );
    if (!isReleaseAsset(asset)) {
      continue;
    }
    const checksumAsset = assets.find(
      (candidate) => isReleaseAsset(candidate) && candidate.name === `${filename}.sha256`
    );
    return {
      tag,
      version: stripLeadingV(tag),
      assetUrl: asset.browser_download_url,
      checksumUrl: isReleaseAsset(checksumAsset) ? checksumAsset.browser_download_url : `${asset.browser_download_url}.sha256`
    };
  }
  throw new Error(`No fff-mcp release contains ${filename}`);
}
async function getLatestFffMcpRelease(target) {
  const releases = await fetchJson(`https://api.github.com/repos/${FFF_MCP_REPO}/releases`);
  if (!Array.isArray(releases)) {
    throw new Error("GitHub releases response was not an array");
  }
  return selectLatestFffMcpRelease(releases, target);
}
async function checkFffMcpUpdate(args = {}) {
  const env = args.env ?? process.env;
  let target;
  let binaryPath;
  try {
    target = args.target ?? detectFffMcpTarget();
    binaryPath = fffMcpBinaryPath(env, target);
    const [currentVersion, latest] = await Promise.all([
      (args.readInstalledVersion ?? readInstalledFffMcpVersion)(binaryPath),
      (args.getLatestRelease ?? getLatestFffMcpRelease)(target)
    ]);
    const common = {
      binaryPath,
      target,
      latestVersion: latest.version,
      latestTag: latest.tag
    };
    if (!currentVersion) {
      return {
        kind: "missing",
        ...common,
        currentVersion: null,
        assetUrl: latest.assetUrl,
        checksumUrl: latest.checksumUrl
      };
    }
    if (compareVersions(currentVersion, latest.version) >= 0) {
      return { kind: "current", ...common, currentVersion };
    }
    return {
      kind: "outdated",
      ...common,
      currentVersion,
      assetUrl: latest.assetUrl,
      checksumUrl: latest.checksumUrl
    };
  } catch (error) {
    target = args.target ?? "unknown";
    binaryPath = fffMcpBinaryPath(env, target);
    return {
      kind: "unavailable",
      binaryPath,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
async function downloadToFile(url, destinationPath) {
  const response = await fetch(url, { headers: { "user-agent": "fff-routerd-update" } });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
  await writeFile3(destinationPath, Buffer.from(await response.arrayBuffer()));
}
function extractSha256(text) {
  const match = text.match(/[a-f0-9]{64}/i);
  if (!match) {
    throw new Error("checksum response did not contain a SHA256 digest");
  }
  return match[0].toLowerCase();
}
async function sha256File(filePath) {
  const { readFile: readFile4 } = await import("node:fs/promises");
  return createHash2("sha256").update(await readFile4(filePath)).digest("hex");
}
async function installFffMcpUpdate(plan, deps = {}) {
  const directory = path7.dirname(plan.binaryPath);
  const tempPath = path7.join(directory, `.fff-mcp.${process.pid}.${Date.now()}.download`);
  await mkdir4(directory, { recursive: true });
  let installed = false;
  try {
    await (deps.downloadToFile ?? downloadToFile)(plan.assetUrl, tempPath);
    const expectedDigest = extractSha256(await (deps.fetchText ?? fetchText)(plan.checksumUrl));
    const actualDigest = await sha256File(tempPath);
    if (actualDigest !== expectedDigest) {
      throw new Error(`fff-mcp checksum mismatch: expected ${expectedDigest}, got ${actualDigest}`);
    }
    await chmod3(tempPath, 493);
    await rename2(tempPath, plan.binaryPath);
    installed = true;
    await writeFile3(
      path7.join(directory, ".fff-mcp-install.json"),
      `${JSON.stringify(
        {
          tag: plan.latestTag,
          target: plan.target,
          version: plan.latestVersion,
          installedAt: Date.now()
        },
        null,
        2
      )}
`
    );
    return plan.binaryPath;
  } finally {
    if (!installed) {
      await rm3(tempPath, { force: true }).catch(() => {
      });
    }
  }
}
function commandExtensions2(env) {
  if (process.platform !== "win32") {
    return [""];
  }
  return env.PATHEXT?.split(";").filter(Boolean) ?? [".EXE", ".CMD", ".BAT", ".COM"];
}
async function commandExists(command, env = process.env) {
  const directories = (env.PATH || process.env.PATH || "").split(path7.delimiter).filter(Boolean);
  for (const directory of directories) {
    for (const extension2 of commandExtensions2(env)) {
      const candidate = path7.join(directory, extension2 ? `${command}${extension2}` : command);
      try {
        await access(candidate, fsConstants2.X_OK);
        return true;
      } catch {
      }
    }
  }
  return false;
}
async function getLatestFffRouterdVersion() {
  const parsed = await fetchJson(FFF_ROUTER_GITHUB_PACKAGE_JSON);
  if (typeof parsed !== "object" || parsed === null || !("version" in parsed) || typeof parsed.version !== "string") {
    throw new Error("fff-router package.json did not contain a version");
  }
  return parsed.version;
}
async function checkFffRouterdUpdate(args = {}) {
  const currentVersion = args.currentVersion ?? PACKAGE_VERSION;
  try {
    const latestVersion = await (args.getLatestVersion ?? getLatestFffRouterdVersion)();
    if (compareVersions(currentVersion, latestVersion) >= 0) {
      return { kind: "current", currentVersion, latestVersion };
    }
    const hasCommand = args.commandExists ?? commandExists;
    let installer = null;
    let command = null;
    if (await hasCommand("corepack")) {
      installer = "corepack-pnpm";
      command = ["corepack", PACKAGE_MANAGER, "add", "--global", FFF_ROUTER_GITHUB_SPEC];
    } else if (await hasCommand("aube")) {
      installer = "aube";
      command = ["aube", "add", "--global", FFF_ROUTER_GITHUB_SPEC];
    } else if (await hasCommand("pnpm")) {
      installer = "pnpm";
      command = ["pnpm", "add", "--global", FFF_ROUTER_GITHUB_SPEC];
    }
    if (!installer || !command) {
      return {
        kind: "unavailable",
        currentVersion,
        message: `No supported package manager found; install Corepack, pnpm, or aube, then run: corepack ${PACKAGE_MANAGER} add --global ${FFF_ROUTER_GITHUB_SPEC}`
      };
    }
    return {
      kind: "outdated",
      currentVersion,
      latestVersion,
      installer,
      command
    };
  } catch (error) {
    return {
      kind: "unavailable",
      currentVersion,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
async function installFffRouterdUpdate(plan) {
  await new Promise((resolve, reject) => {
    const child = spawn2(plan.command[0], plan.command.slice(1), { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${plan.command.join(" ")} exited with code ${code ?? "null"}`));
    });
  });
}
async function defaultConfirm(question) {
  const rl = createInterface({ input: processStdin, output: processStdout });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
function installerDisplayName(installer) {
  return installer === "corepack-pnpm" ? "Corepack/pnpm" : installer;
}
async function runInteractiveUpdate(options = {}) {
  const env = options.env ?? process.env;
  const writeStdout = options.writeStdout ?? ((text) => process.stdout.write(text));
  const writeStderr = options.writeStderr ?? ((text) => process.stderr.write(text));
  const confirm = options.confirm ?? defaultConfirm;
  const checkMcp = options.checkFffMcpUpdate ?? (() => checkFffMcpUpdate({ env }));
  const checkRouterd = options.checkFffRouterdUpdate ?? (() => checkFffRouterdUpdate());
  const applyMcp = options.installFffMcpUpdate ?? installFffMcpUpdate;
  const applyRouterd = options.installFffRouterdUpdate ?? installFffRouterdUpdate;
  const stopDaemon2 = options.stopDaemon ?? (async () => false);
  let updatedSomething = false;
  const mcp = await checkMcp();
  switch (mcp.kind) {
    case "current":
      writeStdout(`fff-mcp is already up to date (${mcp.currentVersion}).
`);
      break;
    case "unavailable":
      writeStderr(`Could not check fff-mcp at ${mcp.binaryPath}: ${mcp.message}
`);
      break;
    case "missing":
    case "outdated": {
      const label = mcp.currentVersion ?? "not installed";
      if (await confirm(`Update fff-mcp ${label} -> ${mcp.latestVersion}?`)) {
        const installedPath = await applyMcp(mcp);
        writeStdout(`Updated fff-mcp to ${mcp.latestVersion} at ${installedPath}.
`);
        updatedSomething = true;
      } else {
        writeStdout("Skipped fff-mcp update.\n");
      }
      break;
    }
  }
  const routerd = await checkRouterd();
  switch (routerd.kind) {
    case "current":
      writeStdout(`fff-routerd is already up to date (${routerd.currentVersion}).
`);
      break;
    case "unavailable":
      writeStderr(`Could not check fff-routerd: ${routerd.message}
`);
      break;
    case "outdated":
      if (await confirm(
        `Update fff-routerd ${routerd.currentVersion} -> ${routerd.latestVersion} from GitHub with ${installerDisplayName(routerd.installer)}?`
      )) {
        await applyRouterd(routerd);
        writeStdout(`Updated fff-routerd to ${routerd.latestVersion}.
`);
        updatedSomething = true;
      } else {
        writeStdout("Skipped fff-routerd update.\n");
      }
      break;
  }
  if (updatedSomething) {
    const stopped = await stopDaemon2();
    if (stopped) {
      writeStdout("Stopped fff-routerd; it will restart on the next request.\n");
    } else {
      writeStdout("fff-routerd was not running; it will start on the next request.\n");
    }
  }
  return 0;
}

// lib/fff-router/http-client.ts
import path8 from "node:path";
import { Client as Client2 } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
function clientError(message) {
  return {
    ok: false,
    error: { code: "DAEMON_UNAVAILABLE", message, retryable: true }
  };
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
  if (response.isError) {
    return { ok: false, error: errorFromResponse(response) };
  }
  if (!response.structuredContent) {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "fff-routerd returned no structured content"
      }
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
function resolveWithin(within2, cwd, env) {
  const values = within2 === void 0 ? [cwd] : Array.isArray(within2) ? within2 : [within2];
  return values.map((value) => {
    const expanded = expandHomePath(value, env);
    if (!expanded.ok) {
      throw new Error(expanded.error.message);
    }
    return path8.isAbsolute(expanded.value) ? path8.normalize(expanded.value) : path8.resolve(cwd, expanded.value);
  });
}
var RouterClient = class {
  client = null;
  transport = null;
  connecting = null;
  closed = false;
  env;
  cwd;
  autoStart;
  get isClosed() {
    return this.closed;
  }
  constructor(options = {}) {
    this.env = options.env ?? process.env;
    this.cwd = path8.resolve(options.cwd ?? process.cwd());
    this.autoStart = options.autoStart !== false;
  }
  async connect() {
    if (this.closed) {
      throw new Error("fff-router client is closed");
    }
    if (this.client) {
      return;
    }
    if (this.connecting) {
      return await this.connecting;
    }
    this.connecting = (async () => {
      if (this.autoStart) {
        await ensureDaemonRunning(this.env);
      }
      const authToken = await readDaemonAuthToken(this.env);
      if (!authToken) {
        throw new Error("fff-routerd authentication token is missing; restart the daemon");
      }
      const transport = new StreamableHTTPClientTransport(
        new URL(getDaemonEndpoint({ env: this.env })),
        { requestInit: { headers: bearerHeaders(authToken) } }
      );
      const client = new Client2(
        { name: "fff-router-client", version: PACKAGE_VERSION },
        { capabilities: {} }
      );
      try {
        await client.connect(transport);
        this.transport = transport;
        this.client = client;
      } catch (caught) {
        await transport.close().catch(() => {
        });
        throw caught;
      }
    })();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }
  async disconnect() {
    const client = this.client;
    const transport = this.transport;
    this.client = null;
    this.transport = null;
    await client?.close().catch(() => {
    });
    await transport?.close().catch(() => {
    });
  }
  async callMcpTool(name, input, allowReconnect = true) {
    try {
      await this.connect();
      return await this.client.callTool({
        name,
        arguments: input
      });
    } catch (caught) {
      await this.disconnect();
      if (allowReconnect) {
        return await this.callMcpTool(name, input, false);
      }
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
      {
        ...input,
        within: resolveWithin(input.within, this.cwd, this.env)
      },
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
  async warm(within2) {
    return await this.callTool(
      "router_warm",
      { within: resolveWithin(within2, this.cwd, this.env) },
      warmResultSchema
    );
  }
  async evict(within2) {
    return await this.callTool(
      "router_evict",
      { within: resolveWithin(within2, this.cwd, this.env) },
      evictResultSchema
    );
  }
  async status() {
    return await this.callTool("router_status", {}, routerStatusSchema);
  }
  async close() {
    this.closed = true;
    await this.disconnect();
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

// lib/fff-router/mcp-bridge.ts
function asArguments(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input;
}
async function runMcpHttpBridge(options = {}) {
  const env = options.env ?? process.env;
  const client = await (options.connectClient?.() ?? connectRouter({ env }));
  const handler = async (name, input) => await client.callMcpTool(name, asArguments(input));
  const onClose = () => {
    void client.close();
  };
  try {
    if (options.connectStdio) {
      await options.connectStdio(handler, onClose);
      return;
    }
    await createMcpServer({ handler, env }).connectStdio({ onClose });
  } catch (caught) {
    await client.close().catch(() => {
    });
    throw caught;
  }
}

// lib/fff-router/cli.ts
var UsageError = class extends Error {
};
var HelpRequested = class extends Error {
};
var HELP = `fff ${PACKAGE_VERSION} \u2014 shared warm repository search

Usage:
  fff find <query...> [options]
  fff grep <pattern...> [options]
  fff warm <path...> [--json]
  fff evict <path...> [--json]
  fff status [--json]
  fff doctor [--json]
  fff setup
  fff update
  fff mcp
  fff daemon <start|stop|restart|reload|logs>

Search options:
  -w, --within <path>       Search scope; repeat for multiple paths
  -g, --glob <glob>         Include files matching a relative glob
  -e, --extension <ext>     Include extension; repeat or comma-separate
  -x, --exclude <path>      Exclude a relative path or glob; repeatable
  -n, --limit <count>       Return 1-50 results
      --cursor <cursor>     Continue a previous search page
      --json                Emit structured JSON

Grep options:
      --literal             Literal matching (default)
      --regex               Regular-expression matching
  -C, --context <lines>     Include 0-5 surrounding lines

Examples:
  fff find router --within .
  fff grep ActorAuth actor_auth -w . -e ts -e rs
  fff grep 'plan(Request)?' --regex -w src --json
  fff warm ~/src/project-a ~/src/project-b

Install directly from GitHub:
  corepack ${PACKAGE_MANAGER} add --global github:unstableneutron/fff-router
  fff setup
`;
function takeValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new UsageError(`${option} requires a value`);
  }
  return value;
}
function parseInteger(value, option) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new UsageError(`${option} must be an integer`);
  }
  return parsed;
}
function parseSearchArguments(argv) {
  const parsed = {
    positionals: [],
    within: [],
    extensions: [],
    excludePaths: [],
    literal: true,
    json: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      parsed.positionals.push(...argv.slice(index + 1));
      break;
    }
    switch (token) {
      case "-w":
      case "--within":
        parsed.within.push(takeValue(argv, index, token));
        index += 1;
        break;
      case "-g":
      case "--glob":
        parsed.glob = takeValue(argv, index, token);
        index += 1;
        break;
      case "-e":
      case "--extension":
        parsed.extensions.push(
          ...takeValue(argv, index, token).split(",").map((entry) => entry.trim()).filter(Boolean)
        );
        index += 1;
        break;
      case "-x":
      case "--exclude":
        parsed.excludePaths.push(takeValue(argv, index, token));
        index += 1;
        break;
      case "-n":
      case "--limit":
        parsed.limit = parseInteger(takeValue(argv, index, token), token);
        index += 1;
        break;
      case "--cursor":
        parsed.cursor = takeValue(argv, index, token);
        index += 1;
        break;
      case "-C":
      case "--context":
        parsed.contextLines = parseInteger(takeValue(argv, index, token), token);
        index += 1;
        break;
      case "--literal":
        parsed.literal = true;
        break;
      case "--regex":
        parsed.literal = false;
        break;
      case "--json":
        parsed.json = true;
        break;
      case "-h":
      case "--help":
        throw new HelpRequested(HELP);
      default:
        if (token.startsWith("-")) {
          throw new UsageError(`unknown option: ${token}`);
        }
        parsed.positionals.push(token);
    }
  }
  return parsed;
}
function commonSearchInput(parsed) {
  return {
    ...parsed.within.length > 0 ? { within: parsed.within } : {},
    ...parsed.glob ? { glob: parsed.glob } : {},
    ...parsed.extensions.length > 0 ? { extensions: parsed.extensions } : {},
    ...parsed.excludePaths.length > 0 ? { excludePaths: parsed.excludePaths } : {},
    ...parsed.limit !== void 0 ? { limit: parsed.limit } : {},
    ...parsed.cursor ? { cursor: parsed.cursor } : {}
  };
}
function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}
`);
}
function printSearchResult(result, json) {
  if (json) {
    printJson(result);
    return;
  }
  process.stdout.write(`${result.displayText ?? JSON.stringify(result.items, null, 2)}
`);
}
function throwRouterError(error) {
  throw new Error(`${error.code}: ${error.message}`);
}
async function withCliClient(env, callback) {
  const client = new RouterClient({ env });
  try {
    return await callback(client);
  } finally {
    await client.close();
  }
}
async function runFind(argv, env) {
  const parsed = parseSearchArguments(argv);
  if (parsed.positionals.length === 0) {
    throw new UsageError("find requires a query");
  }
  const result = await withCliClient(
    env,
    async (client) => await client.findFiles({
      query: parsed.positionals.join(" "),
      ...commonSearchInput(parsed)
    })
  );
  if (!result.ok) {
    throwRouterError(result.error);
  }
  printSearchResult(result.value, parsed.json);
  return 0;
}
async function runGrep(argv, env) {
  const parsed = parseSearchArguments(argv);
  if (parsed.positionals.length === 0) {
    throw new UsageError("grep requires at least one pattern");
  }
  const result = await withCliClient(
    env,
    async (client) => await client.grep({
      patterns: parsed.positionals,
      literal: parsed.literal,
      ...parsed.contextLines !== void 0 ? { contextLines: parsed.contextLines } : {},
      ...commonSearchInput(parsed)
    })
  );
  if (!result.ok) {
    throwRouterError(result.error);
  }
  printSearchResult(result.value, parsed.json);
  return 0;
}
function parsePaths(argv) {
  let json = false;
  const paths = [];
  let positionalOnly = false;
  for (const entry of argv) {
    if (!positionalOnly && entry === "--") {
      positionalOnly = true;
    } else if (!positionalOnly && (entry === "--help" || entry === "-h")) {
      throw new HelpRequested(HELP);
    } else if (!positionalOnly && entry === "--json") {
      json = true;
    } else if (!positionalOnly && entry.startsWith("-")) {
      throw new UsageError(`unknown option: ${entry}`);
    } else {
      paths.push(entry);
    }
  }
  if (paths.length === 0) {
    throw new UsageError("at least one path is required");
  }
  return { paths, json };
}
function parseJsonOnly(argv, command) {
  let json = false;
  for (const entry of argv) {
    if (entry === "--json") {
      json = true;
    } else if (entry === "--help" || entry === "-h") {
      throw new HelpRequested(HELP);
    } else {
      throw new UsageError(`${command} does not accept '${entry}'`);
    }
  }
  return json;
}
function requireNoArguments(argv, command) {
  for (const entry of argv) {
    if (entry === "--help" || entry === "-h") {
      throw new HelpRequested(HELP);
    }
    throw new UsageError(`${command} does not accept '${entry}'`);
  }
}
async function runWarm(argv, env) {
  const parsed = parsePaths(argv);
  const result = await withCliClient(env, async (client) => await client.warm(parsed.paths));
  if (!result.ok) {
    throwRouterError(result.error);
  }
  if (parsed.json) {
    printJson(result.value);
  } else {
    for (const worker of result.value.workers) {
      process.stdout.write(
        `warmed ${worker.root} (generation ${worker.generation}${worker.pid ? `, pid ${worker.pid}` : ""})
`
      );
    }
  }
  return 0;
}
async function runEvict(argv, env) {
  const parsed = parsePaths(argv);
  const result = await withCliClient(env, async (client) => await client.evict(parsed.paths));
  if (!result.ok) {
    throwRouterError(result.error);
  }
  if (parsed.json) {
    printJson(result.value);
  } else if (result.value.evicted.length === 0) {
    process.stdout.write("no matching workers\n");
  } else {
    for (const root of result.value.evicted) {
      process.stdout.write(`evicted ${root}
`);
    }
  }
  return 0;
}
async function runStatus(argv, env) {
  const json = parseJsonOnly(argv, "status");
  const status = await getDaemonStatus(env);
  if (json) {
    printJson(status);
    return status.running ? 0 : 1;
  }
  if (!status.running) {
    process.stdout.write("fff-routerd is not running\n");
    return 1;
  }
  process.stdout.write(
    `fff-routerd ${status.metadata?.packageVersion ?? "unknown"} running (pid ${status.metadata?.pid})
`
  );
  const workers = status.workers ?? [];
  process.stdout.write(`${workers.length} worker${workers.length === 1 ? "" : "s"}
`);
  for (const worker of workers) {
    process.stdout.write(
      `  ${worker.state.padEnd(8)} ${worker.root} (leases ${worker.activeLeases}, generation ${worker.generation})
`
    );
  }
  return 0;
}
async function runSetup(env) {
  const check = await checkFffMcpUpdate({ env });
  if (check.kind === "unavailable") {
    throw new Error(check.message);
  }
  if (check.kind === "missing" || check.kind === "outdated") {
    const installed = await installFffMcpUpdate(check);
    process.stdout.write(`installed fff-mcp ${check.latestVersion} at ${installed}
`);
  } else {
    process.stdout.write(`fff-mcp ${check.currentVersion} is installed
`);
  }
  await ensureDaemonRunning(env);
  process.stdout.write("fff-routerd is ready\n");
  return 0;
}
async function runDaemon(argv, env) {
  if (argv.some((entry) => entry === "--help" || entry === "-h")) {
    throw new HelpRequested(HELP);
  }
  if (argv.length !== 1) {
    throw new UsageError("daemon requires exactly one action");
  }
  const command = argv[0];
  switch (command) {
    case "start":
      await ensureDaemonRunning(env);
      process.stdout.write("fff-routerd is running\n");
      return 0;
    case "stop":
      process.stdout.write(
        await stopDaemon(env) ? "stopped fff-routerd\n" : "fff-routerd is not running\n"
      );
      return 0;
    case "restart":
      await stopDaemon(env);
      await ensureDaemonRunning(env);
      process.stdout.write("restarted fff-routerd\n");
      return 0;
    case "reload":
      if (!await reloadDaemon(env)) {
        throw new Error("fff-routerd is not running");
      }
      process.stdout.write("reloaded fff-routerd\n");
      return 0;
    case "logs": {
      const logs = await readDaemonLogs(env);
      printJson(logs);
      return 0;
    }
    default:
      throw new UsageError("daemon requires start, stop, restart, reload, or logs");
  }
}
async function main(argv, env = process.env) {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case void 0:
      case "help":
      case "--help":
      case "-h":
        process.stdout.write(HELP);
        return 0;
      case "--version":
      case "-V":
        process.stdout.write(`${PACKAGE_VERSION}
`);
        return 0;
      case "find":
        return await runFind(rest, env);
      case "grep":
        return await runGrep(rest, env);
      case "warm":
        return await runWarm(rest, env);
      case "evict":
        return await runEvict(rest, env);
      case "status":
        return await runStatus(rest, env);
      case "doctor":
        parseJsonOnly(rest, "doctor");
        printJson(await getDoctorReport(env));
        return 0;
      case "setup":
        requireNoArguments(rest, "setup");
        return await runSetup(env);
      case "update":
        requireNoArguments(rest, "update");
        return await runInteractiveUpdate({
          env,
          stopDaemon: async () => await stopDaemon(env)
        });
      case "mcp":
        requireNoArguments(rest, "mcp");
        await runMcpHttpBridge({ env });
        return 0;
      case "daemon":
        return await runDaemon(rest, env);
      default:
        throw new UsageError(`unknown command: ${command}

${HELP}`);
    }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    const stream = caught instanceof HelpRequested ? process.stdout : process.stderr;
    stream.write(`${message.endsWith("\n") ? message : `${message}
`}`);
    return caught instanceof HelpRequested ? 0 : caught instanceof UsageError ? 2 : 1;
  }
}

// bin/fff.ts
main(process.argv.slice(2), process.env).then((exitCode) => {
  process.exitCode = exitCode;
});
