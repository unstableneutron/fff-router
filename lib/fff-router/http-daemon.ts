import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isIP } from "node:net";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createFffMcpStdioAdapter, type FffMcpRuntime } from "./adapters/fff-mcp-stdio";
import {
  DAEMON_PROTOCOL_VERSION,
  PACKAGE_VERSION,
  type DaemonConfig,
  type DaemonReloadConfig,
  getDaemonConfig,
  getDaemonOriginFromConfig,
  getDaemonPaths,
  getDaemonPolicyConfigPaths,
  getDaemonReloadFingerprintForConfig,
  getDaemonServerFingerprint,
  getDaemonSourceFingerprint,
  loadDaemonReloadConfig,
} from "./daemon-config";
import { createRouterService, type RouterConfigRef } from "./coordinator";
import {
  createMcpServer,
  jsonRpcError,
  MCP_PROTOCOL_VERSION,
  type JsonRpcId,
  type JsonRpcResponse,
} from "./mcp-server";
import { ensureDaemonAuthToken, isAuthorized } from "./local-auth";
import { WorkerPool } from "./runtime-manager";
import type { RouterService } from "./types";

const MAX_REQUEST_BODY_BYTES = 1024 * 1024;
const IS_PERRY = typeof (process.versions as Record<string, string | undefined>).perry === "string";
export const DAEMON_CONTROL_PATH = "/control";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requestId(value: unknown): JsonRpcId {
  if (!isRecord(value)) return null;
  return typeof value.id === "string" || typeof value.id === "number" ? value.id : null;
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

function sendMcpError(
  res: ServerResponse,
  status: number,
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): void {
  sendJson(res, status, jsonRpcError(id, code, message, data));
}

function headerValue(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? null) : null;
}

function decodeMcpHeader(value: string): string | null {
  if (!value.startsWith("=?base64?")) return /^[\x20-\x7e]+$/.test(value) ? value : null;
  if (!value.endsWith("?=")) return null;
  try {
    const encoded = value.slice("=?base64?".length, -2);
    if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return null;
    return Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function isAllowedOrigin(origin: string, config: DaemonConfig): boolean {
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const configured = config.host.toLowerCase().replace(/^\[|\]$/g, "");
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (host === "localhost" ||
        host === "::1" ||
        host === configured ||
        (isIP(host) === 4 && host.startsWith("127.")))
    );
  } catch {
    return false;
  }
}

function validateMcpHttpHeaders(
  req: IncomingMessage,
  body: unknown,
): { ok: true } | { ok: false; status: number; response: JsonRpcResponse } {
  const id = requestId(body);
  if (!isRecord(body)) {
    return { ok: false, status: 400, response: jsonRpcError(id, -32600, "Invalid Request") };
  }
  const protocolHeader = headerValue(req, "mcp-protocol-version");
  const methodHeader = headerValue(req, "mcp-method");
  const bodyMethod = body.method;
  const params = isRecord(body.params) ? body.params : null;
  const meta = params && isRecord(params._meta) ? params._meta : null;
  const bodyVersion = meta?.["io.modelcontextprotocol/protocolVersion"];
  if (!protocolHeader || !methodHeader) {
    return {
      ok: false,
      status: 400,
      response: jsonRpcError(
        id,
        -32020,
        "Header mismatch: MCP-Protocol-Version and Mcp-Method are required",
      ),
    };
  }
  if (protocolHeader !== bodyVersion || methodHeader !== bodyMethod) {
    return {
      ok: false,
      status: 400,
      response: jsonRpcError(
        id,
        -32020,
        "Header mismatch: request metadata does not match the JSON-RPC body",
      ),
    };
  }
  if (protocolHeader !== MCP_PROTOCOL_VERSION) {
    return {
      ok: false,
      status: 400,
      response: jsonRpcError(id, -32022, "Unsupported protocol version", {
        supported: [MCP_PROTOCOL_VERSION],
        requested: protocolHeader,
      }),
    };
  }
  if (bodyMethod === "tools/call") {
    const nameHeader = headerValue(req, "mcp-name");
    const decodedName = nameHeader ? decodeMcpHeader(nameHeader) : null;
    if (!nameHeader || decodedName === null || decodedName !== params?.name) {
      return {
        ok: false,
        status: 400,
        response: jsonRpcError(id, -32020, "Header mismatch: Mcp-Name does not match params.name"),
      };
    }
  }
  return { ok: true };
}

