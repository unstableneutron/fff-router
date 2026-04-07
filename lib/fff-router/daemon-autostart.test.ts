import { afterEach, describe, expect, test, vi } from "vitest";
import { checkDaemonHealth, ensureDaemonRunningWithDeps } from "./daemon-autostart";
import { DAEMON_PROTOCOL_VERSION, getDaemonConfigFingerprint } from "./daemon-config";
import { startHttpDaemon } from "./http-daemon";
import type { SearchCoordinator } from "./types";

const startedDaemons: Array<Awaited<ReturnType<typeof startHttpDaemon>>> = [];

afterEach(async () => {
  while (startedDaemons.length > 0) {
    await startedDaemons.pop()?.close();
  }
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
  test("replaces a stale daemon when the fingerprint/backend mismatches", async () => {
    const terminateProcess = vi.fn(async () => {});
    const spawnDaemon = vi.fn(() => ({ unref() {} }));
    const waitForDaemonReady = vi.fn(async () => {});
    const checkHealth = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(
        new Error("daemon config mismatch; restart the daemon with the current configuration"),
      )
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce(undefined);

    await ensureDaemonRunningWithDeps({ FFF_ROUTER_BACKEND: "rg" } as NodeJS.ProcessEnv, {
      checkDaemonHealth: checkHealth,
      readRunningDaemonMetadata: async () => ({
        pid: 123,
        host: "127.0.0.1",
        port: 4319,
        mcpPath: "/mcp",
        protocolVersion: "fff-router-http-daemon-v1",
        configFingerprint: "oldfingerprint",
        startedAt: Date.now(),
      }),
      terminateProcess,
      spawnDaemon,
      waitForDaemonReady,
      withStartupLock: async (callback) => await callback(),
    });

    expect(terminateProcess).toHaveBeenCalledWith(123);
    expect(spawnDaemon).toHaveBeenCalledTimes(1);
    expect(waitForDaemonReady).toHaveBeenCalledTimes(1);
  });

  test("surfaces invalid HOME-based allowlist config before spawn", async () => {
    const checkHealth = vi.fn<() => Promise<void>>(async () => {
      throw new Error("fetch failed");
    });
    const spawnDaemon = vi.fn(() => ({ unref() {} }));

    await expect(
      ensureDaemonRunningWithDeps(
        {
          FFF_ROUTER_ALLOWLIST: "~/.config",
        } as NodeJS.ProcessEnv,
        {
          checkDaemonHealth: checkHealth,
          readRunningDaemonMetadata: async () => null,
          terminateProcess: async () => {},
          spawnDaemon,
          waitForDaemonReady: async () => {},
          withStartupLock: async (callback) => await callback(),
        },
      ),
    ).rejects.toThrow(/HOME must be set/i);

    expect(checkHealth).not.toHaveBeenCalled();
    expect(spawnDaemon).not.toHaveBeenCalled();
  });
});

describe("checkDaemonHealth", () => {
  test("accepts a daemon with the expected protocol version and config fingerprint", async () => {
    const env = {
      ...process.env,
      FFF_ROUTER_HOST: "127.0.0.1",
      FFF_ROUTER_PORT: "4321",
    };
    const daemon = await startHttpDaemon({
      host: "127.0.0.1",
      port: 4321,
      env,
      coordinator: makeCoordinator(),
    });
    startedDaemons.push(daemon);

    await expect(checkDaemonHealth(env)).resolves.toBeUndefined();
  });

  test("rejects a daemon when the expected config fingerprint does not match", async () => {
    const daemonEnv = {
      ...process.env,
      FFF_ROUTER_HOST: "127.0.0.1",
      FFF_ROUTER_PORT: "4322",
    };
    const daemon = await startHttpDaemon({
      host: "127.0.0.1",
      port: 4322,
      env: daemonEnv,
      coordinator: makeCoordinator(),
    });
    startedDaemons.push(daemon);

    const mismatchedEnv = {
      ...daemonEnv,
      FFF_ROUTER_ALLOWLIST: "/different/root",
    };
    expect(getDaemonConfigFingerprint({ env: mismatchedEnv })).not.toBe(
      daemon.metadata.configFingerprint,
    );

    await expect(checkDaemonHealth(mismatchedEnv)).rejects.toThrow(/config mismatch/i);
    expect(daemon.metadata.protocolVersion).toBe(DAEMON_PROTOCOL_VERSION);
  });
});
