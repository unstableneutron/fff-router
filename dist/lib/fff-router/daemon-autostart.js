// lib/fff-router/daemon-autostart.ts
import { spawn as spawnChildProcess } from "node:child_process";
import { appendFileSync, chmodSync, closeSync, existsSync as existsSync3, mkdirSync as mkdirSync2, openSync } from "node:fs";
import { chmod as chmod2, mkdir as mkdir3, open, readFile as readFile3, rm as rm2, stat } from "node:fs/promises";
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
import { mkdir as mkdir2, readFile as readFile2, rename, rm, writeFile as writeFile2 } from "node:fs/promises";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// lib/fff-router/adapters/fff-mcp-stdio.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// lib/fff-router/adapters/common.ts
import picomatch from "picomatch";

// lib/fff-router/tool-resolution.ts
import { constants as fsConstants, accessSync, existsSync as existsSync2 } from "node:fs";
import path3 from "node:path";
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
var MCP_INPUT_SCHEMAS = {
  find_files: findFilesInputSchema,
  grep: grepInputSchema,
  router_status: z2.strictObject({}),
  router_warm: adminWithinSchema,
  router_evict: adminWithinSchema
};

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
export {
  checkDaemonBaseHealth,
  checkDaemonHealth,
  ensureDaemonRunning,
  ensureDaemonRunningWithDeps,
  formatDaemonStartupError,
  readDaemonLogs,
  readRunningDaemonMetadata,
  resolveDaemonLaunchCommand,
  shouldReclaimStartupLock
};