function assertLocalHost(host: string): void {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalized !== "localhost" &&
    normalized !== "::1" &&
    !(isIP(normalized) === 4 && normalized.startsWith("127."))
  ) {
    throw new Error("fff-routerd only binds to a local loopback address");
  }
}

export type DaemonMetadata = {
  pid: number;
  host: string;
  port: number;
  mcpPath: string;
  controlPath?: string;
  protocolVersion: string;
  packageVersion: string;
  daemonSourceFingerprint?: string;
  serverFingerprint: string;
  reloadFingerprint: string;
  startedAt: number;
};

export type StartHttpDaemonArgs = Partial<DaemonConfig> & {
  service?: RouterService;
  createService?: (args: {
    configRef: RouterConfigRef;
    workerPool: WorkerPool<FffMcpRuntime>;
  }) => RouterService;
  configRef?: RouterConfigRef;
  loadReloadConfig?: (args?: { env?: NodeJS.ProcessEnv }) => DaemonReloadConfig;
  env?: NodeJS.ProcessEnv;
  watchConfig?: boolean;
};

type DaemonReloadOptions = {
  loadConfig?: () => DaemonReloadConfig;
  clearRuntimes?: boolean;
};

export async function readDaemonMetadata(pathValue: string): Promise<DaemonMetadata | null> {
  if (!existsSync(pathValue)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(pathValue, "utf8")) as DaemonMetadata;
  } catch {
    return null;
  }
}

