import { watch, type FSWatcher } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createFffMcpStdioAdapter } from "./adapters/fff-mcp-stdio";
import { createFffNodeAdapter } from "./adapters/fff-node";
import { createRgAdapter } from "./adapters/rg";
import {
  DAEMON_PROTOCOL_VERSION,
  type DaemonConfig,
  type DaemonReloadConfig,
  getDaemonConfig,
  getDaemonOriginFromConfig,
  getDaemonPaths,
  getDaemonPolicyConfigPaths,
  getDaemonReloadFingerprintForConfig,
  getDaemonServerFingerprint,
  loadDaemonReloadConfig,
} from "./daemon-config";
import { createMcpServer } from "./mcp-server";
import { RuntimeManager } from "./runtime-manager";
import {
  createCoordinatorRuntimeConfigRef,
  createSearchCoordinator,
  type CoordinatorRuntimeConfig,
  type CoordinatorRuntimeConfigRef,
} from "./coordinator";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { SearchCoordinator } from "./types";

export type DaemonMetadata = {
  pid: number;
  host: string;
  port: number;
  mcpPath: string;
  protocolVersion: string;
  serverFingerprint: string;
  reloadFingerprint: string;
  startedAt: number;
};

export type StartHttpDaemonArgs = Partial<DaemonConfig> & {
  coordinator?: SearchCoordinator;
  createCoordinator?: (args: {
    liveConfigRef: CoordinatorRuntimeConfigRef;
    runtimeManager: RuntimeManager;
  }) => SearchCoordinator;
  liveConfigRef?: CoordinatorRuntimeConfigRef;
  loadReloadConfig?: (args?: { env?: NodeJS.ProcessEnv }) => DaemonReloadConfig;
  env?: NodeJS.ProcessEnv;
  watchConfig?: boolean;
};

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function readDaemonMetadata(path: string): Promise<DaemonMetadata | null> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as DaemonMetadata;
  } catch {
    return null;
  }
}

async function writeDaemonMetadata(path: string, metadata: DaemonMetadata): Promise<void> {
  await writeFile(path, `${JSON.stringify(metadata, null, 2)}\n`);
}

function toCoordinatorRuntimeConfig(reloadConfig: DaemonReloadConfig): CoordinatorRuntimeConfig {
  return {
    config: reloadConfig.router,
    primaryBackendId: reloadConfig.backend.primaryBackendId,
    fallbackBackendId: reloadConfig.backend.fallbackBackendId,
  };
}

function createDefaultCoordinator(args: {
  liveConfigRef: CoordinatorRuntimeConfigRef;
  runtimeManager: RuntimeManager;
}): SearchCoordinator {
  return createSearchCoordinator({
    config: args.liveConfigRef.current.config,
    adapters: {
      "fff-node": createFffNodeAdapter(),
      "fff-mcp": createFffMcpStdioAdapter(),
      rg: createRgAdapter(),
    },
    primaryBackendId: args.liveConfigRef.current.primaryBackendId,
    fallbackBackendId: args.liveConfigRef.current.fallbackBackendId,
    liveConfigRef: args.liveConfigRef,
    runtimeManager: args.runtimeManager,
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
  const loadReloadConfig = args.loadReloadConfig ?? loadDaemonReloadConfig;
  const initialReloadConfig = loadReloadConfig({ env });
  const liveConfigRef =
    args.liveConfigRef ??
    createCoordinatorRuntimeConfigRef(toCoordinatorRuntimeConfig(initialReloadConfig));
  let runtimeManager = new RuntimeManager();
  let currentCoordinator =
    args.coordinator ??
    args.createCoordinator?.({ liveConfigRef, runtimeManager }) ??
    createDefaultCoordinator({ liveConfigRef, runtimeManager });
  const paths = getDaemonPaths({ env });
  const policyConfigPaths = getDaemonPolicyConfigPaths({ env });
  const startedAt = Date.now();
  let metadata: DaemonMetadata | null = null;
  let watcher: FSWatcher | null = null;
  let watcherReloadTimer: ReturnType<typeof setTimeout> | null = null;
  let reloadChain = Promise.resolve();
  let closing = false;

  const reload = async (override?: { loadConfig?: () => DaemonReloadConfig }) => {
    const nextReload = reloadChain.then(async () => {
      if (closing) {
        throw new Error("fff-routerd is closing");
      }
      const nextConfig = override?.loadConfig ? override.loadConfig() : loadReloadConfig({ env });
      const nextRuntimeConfig = toCoordinatorRuntimeConfig(nextConfig);
      const nextMetadata = buildMetadata({
        env,
        config,
        port: metadata?.port ?? config.port,
        reloadConfig: nextConfig,
        startedAt,
      });
      const backendChanged =
        liveConfigRef.current.primaryBackendId !== nextRuntimeConfig.primaryBackendId;

      await writeDaemonMetadata(paths.metadataPath, nextMetadata);
      liveConfigRef.current = nextRuntimeConfig;

      if (backendChanged && !args.coordinator) {
        const previousRuntimeManager = runtimeManager;
        runtimeManager = new RuntimeManager();
        currentCoordinator =
          args.createCoordinator?.({ liveConfigRef, runtimeManager }) ??
          createDefaultCoordinator({ liveConfigRef, runtimeManager });
        await previousRuntimeManager.closeAll();
      }

      metadata = nextMetadata;
    });
    reloadChain = nextReload.catch(() => {});
    return await nextReload;
  };

  await mkdir(paths.dir, { recursive: true });
  await mkdir(policyConfigPaths.dir, { recursive: true });

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(
      req.url || "/",
      req.headers.host
        ? `http://${req.headers.host}`
        : getDaemonOriginFromConfig({
            host: config.host,
            port: metadata?.port ?? config.port,
            mcpPath: config.mcpPath,
          }),
    );

    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, metadata }));
      return;
    }

    if (url.pathname !== config.mcpPath) {
      res.writeHead(404).end("Not found");
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const mcpServer = createMcpServer({ coordinator: currentCoordinator }).toSdkServer();
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
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : String(error),
            },
            id: null,
          }),
        );
      }
      cleanup();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

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

  if (args.watchConfig !== false) {
    watcher = watch(policyConfigPaths.dir, (_eventType, filename) => {
      if (closing) {
        return;
      }
      if (!shouldReloadForWatchEvent(filename?.toString())) {
        return;
      }

      if (watcherReloadTimer) {
        clearTimeout(watcherReloadTimer);
      }
      watcherReloadTimer = setTimeout(() => {
        watcherReloadTimer = null;
        void reload().catch((error) => {
          console.error("fff-routerd watcher reload failed:", error);
          setTimeout(() => {
            if (closing) {
              return;
            }
            void reload().catch((retryError) => {
              console.error("fff-routerd watcher reload retry failed:", retryError);
            });
          }, 100);
        });
      }, 25);
    });
    watcher.on("error", (error) => {
      console.error("fff-routerd config watcher error:", error);
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
        watcherReloadTimer = null;
      }
      watcher?.close();
      await reloadChain.catch(() => {});
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await runtimeManager.closeAll().catch(() => {});
      await rm(paths.metadataPath, { force: true }).catch(() => {});
    },
  };
}
