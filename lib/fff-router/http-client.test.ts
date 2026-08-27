import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  getDaemonPaths,
  getDaemonPolicyConfigPaths,
  getDefaultDaemonReloadConfig,
  getDefaultRouterConfig,
} from "./daemon-config";
import { getDaemonStatus, reloadDaemon } from "./daemon-cli";
import { RouterClient } from "./http-client";
import { startHttpDaemon } from "./http-daemon";
import { bearerHeaders, readDaemonAuthToken } from "./local-auth";
import { MCP_PROTOCOL_VERSION } from "./mcp-server";
import type { RouterService } from "./types";

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

describe("typed HTTP SDK", () => {
  test("resolves caller-relative paths and returns normalized structured content", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "fff-router-client-"));
    const repo = path.join(home, "repo");
    await mkdir(repo);
    const port = await unusedPort();
    const env = { HOME: home, XDG_STATE_HOME: path.join(home, "state") };
    const configPaths = getDaemonPolicyConfigPaths({ env });
    await mkdir(configPaths.dir, { recursive: true });
    await writeFile(
      configPaths.jsonPath,
      `${JSON.stringify({ host: "127.0.0.1", port, mcpPath: "/mcp" })}\n`,
    );

    const execute = vi.fn<RouterService["execute"]>(async (_request) => ({
      ok: true,
      value: {
        tool: "find_files",
        root: repo,
        backend: "fff-mcp",
        items: [{ path: "router.ts", absolutePath: path.join(repo, "router.ts") }],
        nextCursor: null,
        stats: {
          resultCount: 1,
          coldStart: false,
          workerId: "worker-1",
          workerGeneration: 1,
        },
      },
    }));
    const service: RouterService = {
      execute,
      warm: vi.fn<RouterService["warm"]>(async () => ({ ok: true, value: [] })),
      evict: vi.fn<RouterService["evict"]>(async () => ({
        ok: true,
        value: { evicted: [] },
      })),
      status: () => ({
        workers: [],
        limits: { maxWorkers: 12, maxNonGitWorkers: 4 },
        resources: {
          sampledAt: 1,
          daemonRssBytes: 2,
          workerRssBytes: 3,
          totalRssBytes: 5,
          measuredWorkers: 1,
        },
      }),
      close: vi.fn(async () => {}),
    };
    const daemon = await startHttpDaemon({
      env,
      service,
      watchConfig: false,
    });
    const client = new RouterClient({ env, cwd: repo, autoStart: false });
    try {
      const unauthorized = await fetch(daemon.url, { method: "POST", body: "{}" });
      expect(unauthorized.status).toBe(401);
      const publicHealth = (await (await fetch(new URL("/health", daemon.url))).json()) as Record<
        string,
        unknown
      >;
      expect(publicHealth).not.toHaveProperty("workers");
      await expect(getDaemonStatus(env)).resolves.toMatchObject({
        running: true,
        limits: { maxWorkers: 12, maxNonGitWorkers: 4 },
        resources: { daemonRssBytes: 2, workerRssBytes: 3, totalRssBytes: 5 },
      });

      const authToken = await readDaemonAuthToken(env);
      const metadata = {
        "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientInfo": { name: "conformance-test", version: "1" },
        "io.modelcontextprotocol/clientCapabilities": {},
      };
      const discover = await fetch(daemon.url, {
        method: "POST",
        headers: {
          ...bearerHeaders(authToken!),
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": MCP_PROTOCOL_VERSION,
          "mcp-method": "server/discover",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "server/discover",
          params: { _meta: metadata },
        }),
      });
      expect(discover.status).toBe(200);
      expect(await discover.json()).toMatchObject({
        result: {
          resultType: "complete",
          supportedVersions: [MCP_PROTOCOL_VERSION],
          capabilities: { tools: {} },
        },
      });

      const initialize = await fetch(daemon.url, {
        method: "POST",
        headers: {
          ...bearerHeaders(authToken!),
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": MCP_PROTOCOL_VERSION,
          "mcp-method": "initialize",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "initialize",
          params: { _meta: metadata },
        }),
      });
      expect(initialize.status).toBe(404);
      expect(await initialize.json()).toMatchObject({ error: { code: -32601 } });

      const mismatch = await fetch(daemon.url, {
        method: "POST",
        headers: {
          ...bearerHeaders(authToken!),
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": MCP_PROTOCOL_VERSION,
          "mcp-method": "tools/list",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "server/discover",
          params: { _meta: metadata },
        }),
      });
      expect(mismatch.status).toBe(400);
      expect(await mismatch.json()).toMatchObject({ error: { code: -32020 } });

      const badOrigin = await fetch(daemon.url, {
        method: "POST",
        headers: {
          ...bearerHeaders(authToken!),
          origin: "https://attacker.example",
        },
      });
      expect(badOrigin.status).toBe(403);

      const getMcp = await fetch(daemon.url, {
        headers: bearerHeaders(authToken!),
      });
      expect(getMcp.status).toBe(405);

      const result = await client.findFiles({ query: "router", within: "." });
      expect(result).toMatchObject({
        ok: true,
        value: { tool: "find_files", root: repo, backend: "fff-mcp" },
      });
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ within: [repo], query: "router" }),
      );
      expect(await client.status()).toMatchObject({
        ok: true,
        value: { limits: { maxWorkers: 12 } },
      });
    } finally {
      await client.close();
      await daemon.close();
    }
  });

  test("closes workers while an active HTTP request is draining", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "fff-router-drain-"));
    const repo = path.join(home, "repo");
    await mkdir(repo);
    const port = await unusedPort();
    const env = { HOME: home, XDG_STATE_HOME: path.join(home, "state") };
    const configPaths = getDaemonPolicyConfigPaths({ env });
    await mkdir(configPaths.dir, { recursive: true });
    await writeFile(configPaths.jsonPath, `${JSON.stringify({ port })}\n`);

    let finishExecute = () => {};
    const execute = vi.fn<RouterService["execute"]>(
      async () =>
        await new Promise((resolve) => {
          finishExecute = () =>
            resolve({
              ok: false,
              error: { code: "WORKER_UNAVAILABLE", message: "daemon is closing" },
            });
        }),
    );
    const close = vi.fn(async () => finishExecute());
    const defaults = getDefaultRouterConfig();
    const service: RouterService = {
      execute,
      warm: vi.fn<RouterService["warm"]>(async () => ({ ok: true, value: [] })),
      evict: vi.fn<RouterService["evict"]>(async () => ({
        ok: true,
        value: { evicted: [] },
      })),
      status: () => ({ workers: [], limits: defaults.limits }),
      close,
    };
    const daemon = await startHttpDaemon({ env, service, watchConfig: false });
    const client = new RouterClient({ env, cwd: repo, autoStart: false });
    const request = client.findFiles({ query: "router", within: "." });
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());

    await Promise.race([
      daemon.close(),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error("daemon did not drain active request")), 1_000),
      ),
    ]);
    await request;
    expect(close).toHaveBeenCalledOnce();
    await client.close();
  });

  test("authenticates HTTP control reload and graceful shutdown", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "fff-router-control-"));
    const port = await unusedPort();
    const env = { HOME: home, XDG_STATE_HOME: path.join(home, "state") };
    const configPaths = getDaemonPolicyConfigPaths({ env });
    await mkdir(configPaths.dir, { recursive: true });
    await writeFile(configPaths.jsonPath, `${JSON.stringify({ port })}\n`);

    const defaults = getDefaultRouterConfig();
    const close = vi.fn(async () => {});
    const service: RouterService = {
      execute: vi.fn<RouterService["execute"]>(async () => ({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "unused" },
      })),
      warm: vi.fn<RouterService["warm"]>(async () => ({ ok: true, value: [] })),
      evict: vi.fn<RouterService["evict"]>(async () => ({
        ok: true,
        value: { evicted: [] },
      })),
      status: () => ({ workers: [], limits: defaults.limits }),
      close,
    };
    const loadReloadConfig = vi.fn(() => getDefaultDaemonReloadConfig());
    const daemon = await startHttpDaemon({
      env,
      service,
      loadReloadConfig,
      watchConfig: false,
    });
    const controlUrl = new URL("/control", daemon.url);
    try {
      const unauthorized = await fetch(controlUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reload" }),
      });
      expect(unauthorized.status).toBe(401);

      await expect(reloadDaemon(env, { clearRuntimes: true })).resolves.toBe(true);
      expect(loadReloadConfig).toHaveBeenCalledTimes(2);

      const authToken = await readDaemonAuthToken(env);
      const shutdown = await fetch(controlUrl, {
        method: "POST",
        headers: {
          ...bearerHeaders(authToken),
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "shutdown" }),
      });
      expect(shutdown.status).toBe(202);
      await Promise.race([
        daemon.done,
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error("HTTP shutdown did not close the daemon")), 1_000),
        ),
      ]);
      expect(close).toHaveBeenCalledOnce();
      await expect(readFile(getDaemonPaths({ env }).metadataPath, "utf8")).rejects.toThrow();
    } finally {
      await daemon.close();
    }
  });

  test("refuses non-loopback binding even through the embedding API", async () => {
    await expect(startHttpDaemon({ host: "0.0.0.0", watchConfig: false })).rejects.toThrow(
      /loopback/,
    );
  });

  test("rejects incompatible structured daemon output before exposing it to SDK callers", async () => {
    const client = new RouterClient({ autoStart: false, cwd: "/repo" });
    vi.spyOn(client, "callMcpTool").mockResolvedValue({
      structuredContent: {
        tool: "find_files",
        root: "/repo",
        backend: "fff-mcp",
        items: [],
        nextCursor: null,
      },
    });

    const result = await client.findFiles({ query: "router" });
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: expect.stringContaining("incompatible structured content"),
      },
    });
    await client.close();
  });

  test("shuts down an unused daemon and removes its metadata", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "fff-router-idle-"));
    const env = { HOME: home, XDG_STATE_HOME: path.join(home, "state") };
    const defaults = getDefaultRouterConfig();
    const close = vi.fn(async () => {});
    const service: RouterService = {
      execute: vi.fn(),
      warm: vi.fn<RouterService["warm"]>(async () => ({ ok: true, value: [] })),
      evict: vi.fn<RouterService["evict"]>(async () => ({
        ok: true,
        value: { evicted: [] },
      })),
      status: () => ({ workers: [], limits: defaults.limits }),
      close,
    };
    const daemon = await startHttpDaemon({
      env,
      port: 0,
      watchConfig: false,
      service,
      loadReloadConfig: () => ({
        router: {
          ...defaults,
          runtime: { ...defaults.runtime, daemonIdleTimeoutMs: 40 },
        },
      }),
    });

    await Promise.race([
      daemon.done,
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error("daemon did not idle-exit")), 1_000),
      ),
    ]);
    expect(close).toHaveBeenCalledOnce();
    await expect(readFile(getDaemonPaths({ env }).metadataPath, "utf8")).rejects.toThrow();
  });

  test("applies daemon idle timeout changes during reload", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "fff-router-idle-reload-"));
    const env = { HOME: home, XDG_STATE_HOME: path.join(home, "state") };
    const defaults = getDefaultRouterConfig();
    let daemonIdleTimeoutMs = 0;
    const service: RouterService = {
      execute: vi.fn(),
      warm: vi.fn<RouterService["warm"]>(async () => ({ ok: true, value: [] })),
      evict: vi.fn<RouterService["evict"]>(async () => ({
        ok: true,
        value: { evicted: [] },
      })),
      status: () => ({ workers: [], limits: defaults.limits }),
      close: vi.fn(async () => {}),
    };
    const daemon = await startHttpDaemon({
      env,
      port: 0,
      watchConfig: false,
      service,
      loadReloadConfig: () => ({
        router: {
          ...defaults,
          runtime: { ...defaults.runtime, daemonIdleTimeoutMs },
        },
      }),
    });

    daemonIdleTimeoutMs = 40;
    await daemon.reload();
    await Promise.race([
      daemon.done,
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error("reloaded daemon did not idle-exit")), 1_000),
      ),
    ]);
  });

  test("reload can keep the daemon resident by setting its idle timeout to zero", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "fff-router-idle-resident-"));
    const env = { HOME: home, XDG_STATE_HOME: path.join(home, "state") };
    const defaults = getDefaultRouterConfig();
    let daemonIdleTimeoutMs = 40;
    const service: RouterService = {
      execute: vi.fn(),
      warm: vi.fn<RouterService["warm"]>(async () => ({ ok: true, value: [] })),
      evict: vi.fn<RouterService["evict"]>(async () => ({
        ok: true,
        value: { evicted: [] },
      })),
      status: () => ({ workers: [], limits: defaults.limits }),
      close: vi.fn(async () => {}),
    };
    const daemon = await startHttpDaemon({
      env,
      port: 0,
      watchConfig: false,
      service,
      loadReloadConfig: () => ({
        router: {
          ...defaults,
          runtime: { ...defaults.runtime, daemonIdleTimeoutMs },
        },
      }),
    });

    try {
      daemonIdleTimeoutMs = 0;
      await daemon.reload();
      let closed = false;
      void daemon.done.then(() => {
        closed = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(closed).toBe(false);
    } finally {
      await daemon.close();
    }
  });
});
