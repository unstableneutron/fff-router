import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createFffMcpAdapter } from "./adapters/fff-mcp";
import { createRgFdAdapter } from "./adapters/rg-fd";
import {
  DAEMON_PROTOCOL_VERSION,
  type DaemonConfig,
  getDaemonConfig,
  getDaemonConfigFingerprint,
  getDaemonPaths,
  loadRouterConfig,
} from "./daemon-config";
import { createMcpServer } from "./mcp-server";
import { RuntimeManager } from "./runtime-manager";
import { createSearchCoordinator } from "./coordinator";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { SearchCoordinator } from "./types";

export type DaemonMetadata = {
  pid: number;
  host: string;
  port: number;
  mcpPath: string;
  protocolVersion: string;
  configFingerprint: string;
  startedAt: number;
};

export type StartHttpDaemonArgs = Partial<DaemonConfig> & {
  coordinator?: SearchCoordinator;
  env?: NodeJS.ProcessEnv;
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

function defaultCoordinator(env?: NodeJS.ProcessEnv): SearchCoordinator {
  return createSearchCoordinator({
    config: loadRouterConfig({ env }),
    primaryAdapter: createFffMcpAdapter(),
    fallbackAdapter: createRgFdAdapter(),
    runtimeManager: new RuntimeManager(),
  });
}

export async function startHttpDaemon(args: StartHttpDaemonArgs = {}) {
  const baseConfig = getDaemonConfig({ env: args.env });
  const config: DaemonConfig = {
    host: args.host ?? baseConfig.host,
    port: args.port ?? baseConfig.port,
    mcpPath: args.mcpPath ?? baseConfig.mcpPath,
  };
  const coordinator = args.coordinator ?? defaultCoordinator(args.env);
  const paths = getDaemonPaths({ env: args.env });
  let metadata: DaemonMetadata | null = null;

  await mkdir(paths.dir, { recursive: true });

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(
      req.url || "/",
      `http://${req.headers.host || `${config.host}:${config.port}`}`,
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
    const mcpServer = createMcpServer({ coordinator }).toSdkServer();
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
  metadata = {
    pid: process.pid,
    host: config.host,
    port: actualPort,
    mcpPath: config.mcpPath,
    protocolVersion: DAEMON_PROTOCOL_VERSION,
    configFingerprint: getDaemonConfigFingerprint({
      env: args.env,
      daemonConfig: {
        host: config.host,
        port: actualPort,
        mcpPath: config.mcpPath,
      },
    }),
    startedAt: Date.now(),
  };
  await writeDaemonMetadata(paths.metadataPath, metadata);

  return {
    server,
    metadata,
    paths,
    url: `http://${metadata.host}:${metadata.port}${metadata.mcpPath}`,
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(paths.metadataPath, { force: true }).catch(() => {});
    },
  };
}