async function writeDaemonMetadata(pathValue: string, metadata: DaemonMetadata): Promise<void> {
  const temporaryPath = `${pathValue}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(metadata, null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(temporaryPath, pathValue);
}

function poolOptions(config: DaemonReloadConfig["router"]) {
  return {
    maxWorkers: config.limits.maxWorkers,
    maxNonGitWorkers: config.limits.maxNonGitWorkers,
    sweepIntervalMs: config.runtime.sweepIntervalMs,
    restartBackoffMs: config.runtime.restartBackoffMs,
    restartBackoffMaxMs: config.runtime.restartBackoffMaxMs,
    maxTotalWorkerRssBytes: config.limits.maxTotalWorkerRssBytes,
  };
}

function createDefaultService(args: {
  configRef: RouterConfigRef;
  workerPool: WorkerPool<FffMcpRuntime>;
}): RouterService {
  return createRouterService({
    configRef: args.configRef,
    adapter: createFffMcpStdioAdapter(),
    workerPool: args.workerPool,
  });
}

async function policyConfigSignature(paths: {
  jsonPath: string;
  jsoncPath: string;
}): Promise<string> {
  const signatures = [paths.jsonPath, paths.jsoncPath].map((pathValue) => {
    if (!existsSync(pathValue)) {
      return `${pathValue}:missing`;
    }
    try {
      const details = statSync(pathValue);
      return `${pathValue}:${details.mtimeMs}:${details.size}`;
    } catch {
      return `${pathValue}:missing`;
    }
  });
  return signatures.join("|");
}

function buildMetadata(args: {
  env: NodeJS.ProcessEnv;
  config: DaemonConfig;
  port: number;
  reloadConfig: DaemonReloadConfig;
  startedAt: number;
}): DaemonMetadata {
  return {
    pid: process.pid,
    host: args.config.host,
    port: args.port,
    mcpPath: args.config.mcpPath,
    controlPath: DAEMON_CONTROL_PATH,
    protocolVersion: DAEMON_PROTOCOL_VERSION,
    packageVersion: PACKAGE_VERSION,
    daemonSourceFingerprint: getDaemonSourceFingerprint({ env: args.env }),
    serverFingerprint: getDaemonServerFingerprint({
      env: args.env,
      daemonConfig: {
        host: args.config.host,
        port: args.port,
        mcpPath: args.config.mcpPath,
      },
    }),
    reloadFingerprint: getDaemonReloadFingerprintForConfig(args.reloadConfig),
    startedAt: args.startedAt,
  };
}

export async function startHttpDaemon(args: StartHttpDaemonArgs = {}) {
  const env = args.env ?? process.env;
  const baseConfig = getDaemonConfig({ env });
  const config: DaemonConfig = {
    host: args.host ?? baseConfig.host,
    port: args.port ?? baseConfig.port,
    mcpPath: args.mcpPath ?? baseConfig.mcpPath,
  };
  assertLocalHost(config.host);
  const loadReloadConfig = args.loadReloadConfig ?? loadDaemonReloadConfig;
  const initialReloadConfig = loadReloadConfig({ env });
  const configRef = args.configRef ?? { current: initialReloadConfig.router };
  const workerPool = new WorkerPool<FffMcpRuntime>(poolOptions(initialReloadConfig.router));
  const service =
    args.service ??
    args.createService?.({ configRef, workerPool }) ??
    createDefaultService({ configRef, workerPool });
  const paths = getDaemonPaths({ env });
  const policyConfigPaths = getDaemonPolicyConfigPaths({ env });
  const startedAt = Date.now();
  let metadata: DaemonMetadata | null = null;
  let configPollTimer: ReturnType<typeof setTimeout> | null = null;
  let configPollRunning = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let rescheduleIdleCheck = () => {};
  let reloadChain = Promise.resolve();
  let closing = false;
  let lastActivityAt = startedAt;
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const warmConfiguredRoots = (roots: string[]) => {
    if (roots.length === 0) {
      return;
    }
    void service.warm(roots).then((result) => {
      if (!result.ok) {
        console.error("fff-routerd warm roots failed:", result.error.message);
      }
    });
  };

  const reload = async (override?: DaemonReloadOptions) => {
    const nextReload = reloadChain.then(async () => {
      if (closing) {
        throw new Error("fff-routerd is closing");
      }
      lastActivityAt = Date.now();
      const nextConfig = override?.loadConfig ? override.loadConfig() : loadReloadConfig({ env });
      const nextMetadata = buildMetadata({
        env,
        config,
        port: metadata?.port ?? config.port,
        reloadConfig: nextConfig,
        startedAt,
      });

      configRef.current = nextConfig.router;
      workerPool.updateOptions(poolOptions(nextConfig.router), nextConfig.router.ttl);
      if (override?.clearRuntimes) {
        await workerPool.evictAll();
      }
      await writeDaemonMetadata(paths.metadataPath, nextMetadata);
      metadata = nextMetadata;
      warmConfiguredRoots(nextConfig.router.warmRoots);
      rescheduleIdleCheck();
    });
    reloadChain = nextReload.catch(() => {});
    return await nextReload;
  };

  mkdirSync(paths.dir, { recursive: true, mode: 0o700 });
  mkdirSync(policyConfigPaths.dir, { recursive: true, mode: 0o700 });
  const authToken = await ensureDaemonAuthToken(env);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(
      req.url || "/",
      req.headers.host ? `http://${req.headers.host}` : getDaemonOriginFromConfig(config),
    );

    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      const authorized = isAuthorized(req.headers.authorization, authToken);
      if (authorized) lastActivityAt = Date.now();
      res.end(
        JSON.stringify({
          ok: true,
          metadata,
          ...(authorized ? service.status() : {}),
        }),
      );
      return;
    }
    const isMcpRequest = url.pathname === config.mcpPath;
    const isControlRequest = url.pathname === DAEMON_CONTROL_PATH;
    if (!isMcpRequest && !isControlRequest) {
      res.writeHead(404).end("Not found");
      return;
    }
    const origin = headerValue(req, "origin");
    if (origin && !isAllowedOrigin(origin, config)) {
      sendMcpError(res, 403, null, -32020, "Origin is not allowed");
      return;
    }
    if (!isAuthorized(req.headers.authorization, authToken)) {
      res.writeHead(401, {
        "content-type": "application/json",
        "www-authenticate": 'Bearer realm="fff-routerd"',
      });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    lastActivityAt = Date.now();
    if (req.method !== "POST") {
      res.writeHead(405, { allow: "POST" }).end();
      return;
    }
    const contentType = headerValue(req, "content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      sendMcpError(res, 415, null, -32600, "Content-Type must be application/json");
      return;
    }
    const accept = (headerValue(req, "accept") ?? "").toLowerCase();
    if (
      isMcpRequest &&
      (!accept.includes("application/json") || !accept.includes("text/event-stream"))
    ) {
      sendMcpError(
        res,
        406,
        null,
        -32600,
        "Accept must include application/json and text/event-stream",
      );
      return;
    }
    try {
      // Keep the IncomingMessage operations lexically inside createServer's
      // request handler. Perry assigns its native HTTP handle tag to these
      // callback parameters during lowering; passing the request through a
      // helper erases that tag and leaves body events undispatched in an AOT
      // executable. `on` is supported by both Node and Perry, and the settled
      // guard makes terminal events harmless if more than one is observed.
      const parsedBody = await new Promise<unknown>((resolve, reject) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let tooLarge = false;
        let settled = false;
        req.on("data", (chunk: Buffer | string) => {
          if (settled) return;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += buffer.byteLength;
          if (size > MAX_REQUEST_BODY_BYTES) {
            tooLarge = true;
            return;
          }
          chunks.push(buffer);
        });
        req.on("end", () => {
          if (settled) return;
          settled = true;
          if (tooLarge) {
            reject(new Error(`request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes`));
            return;
          }
          try {
            resolve(
              chunks.length === 0 ? undefined : JSON.parse(Buffer.concat(chunks).toString("utf8")),
            );
          } catch (caught) {
            reject(caught);
          }
        });
        req.on("error", (caught: Error) => {
          if (settled) return;
          settled = true;
          reject(caught);
        });
        req.on("aborted", () => {
          if (settled) return;
          settled = true;
          reject(new Error("request body was aborted"));
        });
      });
      if (isControlRequest) {
        if (!isRecord(parsedBody) || typeof parsedBody.action !== "string") {
          sendJson(res, 400, { ok: false, error: "control action is required" });
          return;
        }
        switch (parsedBody.action) {
          case "reload":
            await reload({ clearRuntimes: parsedBody.clearRuntimes === true });
            sendJson(res, 200, { ok: true, action: "reload" });
            return;
          case "shutdown":
            res.setHeader("connection", "close");
            sendJson(res, 202, { ok: true, action: "shutdown" });
            setTimeout(() => void closeDaemon(), 0);
            return;
          default:
            sendJson(res, 400, { ok: false, error: "unsupported control action" });
            return;
        }
      }
      const headers = validateMcpHttpHeaders(req, parsedBody);
      if (!headers.ok) {
        sendJson(res, headers.status, headers.response);
        return;
      }
      const response = await createMcpServer({ service, env }).handleRequest(parsedBody);
      if (!response) {
        res.writeHead(202).end();
        return;
      }
      const status = "error" in response && response.error.code === -32601 ? 404 : 200;
      if (closing) res.setHeader("connection", "close");
      sendJson(res, status, response);
    } catch (caught) {
      if (!res.headersSent) {
        const parseError = caught instanceof SyntaxError;
        sendMcpError(
          res,
          parseError ? 400 : 500,
          null,
          parseError ? -32700 : -32603,
          parseError ? "Parse error" : caught instanceof Error ? caught.message : String(caught),
        );
      }
    }
  });

  try {
    if (IS_PERRY) {
      let listenError: Error | null = null;
      const onError = (caught: Error) => {
        listenError = caught;
      };
      server.once("error", onError);
      server.listen(config.port, config.host);
      const deadline = Date.now() + 5_000;
      while (!server.listening && !listenError && Date.now() < deadline) {
        await sleep(10);
      }
      server.off("error", onError);
      if (listenError) throw listenError;
      if (!server.listening) throw new Error("daemon HTTP listener did not become ready");
    } else {
      await new Promise<void>((resolve, reject) => {
        const onError = (caught: Error) => {
          server.off("listening", onListening);
          reject(caught);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.listen(config.port, config.host, onListening);
      });
    }
  } catch (caught) {
    await service.close();
    await workerPool.closeAll();
    throw caught;
  }

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : config.port;
  metadata = buildMetadata({
    env,
    config,
    port: actualPort,
    reloadConfig: initialReloadConfig,
    startedAt,
  });
  await writeDaemonMetadata(paths.metadataPath, metadata);
  warmConfiguredRoots(initialReloadConfig.router.warmRoots);

  if (args.watchConfig !== false) {
    let signature = await policyConfigSignature(policyConfigPaths);
    const scheduleConfigPoll = () => {
      if (closing || configPollRunning || configPollTimer) return;
      configPollTimer = setTimeout(() => {
        configPollTimer = null;
        if (closing) return;
        configPollRunning = true;
        void policyConfigSignature(policyConfigPaths)
          .then(async (nextSignature) => {
            if (nextSignature === signature) return;
            signature = nextSignature;
            await reload();
          })
          .catch((caught) => {
            console.error("fff-routerd config reload failed:", caught);
          })
          .finally(() => {
            configPollRunning = false;
            scheduleConfigPoll();
          });
      }, 1_000);
    };
    scheduleConfigPoll();
  }

  let closePromise: Promise<void> | null = null;
  const closeDaemon = async () => {
    if (closePromise) return await closePromise;
    closePromise = (async () => {
      closing = true;
      if (configPollTimer) clearTimeout(configPollTimer);
      if (idleTimer) clearTimeout(idleTimer);
      await reloadChain.catch(() => {});
      // Stop accepting new connections, then tear down workers immediately.
      // Waiting for active HTTP requests before closing their workers can
      // deadlock shutdown on a wedged fff-mcp call and leave the process group
      // orphaned when the foreground daemon's hard-exit deadline fires.
      const serverClosed = IS_PERRY
        ? (async () => {
            server.close();
            const deadline = Date.now() + 5_000;
            while (server.listening && Date.now() < deadline) await sleep(10);
          })()
        : new Promise<void>((resolve) => server.close(() => resolve()));
      await Promise.all([
        serverClosed,
        service.close().catch(() => {}),
        workerPool.closeAll().catch(() => {}),
      ]);
      try {
        rmSync(paths.metadataPath, { force: true });
      } catch {
        // Metadata cleanup must not prevent process shutdown.
      }
      resolveDone();
    })();
    return await closePromise;
  };

  rescheduleIdleCheck = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    const idleTimeoutMs = configRef.current.runtime.daemonIdleTimeoutMs ?? 0;
    if (closing || idleTimeoutMs <= 0) return;

    const elapsedMs = Date.now() - lastActivityAt;
    const activeLeases = workerPool.getActiveLeaseCount();
    const delayMs = activeLeases
      ? Math.max(25, Math.min(1_000, Math.floor(idleTimeoutMs / 4)))
      : Math.max(25, Math.min(60_000, idleTimeoutMs - elapsedMs));
    idleTimer = setTimeout(() => {
      idleTimer = null;
      const currentTimeoutMs = configRef.current.runtime.daemonIdleTimeoutMs ?? 0;
      if (
        !closing &&
        currentTimeoutMs > 0 &&
        workerPool.getActiveLeaseCount() === 0 &&
        Date.now() - lastActivityAt >= currentTimeoutMs
      ) {
        void closeDaemon();
        return;
      }
      rescheduleIdleCheck();
    }, delayMs);
  };
  rescheduleIdleCheck();

  return {
    server,
    get metadata() {
      return metadata!;
    },
    paths,
    get url() {
      return `${getDaemonOriginFromConfig({
        host: metadata!.host,
        port: metadata!.port,
        mcpPath: metadata!.mcpPath,
      })}${metadata!.mcpPath}`;
    },
    reload,
    done,
    close: closeDaemon,
  };
}
