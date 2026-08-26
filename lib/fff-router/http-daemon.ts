import { watch, type FSWatcher } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isIP } from "node:net";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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
import { createMcpServer } from "./mcp-server";
import { ensureDaemonAuthToken, isAuthorized } from "./local-auth";
import { WorkerPool } from "./runtime-manager";
import type { RouterService } from "./types";

const MAX_REQUEST_BODY_BYTES = 1024 * 1024;

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

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_REQUEST_BODY_BYTES) {
      throw new Error(`request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes`);
    }
    chunks.push(buffer);
  }
  return chunks.length === 0 ? undefined : JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function readDaemonMetadata(pathValue: string): Promise<DaemonMetadata | null> {
  try {
    return JSON.parse(await readFile(pathValue, "utf8")) as DaemonMetadata;
  } catch {
    return null;
  }
}

async function writeDaemonMetadata(pathValue: string, metadata: DaemonMetadata): Promise<void> {
  const temporaryPath = `${pathValue}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(metadata, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporaryPath, pathValue);
}

function poolOptions(config: DaemonReloadConfig["router"]) {
  return {
    maxWorkers: config.limits.maxWorkers,
    maxNonGitWorkers: config.limits.maxNonGitWorkers,
    sweepIntervalMs: config.runtime.sweepIntervalMs,
    restartBackoffMs: config.runtime.restartBackoffMs,
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

function shouldReloadForWatchEvent(filename?: string | null): boolean {
  return !filename || filename === "config.json" || filename === "config.jsonc";
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
  let watcher: FSWatcher | null = null;
  let watcherReloadTimer: ReturnType<typeof setTimeout> | null = null;
  let reloadChain = Promise.resolve();
  let closing = false;

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
    });
    reloadChain = nextReload.catch(() => {});
    return await nextReload;
  };

  await mkdir(paths.dir, { recursive: true, mode: 0o700 });
  await mkdir(policyConfigPaths.dir, { recursive: true, mode: 0o700 });
  const authToken = await ensureDaemonAuthToken(env);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(
      req.url || "/",
      req.headers.host ? `http://${req.headers.host}` : getDaemonOriginFromConfig(config),
    );

    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      const authorized = isAuthorized(req.headers.authorization, authToken);
      res.end(
        JSON.stringify({
          ok: true,
          metadata,
          ...(authorized ? service.status() : {}),
        }),
      );
      return;
    }
    if (url.pathname !== config.mcpPath) {
      res.writeHead(404).end("Not found");
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

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const mcpServer = createMcpServer({ service, env }).toSdkServer();
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      void transport.close();
      void mcpServer.close();
    };
    res.once("close", cleanup);
    res.once("finish", cleanup);

    try {
      await mcpServer.connect(transport);
      const parsedBody = req.method === "POST" ? await readJsonBody(req) : undefined;
      await transport.handleRequest(req, res, parsedBody);
      if (res.writableEnded || res.destroyed) {
        cleanup();
      }
    } catch (caught) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: caught instanceof Error ? caught.message : String(caught),
            },
            id: null,
          }),
        );
      }
      cleanup();
    }
  });

  try {
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
    watcher = watch(policyConfigPaths.dir, (_eventType, filename) => {
      if (closing || !shouldReloadForWatchEvent(filename?.toString())) {
        return;
      }
      if (watcherReloadTimer) {
        clearTimeout(watcherReloadTimer);
      }
      watcherReloadTimer = setTimeout(() => {
        watcherReloadTimer = null;
        void reload().catch((caught) => {
          console.error("fff-routerd config reload failed:", caught);
        });
      }, 50);
    });
    watcher.on("error", (caught) => {
      console.error("fff-routerd config watcher error:", caught);
    });
  }

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
    async close() {
      closing = true;
      if (watcherReloadTimer) {
        clearTimeout(watcherReloadTimer);
      }
      watcher?.close();
      await reloadChain.catch(() => {});
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await service.close().catch(() => {});
      await workerPool.closeAll().catch(() => {});
      await rm(paths.metadataPath, { force: true }).catch(() => {});
    },
  };
}
