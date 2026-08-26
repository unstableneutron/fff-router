import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { getDaemonPolicyConfigPaths } from "./daemon-config";
import { RouterClient } from "./http-client";
import { startHttpDaemon } from "./http-daemon";
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
      status: () => ({ workers: [], limits: { maxWorkers: 12, maxNonGitWorkers: 4 } }),
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
});
