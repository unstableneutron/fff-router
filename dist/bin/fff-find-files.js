#!/usr/bin/env node

// lib/fff-router/daemon-autostart.ts
import { spawn as spawnChildProcess } from "node:child_process";
import { constants as fsConstants, accessSync, existsSync as existsSync2 } from "node:fs";
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
var DAEMON_PROTOCOL_VERSION = "fff-router-http-daemon-v1";
var DEFAULT_DAEMON_PORT = 4319;
var DEFAULT_DAEMON_MCP_PATH = "/mcp";
var DEFAULT_BACKEND = "fff-node";
function packageVersion() {
  const candidatePaths = [
    path2.resolve(import.meta.dirname, "../../package.json"),
    path2.resolve(import.meta.dirname, "../../../package.json")
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
    mcpPath: DEFAULT_DAEMON_MCP_PATH
  };
}
function getDefaultRouterConfig() {
  return {
    allowlistedNonGitPrefixes: [],
    promotion: {
      windowMs: 10 * 60 * 1e3,
      requiredHits: 2
    },
    ttl: {
      gitMs: 60 * 60 * 1e3,
      nonGitMs: 15 * 60 * 1e3
    },
    limits: {
      maxPersistentDaemons: 12,
      maxPersistentNonGitDaemons: 4
    }
  };
}
function getDefaultDaemonReloadConfig() {
  return {
    backend: {
      primaryBackendId: DEFAULT_BACKEND,
      fallbackBackendId: getDefaultFallbackBackend(DEFAULT_BACKEND)
    },
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
    backend: reload.backend.primaryBackendId,
    allowlist: [],
    promotion: { ...reload.router.promotion },
    ttl: { ...reload.router.ttl },
    limits: { ...reload.router.limits }
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
  return entries.map((prefix) => expandHomePath(prefix, env)).map((result) => {
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    return result.value;
  }).filter(Boolean).map((prefix) => ({ prefix, mode: "first-child-root" }));
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
  const promotion = fileConfig.promotion == null ? null : expectObject(fileConfig.promotion, "promotion");
  const ttl = fileConfig.ttl == null ? null : expectObject(fileConfig.ttl, "ttl");
  const limits = fileConfig.limits == null ? null : expectObject(fileConfig.limits, "limits");
  const normalizedEnv = { ...env, HOME: configHome(env) };
  const backendId = readOptionalBackend(fileConfig.backend) ?? defaults.backend;
  const allowlist = readOptionalStringArray(fileConfig.allowlist, "allowlist") ?? defaults.allowlist;
  const host = readOptionalString(fileConfig.host, "host") ?? defaults.host;
  const port = readOptionalPort(fileConfig.port) ?? defaults.port;
  const mcpPath = readOptionalMcpPath(fileConfig.mcpPath) ?? defaults.mcpPath;
  const promotionWindowMs = readOptionalNonNegativeInteger(promotion?.windowMs, "promotion.windowMs") ?? defaults.promotion.windowMs;
  const promotionRequiredHits = readOptionalNonNegativeInteger(promotion?.requiredHits, "promotion.requiredHits") ?? defaults.promotion.requiredHits;
  const ttlGitMs = readOptionalNonNegativeInteger(ttl?.gitMs, "ttl.gitMs") ?? defaults.ttl.gitMs;
  const ttlNonGitMs = readOptionalNonNegativeInteger(ttl?.nonGitMs, "ttl.nonGitMs") ?? defaults.ttl.nonGitMs;
  const maxPersistentDaemons = readOptionalNonNegativeInteger(limits?.maxPersistentDaemons, "limits.maxPersistentDaemons") ?? defaults.limits.maxPersistentDaemons;
  const maxPersistentNonGitDaemons = readOptionalNonNegativeInteger(
    limits?.maxPersistentNonGitDaemons,
    "limits.maxPersistentNonGitDaemons"
  ) ?? defaults.limits.maxPersistentNonGitDaemons;
  return {
    daemon: {
      host,
      port,
      mcpPath
    },
    reload: {
      backend: {
        primaryBackendId: backendId,
        fallbackBackendId: getDefaultFallbackBackend(backendId)
      },
      router: {
        allowlistedNonGitPrefixes: expandAllowlistEntries(allowlist, normalizedEnv),
        promotion: {
          windowMs: promotionWindowMs,
          requiredHits: promotionRequiredHits
        },
        ttl: {
          gitMs: ttlGitMs,
          nonGitMs: ttlNonGitMs
        },
        limits: {
          maxPersistentDaemons,
          maxPersistentNonGitDaemons
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
  const paths = getDaemonPaths({ env: args.env });
  return hashFingerprint({
    daemon: {
      ...daemon,
      ...args.daemonConfig
    },
    mcpSocketPath: paths.mcpSocketPath,
    protocolVersion: DAEMON_PROTOCOL_VERSION
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
    mcpSocketPath: mcpSocketPathForStateDir(dir)
  };
}

// lib/fff-router/http-daemon.ts
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

// lib/fff-router/adapters/fff-mcp-stdio.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// lib/fff-router/mcp-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// lib/fff-router/mcp-tools.ts
import * as z from "zod/v4";

// lib/fff-router/public-api.ts
import { Type } from "@sinclair/typebox";
var outputModeSchema = Type.Union([Type.Literal("compact"), Type.Literal("json")]);
var cursorSchema = Type.Null();
var ENABLE_SEARCH_TERMS = false;
function defineTool(name, description, snippet, inputSchema) {
  return { name, description, snippet, inputSchema };
}
var withinSchema = Type.Union([
  Type.String({ minLength: 1 }),
  Type.Array(Type.String({ minLength: 1 }), { minItems: 1 })
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
    output_mode: Type.Optional(outputModeSchema)
  },
  { additionalProperties: false }
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
    output_mode: Type.Optional(outputModeSchema)
  },
  { additionalProperties: false }
);
var grepInputSchema = Type.Object(
  {
    patterns: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    literal: Type.Boolean({
      description: "Required. If true, patterns are matched as literal text (safe for code, quotes, whitespace, and regex metacharacters). If false, patterns are regex. This tool does not guess; set it explicitly."
    }),
    within: Type.Optional(withinSchema),
    glob: Type.Optional(Type.String({ minLength: 1 })),
    case_sensitive: Type.Optional(Type.Boolean()),
    extensions: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    exclude_paths: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    context_lines: Type.Optional(Type.Integer({ minimum: 0 })),
    limit: Type.Optional(Type.Integer({ minimum: 0 })),
    cursor: Type.Optional(cursorSchema),
    output_mode: Type.Optional(outputModeSchema)
  },
  { additionalProperties: false }
);
var PUBLIC_TOOL_DEFINITIONS = [
  defineTool(
    "fff_find_files",
    "Fuzzy file search by name/path under an already-resolved within scope. Use it when you are exploring a topic or looking for files, not when you already have a specific code identifier. `within` accepts a single absolute path or an array of absolute paths (multi-path unions the results \u2014 same semantics as passing multiple roots to `fd`). Keep queries short and let glob, extensions, and exclude_paths do the path narrowing.",
    '{"query":"openssl header","within":"/opt/homebrew/lib","glob":"**/*.h","exclude_paths":["pkgconfig"]}',
    findFilesInputSchema
  ),
  ...ENABLE_SEARCH_TERMS ? [
    defineTool(
      "fff_search_terms",
      "Search for one or more literal terms under an already-resolved within scope (absolute or HOME-based).",
      '{"terms":["router","coordinator"],"within":"$HOME/.config"}',
      searchTermsInputSchema
    )
  ] : [],
  defineTool(
    "fff_grep",
    "Search file contents under an already-resolved within scope. `literal` is REQUIRED: set literal=true for identifier searches, code fragments, or any string containing whitespace, quotes, or punctuation where regex interpretation is unwanted; set literal=false only when you need regex features (anchors, character classes, quantifiers, alternation). This tool does not guess. Use `patterns` for one or more terms; multiple entries use OR semantics. `within` accepts a single absolute path or an array of absolute paths \u2014 use the array form to replace shell patterns like `grep PAT file1 file2 dirA dirB` in one call (all entries must share a routing target). Use `glob` / `extensions` / `exclude_paths` to prefilter files aggressively.",
    '{"patterns":["ActorAuth","actor_auth","PopulatedActorAuth"],"literal":true,"within":["crates/portl-cli/Cargo.toml","Cargo.toml"]}',
    grepInputSchema
  )
];

// lib/fff-router/mcp-tools.ts
var withinZod = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]);
var zodInputShapes = {
  fff_find_files: {
    query: z.string().min(1),
    within: withinZod.optional(),
    extensions: z.array(z.string().min(1)).optional(),
    exclude_paths: z.array(z.string().min(1)).optional(),
    limit: z.number().int().min(0).optional(),
    cursor: z.null().optional(),
    output_mode: z.enum(["compact", "json"]).optional()
  },
  fff_search_terms: {
    terms: z.array(z.string().min(1)).min(1),
    within: withinZod.optional(),
    extensions: z.array(z.string().min(1)).optional(),
    exclude_paths: z.array(z.string().min(1)).optional(),
    context_lines: z.number().int().min(0).optional(),
    limit: z.number().int().min(0).optional(),
    cursor: z.null().optional(),
    output_mode: z.enum(["compact", "json"]).optional()
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
    cursor: z.null().optional(),
    output_mode: z.enum(["compact", "json"]).optional()
  }
};
var MCP_TOOLS = PUBLIC_TOOL_DEFINITIONS.map((tool) => ({
  ...tool,
  zodInputShape: zodInputShapes[tool.name]
}));

// lib/fff-router/resolve-within.ts
import path3 from "node:path";
function invalid2(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function validateAbsolutePath(candidate, field) {
  const trimmed = candidate.trim();
  if (trimmed === "") {
    return invalid2(`${field} must be a non-empty path`);
  }
  if (!path3.isAbsolute(trimmed)) {
    return invalid2(`${field} must be absolute`);
  }
  return { ok: true, value: trimmed };
}
async function resolveWithinFromCaller(args) {
  const env = args.env ?? process.env;
  const callerCwd = validateAbsolutePath(args.callerCwd, "callerCwd");
  if (!callerCwd.ok) {
    return callerCwd;
  }
  if (args.within == null) {
    return { ok: true, value: { resolvedWithin: callerCwd.value } };
  }
  const expandedWithin = expandHomePath(args.within, env);
  if (!expandedWithin.ok) {
    return expandedWithin;
  }
  const within = expandedWithin.value;
  if (within === "") {
    return invalid2("within must be a non-empty string when provided");
  }
  return {
    ok: true,
    value: {
      resolvedWithin: path3.isAbsolute(within) ? within : path3.resolve(callerCwd.value, within)
    }
  };
}

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
function packagedDaemonEntrypointPath() {
  const primaryCandidatePath = path4.resolve(import.meta.dirname, "../../dist/bin/fff-routerd.js");
  const candidatePaths = [
    primaryCandidatePath,
    path4.resolve(import.meta.dirname, "../../bin/fff-routerd.js")
  ];
  for (const candidatePath of candidatePaths) {
    if (existsSync2(candidatePath)) {
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
function defaultResolveExecutableOnPath(command, env) {
  const pathValue = env.PATH || process.env.PATH || "";
  const directories = pathValue.split(path4.delimiter).filter(Boolean);
  const extensions = commandExtensions(env);
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidatePath = process.platform === "win32" && extension && !command.toUpperCase().endsWith(extension) ? path4.join(directory, `${command}${extension}`) : path4.join(directory, command);
      if (existsSync2(candidatePath) && isExecutable(candidatePath)) {
        return candidatePath;
      }
    }
  }
  return null;
}
function resolveDaemonLaunchCommand(env = process.env, deps = {}) {
  if (!deps.preferPackaged) {
    const resolvedCommand = (deps.resolveExecutableOnPath ?? ((command) => defaultResolveExecutableOnPath(command, env)))("fff-routerd");
    if (resolvedCommand) {
      return { command: resolvedCommand, args: [], source: "path" };
    }
  }
  return {
    command: process.execPath,
    args: [packagedDaemonEntrypointPath()],
    source: "packaged"
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
        await handle.close().catch(() => {
        });
        await rm2(paths.lockPath, { force: true }).catch(() => {
        });
      }
    } catch (error) {
      if (typeof error !== "object" || !error || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      const lockOwner = Number.parseInt(
        (await readFile2(paths.lockPath, "utf8").catch(() => "0")).trim(),
        10
      );
      if (!Number.isFinite(lockOwner) || lockOwner <= 0 || !isProcessAlive(lockOwner)) {
        await rm2(paths.lockPath, { force: true }).catch(() => {
        });
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
  const child = spawnChildProcess(launchCommand.command, launchCommand.args, {
    env: env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout?.destroy();
  child.stderr?.destroy();
  return {
    unref: () => child.unref(),
    source: launchCommand.source
  };
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
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
      const pid = mismatchPid(error) ?? (await deps.readRunningDaemonMetadata(env))?.pid ?? null;
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
    const existingPid = (await deps.readRunningDaemonMetadata(env))?.pid ?? null;
    if (existingPid) {
      await deps.terminateProcess(existingPid);
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
import { Client as Client2 } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
function toToolCall(request) {
  const common = {
    within: request.within,
    glob: request.glob,
    extensions: request.extensions,
    exclude_paths: request.excludePaths,
    limit: request.limit,
    cursor: request.cursor,
    output_mode: request.outputMode
  };
  switch (request.tool) {
    case "fff_find_files": {
      const findRequest = request;
      return {
        name: request.tool,
        input: {
          query: findRequest.query,
          ...common
        }
      };
    }
    case "fff_search_terms": {
      const searchTermsRequest = request;
      return {
        name: request.tool,
        input: {
          terms: searchTermsRequest.terms,
          context_lines: searchTermsRequest.contextLines,
          ...common
        }
      };
    }
    case "fff_grep": {
      const grepRequest = request;
      return {
        name: request.tool,
        input: {
          patterns: grepRequest.patterns,
          literal: grepRequest.literal,
          case_sensitive: grepRequest.caseSensitive,
          context_lines: grepRequest.contextLines,
          ...common
        }
      };
    }
  }
}
function unwrapToolResponse(response) {
  const first = response.content?.[0];
  if (!first || first.type !== "text" || typeof first.text !== "string") {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "daemon returned a non-text MCP tool response"
      }
    };
  }
  const parsed = JSON.parse(first.text);
  if (response.isError) {
    return {
      ok: false,
      error: {
        code: typeof parsed === "object" && parsed && "code" in parsed && typeof parsed.code === "string" ? parsed.code : "INTERNAL_ERROR",
        message: typeof parsed === "object" && parsed && "message" in parsed && typeof parsed.message === "string" ? parsed.message : "daemon call failed"
      }
    };
  }
  return {
    ok: true,
    value: parsed
  };
}
async function createPersistentHttpToolClient(env) {
  const transport = new StreamableHTTPClientTransport(new URL(getDaemonEndpoint({ env })));
  const client = new Client2(
    { name: "fff-router-http-client", version: "1.0.0" },
    { capabilities: {} }
  );
  await client.connect(transport);
  return {
    async callPublicTool(request) {
      const toolCall = toToolCall(request);
      const response = await client.callTool({
        name: toolCall.name,
        arguments: toolCall.input
      });
      return unwrapToolResponse(response);
    },
    async close() {
      await client.close().catch(() => {
      });
      await transport.close().catch(() => {
      });
    }
  };
}
async function callPublicToolOverHttp(request, env) {
  const client = await createPersistentHttpToolClient(env);
  try {
    return await client.callPublicTool(request);
  } finally {
    await client.close();
  }
}

// lib/fff-router/wrappers.ts
function helpText(tool) {
  switch (tool) {
    case "fff_find_files":
      return "Usage: fff-find-files <query> [--within PATH] [--glob GLOB] [--extension EXT] [--exclude-path PATH] [--limit N] [--output-mode compact|json]";
    case "fff_grep":
      return "Usage: fff-grep <pattern> [pattern...] [--literal|--regex] [--within PATH] [--glob GLOB] [--case-sensitive] [--extension EXT] [--exclude-path PATH] [--context-lines N] [--limit N] [--output-mode compact|json]\n\n  --literal (default)  Patterns are matched as literal text.\n  --regex              Patterns are matched as regular expressions.";
  }
}
function parseCommonArgs(argv) {
  const positionals = [];
  const common = {
    within: null,
    extensions: [],
    excludePaths: []
  };
  const extra = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === void 0) {
      continue;
    }
    switch (token) {
      case "--help":
      case "-h":
        extra.help = true;
        break;
      case "--within":
        common.within = next ?? null;
        index += 1;
        break;
      case "--glob":
        common.glob = next;
        index += 1;
        break;
      case "--extension":
      case "--extensions":
        if (next) {
          common.extensions.push(
            ...next.split(",").map((entry) => entry.trim()).filter(Boolean)
          );
        }
        index += 1;
        break;
      case "--exclude-path":
        if (next) {
          common.excludePaths.push(next);
        }
        index += 1;
        break;
      case "--limit":
        if (next) {
          common.limit = Number(next);
        }
        index += 1;
        break;
      case "--output-mode":
        if (next === "compact" || next === "json") {
          common.outputMode = next;
        }
        index += 1;
        break;
      case "--context-lines":
        if (next) {
          extra.contextLines = Number(next);
        }
        index += 1;
        break;
      case "--case-sensitive":
        extra.caseSensitive = true;
        break;
      case "--literal":
        extra.literal = true;
        break;
      case "--regex":
        extra.literal = false;
        break;
      default:
        if (token.startsWith("-")) {
          throw new Error(`unknown option: ${token}`);
        }
        positionals.push(token);
        break;
    }
  }
  return { common, extra, positionals };
}
async function buildWrapperInvocation(args) {
  const parsed = parseCommonArgs(args.argv);
  if (parsed.extra.help) {
    return {
      kind: "help",
      text: helpText(args.tool)
    };
  }
  const resolvedWithin = await resolveWithinFromCaller({
    callerCwd: args.callerCwd,
    within: parsed.common.within
  });
  if (!resolvedWithin.ok) {
    throw new Error(resolvedWithin.error.message);
  }
  const base = {
    within: [resolvedWithin.value.resolvedWithin],
    ...parsed.common.glob ? { glob: parsed.common.glob } : {},
    extensions: parsed.common.extensions,
    excludePaths: parsed.common.excludePaths,
    limit: parsed.common.limit ?? 20,
    cursor: null,
    outputMode: parsed.common.outputMode ?? "compact"
  };
  let publicRequest;
  switch (args.tool) {
    case "fff_find_files":
      publicRequest = {
        tool: args.tool,
        query: parsed.positionals.join(" ").trim(),
        ...base
      };
      break;
    case "fff_grep":
      publicRequest = {
        tool: args.tool,
        patterns: parsed.positionals,
        // Default to literal on the CLI; `--regex` opts into regex semantics.
        literal: parsed.extra.literal !== false,
        caseSensitive: parsed.extra.caseSensitive === true,
        contextLines: typeof parsed.extra.contextLines === "number" ? parsed.extra.contextLines : 0,
        ...base
      };
      break;
  }
  return {
    kind: "call",
    toolName: args.tool,
    publicRequest
  };
}
async function runWrapper(args, deps = {}) {
  const env = deps.env ?? process.env;
  const invocation = await buildWrapperInvocation(args);
  if (invocation.kind === "help") {
    console.log(invocation.text);
    return;
  }
  await (deps.ensureDaemon ?? ensureDaemonRunning)(env);
  const result = await (deps.callTool ?? callPublicToolOverHttp)(invocation.publicRequest, env);
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  process.stdout.write(`${JSON.stringify(result.value, null, 2)}
`);
}

// bin/fff-find-files.ts
runWrapper({
  tool: "fff_find_files",
  argv: process.argv.slice(2),
  callerCwd: process.cwd()
}).catch((error) => {
  console.error("fff-find-files failed:", error);
  process.exit(1);
});
