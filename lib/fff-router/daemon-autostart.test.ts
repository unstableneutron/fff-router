import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  checkDaemonHealth,
  ensureDaemonRunning,
  ensureDaemonRunningWithDeps,
  resolveDaemonLaunchCommand,
} from "./daemon-autostart";
import { DAEMON_PROTOCOL_VERSION, PACKAGE_VERSION } from "./daemon-config";
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
          base_path: request.within?.[0] ?? "/repo",
          next_cursor: null,
          items: [],
        },
      };
    },
  };
}

describe("resolveDaemonLaunchCommand", () => {
  test("prefers the installed fff-routerd command when available", () => {
    expect(
      resolveDaemonLaunchCommand({ HOME: "/home/test" } as NodeJS.ProcessEnv, {
        resolveExecutableOnPath: (command) =>
          command === "fff-routerd" ? "/usr/local/bin/fff-routerd" : null,
      }),
    ).toEqual({ command: "/usr/local/bin/fff-routerd", args: [], source: "path" });
  });

  test("falls back to the packaged built daemon entrypoint when the command is unavailable", () => {
    const result = resolveDaemonLaunchCommand({ HOME: "/home/test" } as NodeJS.ProcessEnv, {
      resolveExecutableOnPath: () => null,
    });

    expect(result.command).toBe(process.execPath);
    expect(result.args).toHaveLength(1);
    expect(result.args[0]).toMatch(/dist\/bin\/fff-routerd\.js$/);
    expect(result.args[0]).not.toMatch(/\.ts$/);
    expect(result.source).toBe("packaged");
  });
});

describe("ensureDaemonRunningWithDeps", () => {
  test("sends SIGHUP when only the reload fingerprint mismatches", async () => {
    const home = await makeTempHome();
    await writeConfigFile({ home, port: 46301, backend: "fff-node" });
    const signalProcess = vi.fn(async () => {});
    const terminateProcess = vi.fn(async () => {});
    const spawnDaemon = vi.fn(() => ({ unref() {}, source: "packaged" as const }));
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
        packageVersion: PACKAGE_VERSION,
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
    const signalProcess = vi.fn(async () => {
      throw new Error("EPERM");
    });
    const terminateProcess = vi.fn(async () => {});
    const spawnDaemon = vi.fn(() => ({ unref() {}, source: "packaged" as const }));
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
        port: 46306,
        mcpPath: "/mcp",
        protocolVersion: "version",
        packageVersion: PACKAGE_VERSION,
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

  test("restarts the daemon when SIGHUP reload fails", async () => {
    const home = await makeTempHome();
    await writeConfigFile({ home, port: 46302, backend: "fff-node" });
    const signalProcess = vi.fn(async () => {
      throw new Error("signal unsupported");
    });
    const terminateProcess = vi.fn(async () => {});
    const spawnDaemon = vi.fn(() => ({ unref() {}, source: "packaged" as const }));
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
        port: 46302,
        mcpPath: "/mcp",
        protocolVersion: DAEMON_PROTOCOL_VERSION,
        packageVersion: PACKAGE_VERSION,
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
    const spawnDaemon = vi.fn(() => ({ unref() {}, source: "packaged" as const }));
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
        packageVersion: PACKAGE_VERSION,
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

  test("falls back to the packaged daemon when a PATH daemon starts with the wrong version", async () => {
    const home = await makeTempHome();
    await writeConfigFile({ home, port: 46308, backend: "fff-node" });
    const signalProcess = vi.fn(async () => {});
    const terminateProcess = vi.fn(async () => {});
    const spawnDaemon = vi
      .fn()
      .mockReturnValueOnce({ unref() {}, source: "path" as const })
      .mockReturnValueOnce({ unref() {}, source: "packaged" as const });
    const waitForDaemonReady = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(
        Object.assign(new Error("daemon package version mismatch; restart required"), {
          mismatchKind: "version",
          metadata: { pid: 456 },
        }),
      )
      .mockResolvedValueOnce(undefined);
    const checkHealth = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockRejectedValueOnce(new Error("fetch failed"));

    await ensureDaemonRunningWithDeps({ HOME: home } as NodeJS.ProcessEnv, {
      checkDaemonHealth: checkHealth,
      readRunningDaemonMetadata: async () => ({
        pid: 123,
        host: "127.0.0.1",
        port: 46308,
        mcpPath: "/mcp",
        protocolVersion: DAEMON_PROTOCOL_VERSION,
        packageVersion: "0.0.9",
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
    expect(terminateProcess).toHaveBeenCalledWith(456);
    expect(spawnDaemon).toHaveBeenNthCalledWith(1, { HOME: home });
    expect(spawnDaemon).toHaveBeenNthCalledWith(2, { HOME: home }, { preferPackaged: true });
    expect(waitForDaemonReady).toHaveBeenCalledTimes(2);
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
    expect(daemon.metadata.packageVersion).toBe(PACKAGE_VERSION);
  });
});
