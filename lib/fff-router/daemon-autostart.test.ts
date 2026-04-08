import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  checkDaemonHealth,
  ensureDaemonRunning,
  ensureDaemonRunningWithDeps,
} from "./daemon-autostart";
import { DAEMON_PROTOCOL_VERSION } from "./daemon-config";
import { startHttpDaemon } from "./http-daemon";
import type { SearchCoordinator } from "./types";

const startedDaemons: Array<Awaited<ReturnType<typeof startHttpDaemon>>> = [];
const tempDirs: string[] = [];

async function makeTempHome(): Promise<string> {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "fff-router-daemon-autostart-"));
  tempDirs.push(tempHome);
  return tempHome;
}

async function writeConfigFile(args: {
  home: string;
  port: number;
  backend?: "fff-node" | "rg" | "fff-mcp";
  text?: string;
}): Promise<void> {
  const dir = path.join(args.home, ".config", "fff-routerd");
  await mkdir(dir, { recursive: true });
  const content =
    args.text ??
    `{
      "host": "127.0.0.1",
      "port": ${args.port},
      "mcpPath": "/mcp",
      "backend": "${args.backend ?? "fff-node"}"
    }`;
  await writeFile(path.join(dir, "config.json"), content);
}

afterEach(async () => {
  while (startedDaemons.length > 0) {
    await startedDaemons.pop()?.close();
  }
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function makeCoordinator(): SearchCoordinator {
  return {
    async execute(request) {
      return {
        ok: true,
        value: {
          mode: "compact",
          base_path: request.within || "/repo",
          next_cursor: null,
          items: [],
        },
      };
    },
  };
}

describe("ensureDaemonRunningWithDeps", () => {
  test("sends SIGHUP when only the reload fingerprint mismatches", async () => {
    const home = await makeTempHome();
    await writeConfigFile({ home, port: 46301, backend: "fff-node" });
    const signalProcess = vi.fn(async () => {});
    const terminateProcess = vi.fn(async () => {});
    const spawnDaemon = vi.fn(() => ({ unref() {} }));
    const waitForDaemonReady = vi.fn(async () => {});
    const checkHealth = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(
        Object.assign(
          new Error("daemon reload config mismatch; send SIGHUP to reload configuration"),
          {
            mismatchKind: "reload",
            metadata: { pid: 123 },
          },
        ),
      )
      .mockRejectedValueOnce(
        Object.assign(
          new Error("daemon reload config mismatch; send SIGHUP to reload configuration"),
          {
            mismatchKind: "reload",
            metadata: { pid: 123 },
          },
        ),
      )
      .mockResolvedValueOnce(undefined);

    await ensureDaemonRunningWithDeps({ HOME: home } as NodeJS.ProcessEnv, {
      checkDaemonHealth: checkHealth,
      readRunningDaemonMetadata: async () => ({
        pid: 123,
        host: "127.0.0.1",
        port: 46301,
        mcpPath: "/mcp",
        protocolVersion: DAEMON_PROTOCOL_VERSION,
        serverFingerprint: "server",
        reloadFingerprint: "reload",
        startedAt: Date.now(),
      }),
      signalProcess,
      terminateProcess,
      spawnDaemon,
      waitForDaemonReady,
      withStartupLock: async (callback) => await callback(),
    });

    expect(signalProcess).toHaveBeenCalledWith(123, "SIGHUP");
    expect(terminateProcess).not.toHaveBeenCalled();
    expect(spawnDaemon).not.toHaveBeenCalled();
    expect(waitForDaemonReady).toHaveBeenCalledTimes(1);
  });


  test("restarts the daemon when SIGHUP reload signal fails", async () => {
    const home = await makeTempHome();
    await writeConfigFile({ home, port: 46306, backend: "fff-node" });
    const signalProcess = vi.fn(async () => { throw new Error("EPERM"); });
    const terminateProcess = vi.fn(async () => {});
    const spawnDaemon = vi.fn(() => ({ unref() {} }));
    const waitForDaemonReady = vi.fn(async () => {});
    const checkHealth = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(
        Object.assign(
          new Error("daemon reload config mismatch; send SIGHUP to reload configuration"),
          {
            mismatchKind: "reload",
            metadata: { pid: 123 },
          }
        ),
      )
      .mockRejectedValueOnce(
        Object.assign(
          new Error("daemon reload config mismatch; send SIGHUP to reload configuration"),
          {
            mismatchKind: "reload",
            metadata: { pid: 123 },
          }
        ),
      )
      .mockResolvedValueOnce(undefined);

    await ensureDaemonRunningWithDeps({ HOME: home } as NodeJS.ProcessEnv, {
      checkDaemonHealth: checkHealth,
      readRunningDaemonMetadata: async () => ({
        pid: 123,
        host: "127.0.0.1",
        port: 46306,
        mcpPath: "/mcp",
        protocolVersion: "version",
        serverFingerprint: "server",
        reloadFingerprint: "reload",
        startedAt: Date.now(),
      }),
      signalProcess,
      terminateProcess,
      spawnDaemon,
      waitForDaemonReady,
      withStartupLock: async (callback) => await callback(),
    });

    expect(signalProcess).toHaveBeenCalledWith(123, "SIGHUP");
    expect(terminateProcess).toHaveBeenCalledWith(123);
    expect(spawnDaemon).toHaveBeenCalledTimes(1);
    expect(waitForDaemonReady).toHaveBeenCalledTimes(1);
  });

  test("restarts the daemon when the server fingerprint mismatches", async () => {
    const home = await makeTempHome();
    await writeConfigFile({ home, port: 46302, backend: "fff-node" });
    const signalProcess = vi.fn(async () => {});
    const terminateProcess = vi.fn(async () => {});
    const spawnDaemon = vi.fn(() => ({ unref() {} }));
    const waitForDaemonReady = vi.fn(async () => {});
    const checkHealth = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(
        Object.assign(new Error("daemon server config mismatch; restart required"), {
          mismatchKind: "server",
          metadata: { pid: 123 },
        }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("daemon server config mismatch; restart required"), {
          mismatchKind: "server",
          metadata: { pid: 123 },
        }),
      )
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce(undefined);

    await ensureDaemonRunningWithDeps({ HOME: home } as NodeJS.ProcessEnv, {
      checkDaemonHealth: checkHealth,
      readRunningDaemonMetadata: async () => ({
        pid: 123,
        host: "127.0.0.1",
        port: 46302,
        mcpPath: "/mcp",
        protocolVersion: DAEMON_PROTOCOL_VERSION,
        serverFingerprint: "server",
        reloadFingerprint: "reload",
        startedAt: Date.now(),
      }),
      signalProcess,
      terminateProcess,
      spawnDaemon,
      waitForDaemonReady,
      withStartupLock: async (callback) => await callback(),
    });

    expect(signalProcess).not.toHaveBeenCalled();
    expect(terminateProcess).toHaveBeenCalledWith(123);
    expect(spawnDaemon).toHaveBeenCalledTimes(1);
    expect(waitForDaemonReady).toHaveBeenCalledTimes(1);
  });
});

describe("checkDaemonHealth", () => {
  test("accepts a daemon with the expected protocol version and split fingerprints", async () => {
    const home = await makeTempHome();
    const port = 46303;
    await writeConfigFile({ home, port, backend: "fff-node" });
    const env = { HOME: home } as NodeJS.ProcessEnv;
    const daemon = await startHttpDaemon({
      env,
      coordinator: makeCoordinator(),
      watchConfig: false,
    });
    startedDaemons.push(daemon);

    await expect(checkDaemonHealth(env)).resolves.toBeUndefined();
  });

  test("fails when the canonical config file becomes invalid", async () => {
    const home = await makeTempHome();
    const port = 46304;
    await writeConfigFile({ home, port, backend: "fff-node" });
    const env = { HOME: home } as NodeJS.ProcessEnv;
    const daemon = await startHttpDaemon({
      env,
      coordinator: makeCoordinator(),
      watchConfig: false,
    });
    startedDaemons.push(daemon);

    await writeConfigFile({ home, port, text: `{ invalid json` });

    await expect(ensureDaemonRunning(env)).rejects.toThrow();
  });

  test("rejects a daemon when only the reload fingerprint drifts", async () => {
    const home = await makeTempHome();
    const port = 46305;
    await writeConfigFile({ home, port, backend: "fff-node" });
    const env = { HOME: home } as NodeJS.ProcessEnv;
    const daemon = await startHttpDaemon({
      env,
      coordinator: makeCoordinator(),
      watchConfig: false,
    });
    startedDaemons.push(daemon);

    await writeConfigFile({ home, port, backend: "rg" });

    await expect(checkDaemonHealth(env)).rejects.toMatchObject({
      message: expect.stringMatching(/reload config mismatch/i),
      mismatchKind: "reload",
    });
    expect(daemon.metadata.protocolVersion).toBe(DAEMON_PROTOCOL_VERSION);
  });
});
