// lib/fff-router/daemon-autostart.ts
import { spawn as spawnChildProcess } from "node:child_process";
import { createWriteStream, existsSync as existsSync3, mkdirSync as mkdirSync2 } from "node:fs";
import { mkdir as mkdir2, open, readFile as readFile2, rm as rm2 } from "node:fs/promises";
import path4 from "node:path";

// lib/fff-router/daemon-config.ts
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path2 from "node:path";

// lib/fff-router/backend-config.ts
function parseBackend(raw) {
  const value = raw?.trim() || "fff-node";
  switch (value) {
    case "fff-node":
    case "fff-mcp":
    case "rg":
      return value;
    default:
      throw new Error(`Invalid backend '${value}'. Expected one of: fff-node, fff-mcp, rg`);
  }
}
function getDefaultFallbackBackend(primaryBackendId) {
  switch (primaryBackendId) {
    case "fff-node":
    case "fff-mcp":
      return "rg";
    case "rg":
      return null;
  }
}

// lib/fff-router/home-path.ts
import path from "node:path";
function invalid(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message,
    },
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
var DAEMON_PROTOCOL_VERSION = "fff-router-http-daemon-v1";
var DEFAULT_DAEMON_PORT = 4319;
var DEFAULT_DAEMON_MCP_PATH = "/mcp";
var DEFAULT_BACKEND = "fff-node";
var DEFAULT_BACKEND_TOOL_TIMEOUT_MS = 3e4;
function packageVersion() {
  const candidatePaths = [
    path2.resolve(import.meta.dirname, "../../package.json"),
    path2.resolve(import.meta.dirname, "../../../package.json"),
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
  const primaryCandidatePath = path2.resolve(import.meta.dirname, "../../dist/bin/fff-routerd.js");
  const candidatePaths = [
    primaryCandidatePath,
    path2.resolve(import.meta.dirname, "../../bin/fff-routerd.js"),
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
  const daemonEntrypointPath =
    args.daemonEntrypointPath ??
    env.FFF_ROUTER_DAEMON_BIN ??
    env.FFF_ROUTER_DAEMON_ENTRYPOINT ??
    packagedDaemonEntrypointPath();
  return hashFingerprint({
    packageVersion: PACKAGE_VERSION,
    daemonEntrypointPath,
    content: contentFingerprint(daemonEntrypointPath),
  });
}
function configHome(env) {
  return env.HOME || os.homedir();
}
function stateHome(env) {
  return env.XDG_STATE_HOME || path2.join(configHome(env), ".local", "state");
}
function mcpSocketPathForStateDir(dir) {
  const id = hashFingerprint({ dir });
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\fff-routerd-${id}`;
  }
  return path2.join("/tmp", `fff-routerd-${id}.sock`);
}
function getDefaultDaemonConfig() {
  return {
    host: DEFAULT_DAEMON_HOST,
    port: DEFAULT_DAEMON_PORT,
    mcpPath: DEFAULT_DAEMON_MCP_PATH,
  };
}
function getDefaultRouterConfig() {
  return {
    allowlistedNonGitPrefixes: [],
    promotion: {
      windowMs: 10 * 60 * 1e3,
      requiredHits: 2,
    },
    ttl: {
      gitMs: 60 * 60 * 1e3,
      nonGitMs: 15 * 60 * 1e3,
    },
    limits: {
      maxPersistentDaemons: 12,
      maxPersistentNonGitDaemons: 4,
    },
    runtime: {
      toolTimeoutMs: DEFAULT_BACKEND_TOOL_TIMEOUT_MS,
    },
  };
}
function getDefaultDaemonReloadConfig() {
  return {
    backend: {
      primaryBackendId: DEFAULT_BACKEND,
      fallbackBackendId: getDefaultFallbackBackend(DEFAULT_BACKEND),
    },
    router: getDefaultRouterConfig(),
  };
}
function getDefaultDaemonFileConfig() {
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
    runtime: {
      toolTimeoutMs: reload.router.runtime?.toolTimeoutMs ?? DEFAULT_BACKEND_TOOL_TIMEOUT_MS,
    },
  };
}
function serializeDefaultDaemonFileConfig() {
  return `${JSON.stringify(getDefaultDaemonFileConfig(), null, 2)}
`;
}
function getDaemonPolicyConfigPaths(args = {}) {
  const env = args.env ?? process.env;
  const dir = path2.join(configHome(env), ".config", "fff-routerd");
  return {
    dir,
    jsonPath: path2.join(dir, "config.json"),
    jsoncPath: path2.join(dir, "config.jsonc"),
  };
}
function ensureDefaultConfigFile(paths) {
  mkdirSync(paths.dir, { recursive: true });
  const text = serializeDefaultDaemonFileConfig();
  writeFileSync(paths.jsonPath, text);
  return {
    path: paths.jsonPath,
    text,
  };
}
function readPreferredDaemonPolicyFile(args = {}) {
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
function expectObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value;
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
function readOptionalBackend(value) {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "string") {
    throw new Error("backend must be a string");
  }
  return parseBackend(value);
}
function expandAllowlistEntries(entries, env) {
  return entries
    .map((prefix) => expandHomePath(prefix, env))
    .map((result) => {
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.value;
    })
    .filter(Boolean)
    .map((prefix) => ({ prefix, mode: "first-child-root" }));
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
  const promotion =
    fileConfig.promotion == null ? null : expectObject(fileConfig.promotion, "promotion");
  const ttl = fileConfig.ttl == null ? null : expectObject(fileConfig.ttl, "ttl");
  const limits = fileConfig.limits == null ? null : expectObject(fileConfig.limits, "limits");
  const runtime = fileConfig.runtime == null ? null : expectObject(fileConfig.runtime, "runtime");
  const normalizedEnv = { ...env, HOME: configHome(env) };
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
  const toolTimeoutMs =
    readOptionalNonNegativeInteger(runtime?.toolTimeoutMs, "runtime.toolTimeoutMs") ??
    defaults.runtime.toolTimeoutMs;
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
        runtime: {
          toolTimeoutMs,
        },
      },
    },
  };
}
function readDaemonConfigFromMetadata(args = {}) {
  const paths = getDaemonPaths(args);
  if (!existsSync(paths.metadataPath)) {
    return null;
  }
  try {
    const metadata = JSON.parse(readFileSync(paths.metadataPath, "utf8"));
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
  const paths = getDaemonPaths({ env: args.env });
  return hashFingerprint({
    daemon: {
      ...daemon,
      ...args.daemonConfig,
    },
    mcpSocketPath: paths.mcpSocketPath,
    protocolVersion: DAEMON_PROTOCOL_VERSION,
    daemonSourceFingerprint: getDaemonSourceFingerprint({ env: args.env }),
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
    metadataPath: path2.join(dir, "daemon.json"),
    lockPath: path2.join(dir, "startup.lock"),
    stdoutLogPath: path2.join(dir, "daemon.stdout.log"),
    stderrLogPath: path2.join(dir, "daemon.stderr.log"),
    mcpSocketPath: mcpSocketPathForStateDir(dir),
  };
}

// lib/fff-router/http-daemon.ts
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

// lib/fff-router/adapters/fff-mcp-stdio.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

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
    for (const extension of extensions) {
      const candidatePath =
        process.platform === "win32" && extension && !command.toUpperCase().endsWith(extension)
          ? path3.join(directory, `${command}${extension}`)
          : path3.join(directory, command);
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
import * as z from "zod/v4";

// lib/fff-router/public-api.ts
import { Type } from "@sinclair/typebox";
var outputModeSchema = Type.Union([Type.Literal("compact"), Type.Literal("json")]);
var cursorSchema = Type.Union([Type.String({ minLength: 1 }), Type.Null()]);
var ENABLE_SEARCH_TERMS = false;
function defineTool(name, description, snippet, inputSchema) {
  return { name, description, snippet, inputSchema };
}
var withinSchema = Type.Union([
  Type.String({ minLength: 1 }),
  Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
]);
var findFilesInputSchema = Type.Object(
  {
    query: Type.String({ minLength: 1 }),
    within: Type.Optional(withinSchema),
    glob: Type.Optional(Type.String({ minLength: 1 })),
    extensions: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    exclude_paths: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    limit: Type.Optional(Type.Integer({ minimum: 0 })),
    cursor: Type.Optional(cursorSchema),
    output_mode: Type.Optional(outputModeSchema),
  },
  { additionalProperties: false },
);
var searchTermsInputSchema = Type.Object(
  {
    terms: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    within: Type.Optional(withinSchema),
    glob: Type.Optional(Type.String({ minLength: 1 })),
    extensions: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    exclude_paths: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    context_lines: Type.Optional(Type.Integer({ minimum: 0 })),
    limit: Type.Optional(Type.Integer({ minimum: 0 })),
    cursor: Type.Optional(cursorSchema),
    output_mode: Type.Optional(outputModeSchema),
  },
  { additionalProperties: false },
);
var grepInputSchema = Type.Object(
  {
    patterns: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    literal: Type.Boolean({
      description:
        "Required. If true, patterns are matched as literal text (safe for code, quotes, whitespace, and regex metacharacters). If false, patterns are regex. This tool does not guess; set it explicitly.",
    }),
    within: Type.Optional(withinSchema),
    glob: Type.Optional(Type.String({ minLength: 1 })),
    case_sensitive: Type.Optional(Type.Boolean()),
    extensions: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    exclude_paths: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    context_lines: Type.Optional(Type.Integer({ minimum: 0 })),
    limit: Type.Optional(Type.Integer({ minimum: 0 })),
    cursor: Type.Optional(cursorSchema),
    output_mode: Type.Optional(outputModeSchema),
  },
  { additionalProperties: false },
);
var PUBLIC_TOOL_DEFINITIONS = [
  defineTool(
    "fff_find_files",
    "Fuzzy file search by name/path under an already-resolved within scope. Use it when you are exploring a topic or looking for files, not when you already have a specific code identifier. `within` accepts a single absolute path or an array of absolute paths (multi-path unions the results \u2014 same semantics as passing multiple roots to `fd`). Keep queries short and let glob, extensions, and exclude_paths do the path narrowing.",
    '{"query":"openssl header","within":"/opt/homebrew/lib","glob":"**/*.h","exclude_paths":["pkgconfig"]}',
    findFilesInputSchema,
  ),
  ...(ENABLE_SEARCH_TERMS
    ? [
        defineTool(
          "fff_search_terms",
          "Search for one or more literal terms under an already-resolved within scope (absolute or HOME-based).",
          '{"terms":["router","coordinator"],"within":"$HOME/.config"}',
          searchTermsInputSchema,
        ),
      ]
    : []),
  defineTool(
    "fff_grep",
    "Search file contents under an already-resolved within scope. `literal` is REQUIRED: set literal=true for identifier searches, code fragments, or any string containing whitespace, quotes, or punctuation where regex interpretation is unwanted; set literal=false only when you need regex features (anchors, character classes, quantifiers, alternation). This tool does not guess. Use `patterns` for one or more terms; multiple entries use OR semantics. `within` accepts a single absolute path or an array of absolute paths \u2014 use the array form to replace shell patterns like `grep PAT file1 file2 dirA dirB` in one call (all entries must share a routing target). Use `glob` / `extensions` / `exclude_paths` to prefilter files aggressively.",
    '{"patterns":["ActorAuth","actor_auth","PopulatedActorAuth"],"literal":true,"within":["crates/portl-cli/Cargo.toml","Cargo.toml"]}',
    grepInputSchema,
  ),
];

// lib/fff-router/mcp-tools.ts
var withinZod = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]);
var cursorZod = z.union([z.string().min(1), z.null()]);
var zodInputShapes = {
  fff_find_files: {
    query: z.string().min(1),
    within: withinZod.optional(),
    extensions: z.array(z.string().min(1)).optional(),
    exclude_paths: z.array(z.string().min(1)).optional(),
    limit: z.number().int().min(0).optional(),
    cursor: cursorZod.optional(),
    output_mode: z.enum(["compact", "json"]).optional(),
  },
  fff_search_terms: {
    terms: z.array(z.string().min(1)).min(1),
    within: withinZod.optional(),
    extensions: z.array(z.string().min(1)).optional(),
    exclude_paths: z.array(z.string().min(1)).optional(),
    context_lines: z.number().int().min(0).optional(),
    limit: z.number().int().min(0).optional(),
    cursor: cursorZod.optional(),
    output_mode: z.enum(["compact", "json"]).optional(),
  },
  fff_grep: {
    patterns: z.array(z.string().min(1)).min(1),
    literal: z.boolean(),
    within: withinZod.optional(),
    glob: z.string().optional(),
    case_sensitive: z.boolean().optional(),
    extensions: z.array(z.string().min(1)).optional(),
    exclude_paths: z.array(z.string().min(1)).optional(),
    context_lines: z.number().int().min(0).optional(),
    limit: z.number().int().min(0).optional(),
    cursor: cursorZod.optional(),
    output_mode: z.enum(["compact", "json"]).optional(),
  },
};
var MCP_TOOLS = PUBLIC_TOOL_DEFINITIONS.map((tool) => ({
  ...tool,
  zodInputShape: zodInputShapes[tool.name],
}));

// lib/fff-router/http-daemon.ts
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport as StdioServerTransport2 } from "@modelcontextprotocol/sdk/server/stdio.js";
async function readDaemonMetadata(path5) {
  try {
    return JSON.parse(await readFile(path5, "utf8"));
  } catch {
    return null;
  }
}

// lib/fff-router/daemon-autostart.ts
var DaemonHealthMismatchError = class extends Error {
  constructor(message, mismatchKind2, metadata) {
    super(message);
    this.mismatchKind = mismatchKind2;
    this.metadata = metadata;
  }
};
function packagedDaemonEntrypointPath2() {
  const primaryCandidatePath = path4.resolve(import.meta.dirname, "../../dist/bin/fff-routerd.js");
  const candidatePaths = [
    primaryCandidatePath,
    path4.resolve(import.meta.dirname, "../../bin/fff-routerd.js"),
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
    const resolvedCommand = (
      deps.resolveExecutableOnPath ?? ((command) => resolveExecutableOnPath(command, env))
    )("fff-routerd");
    if (resolvedCommand) {
      return { command: resolvedCommand, args: [], source: "path" };
    }
  }
  return {
    command: process.execPath,
    args: [packagedDaemonEntrypointPath2()],
    source: "packaged",
  };
}
async function fetchHealthMetadata(env) {
  const config = getDaemonConfig({ env });
  const response = await fetch(new URL(`/health`, getDaemonOriginFromConfig(config)));
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
  return (
    metadata.host === config.host &&
    metadata.port === config.port &&
    metadata.mcpPath === config.mcpPath
  );
}
function isNewerCompatibleDaemon(metadata, env) {
  if (!metadata) {
    return false;
  }
  return (
    comparePackageVersions(metadata.packageVersion, PACKAGE_VERSION) === 1 &&
    metadata.protocolVersion === DAEMON_PROTOCOL_VERSION &&
    endpointMatchesConfig(metadata, getDaemonConfig({ env }))
  );
}
function assertCompatibleProtocolAndVersion(metadata, env) {
  const versionComparison = comparePackageVersions(metadata.packageVersion, PACKAGE_VERSION);
  const runningDaemonIsNewer = versionComparison === 1;
  if (metadata.protocolVersion !== DAEMON_PROTOCOL_VERSION) {
    if (runningDaemonIsNewer) {
      throw new Error(
        `newer incompatible fff-routerd is already running: expected protocol ${DAEMON_PROTOCOL_VERSION}, got ${metadata.protocolVersion}. Update this client or stop fff-routerd manually.`,
      );
    }
    throw new DaemonHealthMismatchError(
      `daemon protocol mismatch: expected ${DAEMON_PROTOCOL_VERSION}, got ${metadata.protocolVersion}`,
      "protocol",
      metadata,
    );
  }
  if (versionComparison === 1) {
    if (!endpointMatchesConfig(metadata, getDaemonConfig({ env }))) {
      throw new Error(
        "newer fff-routerd is already running at this endpoint, but its metadata does not match the expected daemon endpoint. Stop fff-routerd manually before starting this client.",
      );
    }
    return "running-newer";
  }
  if (versionComparison !== 0 || metadata.packageVersion !== PACKAGE_VERSION) {
    throw new DaemonHealthMismatchError(
      `daemon package version mismatch: expected ${PACKAGE_VERSION}, got ${metadata.packageVersion}`,
      "version",
      metadata,
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
      metadata,
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
      metadata,
    );
  }
  const expectedReloadFingerprint = getDaemonReloadFingerprint({ env });
  if (metadata.reloadFingerprint !== expectedReloadFingerprint) {
    throw new DaemonHealthMismatchError(
      "daemon reload config mismatch; send SIGHUP to reload configuration",
      "reload",
      metadata,
    );
  }
}
async function withStartupLock(callback, env) {
  const paths = getDaemonPaths({ env });
  await mkdir2(paths.dir, { recursive: true });
  const startedAt = Date.now();
  while (true) {
    try {
      const handle = await open(paths.lockPath, "wx");
      await handle.writeFile(String(process.pid));
      try {
        return await callback();
      } finally {
        await handle.close().catch(() => {});
        await rm2(paths.lockPath, { force: true }).catch(() => {});
      }
    } catch (error) {
      if (typeof error !== "object" || !error || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      const lockOwner = Number.parseInt(
        (await readFile2(paths.lockPath, "utf8").catch(() => "0")).trim(),
        10,
      );
      if (!Number.isFinite(lockOwner) || lockOwner <= 0 || !isProcessAlive(lockOwner)) {
        await rm2(paths.lockPath, { force: true }).catch(() => {});
        continue;
      }
      if (Date.now() - startedAt > 15e3) {
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
  return (
    code === "ECONNREFUSED" ||
    code === "ConnectionRefused" ||
    error.message.includes("fetch") ||
    error.message.includes("ECONNREFUSED") ||
    error.message.includes("ConnectionRefused") ||
    error.message.includes("Unable to connect") ||
    error.message.includes("healthcheck failed")
  );
}
function mismatchKind(error) {
  if (error instanceof DaemonHealthMismatchError) {
    return error.mismatchKind;
  }
  if (
    typeof error === "object" &&
    error &&
    "mismatchKind" in error &&
    (error.mismatchKind === "protocol" ||
      error.mismatchKind === "version" ||
      error.mismatchKind === "server" ||
      error.mismatchKind === "reload")
  ) {
    return error.mismatchKind;
  }
  return null;
}
function mismatchPid(error) {
  if (error instanceof DaemonHealthMismatchError && typeof error.metadata?.pid === "number") {
    return error.metadata.pid;
  }
  if (
    typeof error === "object" &&
    error &&
    "metadata" in error &&
    typeof error.metadata === "object" &&
    error.metadata &&
    "pid" in error.metadata &&
    typeof error.metadata.pid === "number"
  ) {
    return error.metadata.pid;
  }
  return null;
}
function mismatchMetadata(error) {
  if (error instanceof DaemonHealthMismatchError) {
    return error.metadata;
  }
  if (
    typeof error === "object" &&
    error &&
    "metadata" in error &&
    typeof error.metadata === "object" &&
    error.metadata
  ) {
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
  mkdirSync2(paths.dir, { recursive: true });
  const child = spawnChildProcess(launchCommand.command, launchCommand.args, {
    env: env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdoutLog = createWriteStream(paths.stdoutLogPath, { flags: "a" });
  const stderrLog = createWriteStream(paths.stderrLogPath, { flags: "a" });
  child.stdout?.pipe(stdoutLog);
  child.stderr?.pipe(stderrLog);
  child.once("error", (error) => {
    stderrLog.write(`fff-routerd spawn failed: ${error.message}
`);
    stdoutLog.end();
    stderrLog.end();
  });
  child.once("close", () => {
    stdoutLog.end();
    stderrLog.end();
  });
  return {
    unref: () => child.unref(),
    source: launchCommand.source,
  };
}
async function readLogTail(pathValue, maxBytes = 4096) {
  let handle;
  try {
    handle = await open(pathValue, "r");
    const stat = await handle.stat();
    const length = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, Math.max(0, stat.size - length));
    return buffer.toString("utf8").trimEnd();
  } catch {
    return "";
  } finally {
    await handle?.close().catch(() => {});
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
    ...(stderrTail
      ? [
          `recent daemon stderr:
${stderrTail}`,
        ]
      : []),
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
    stderr: await readLogTail(paths.stderrLogPath),
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
          } catch {}
        }
      }
      if (
        mismatchKind(error) === "protocol" ||
        mismatchKind(error) === "version" ||
        mismatchKind(error) === "server" ||
        mismatchKind(error) === "reload"
      ) {
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
        if (
          child.source === "path" &&
          (mismatchKind(error) === "protocol" || mismatchKind(error) === "version")
        ) {
          const spawnedPid =
            mismatchPid(error) ?? (await deps.readRunningDaemonMetadata(env))?.pid ?? null;
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
    withStartupLock,
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
};
