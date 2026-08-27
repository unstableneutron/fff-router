import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  checkDaemonBaseHealth,
  ensureDaemonRunningWithDeps,
  resolveDaemonLaunchCommand,
  shouldReclaimStartupLock,
} from "./daemon-autostart";
import {
  DAEMON_PROTOCOL_VERSION,
  PACKAGE_VERSION,
  getDaemonConfig,
  getDaemonServerFingerprint,
} from "./daemon-config";

afterEach(() => vi.restoreAllMocks());

describe("daemon startup lock lease", () => {
  test("self-dispatches the single Perry executable into daemon mode", () => {
    expect(resolveDaemonLaunchCommand({}, { nativeRuntime: true })).toEqual({
      command: process.execPath,
      args: ["__daemon"],
      source: "native",
    });
  });

  test("passes a string URL to fetch for Perry native compatibility", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "fff-router-native-fetch-"));
    const env = {
      HOME: home,
      XDG_CONFIG_HOME: path.join(home, "config"),
      XDG_STATE_HOME: path.join(home, "state"),
    };
    const config = getDaemonConfig({ env });
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          metadata: {
            host: config.host,
            port: config.port,
            mcpPath: config.mcpPath,
            protocolVersion: DAEMON_PROTOCOL_VERSION,
            packageVersion: PACKAGE_VERSION,
            serverFingerprint: getDaemonServerFingerprint({ env }),
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    await checkDaemonBaseHealth(env);

    expect(request).toHaveBeenCalledWith(
      `http://${config.host}:${config.port}/health`,
      expect.any(Object),
    );
    expect(typeof request.mock.calls[0]?.[0]).toBe("string");
  });

  test("skips health probes when no daemon metadata exists", async () => {
    const spawnDaemon = vi.fn(() => ({ unref: vi.fn(), source: "native" as const }));
    const waitForDaemonReady = vi.fn(async () => {});
    const checkDaemonHealth = vi.fn(async () => {
      throw new Error("Fetch error: error sending request for url");
    });

    await ensureDaemonRunningWithDeps(undefined, {
      checkDaemonHealth,
      readRunningDaemonMetadata: async () => null,
      signalProcess: async () => {},
      terminateProcess: async () => {},
      spawnDaemon,
      waitForDaemonReady,
      withStartupLock: async (callback) => await callback(),
    });

    expect(checkDaemonHealth).not.toHaveBeenCalled();
    expect(spawnDaemon).toHaveBeenCalledOnce();
    expect(waitForDaemonReady).toHaveBeenCalledOnce();
  });

  test("skips health probes for stale daemon metadata", async () => {
    const checkDaemonHealth = vi.fn(async () => {});
    const spawnDaemon = vi.fn(() => ({ unref: vi.fn(), source: "native" as const }));

    await ensureDaemonRunningWithDeps(undefined, {
      checkDaemonHealth,
      readRunningDaemonMetadata: async () => ({ pid: 42 }) as never,
      signalProcess: async () => {},
      terminateProcess: async () => {},
      spawnDaemon,
      waitForDaemonReady: async () => {},
      withStartupLock: async (callback) => await callback(),
      isProcessAlive: () => false,
    });

    expect(checkDaemonHealth).not.toHaveBeenCalled();
    expect(spawnDaemon).toHaveBeenCalledOnce();
  });

  test("keeps a recent lock owned by a live process", () => {
    expect(
      shouldReclaimStartupLock({
        contents: JSON.stringify({ pid: 42, createdAt: 9_000 }),
        mtimeMs: 9_000,
        now: 10_000,
        isAlive: () => true,
      }),
    ).toBe(false);
  });

  test("reclaims a lock whose owner exited", () => {
    expect(
      shouldReclaimStartupLock({
        contents: JSON.stringify({ pid: 42, createdAt: 9_000 }),
        mtimeMs: 9_000,
        now: 10_000,
        isAlive: () => false,
      }),
    ).toBe(true);
  });

  test("reclaims an expired lock even when PID namespaces make its PID look live", () => {
    expect(
      shouldReclaimStartupLock({
        contents: JSON.stringify({ pid: 1, createdAt: 1_000 }),
        mtimeMs: 1_000,
        now: 20_000,
        isAlive: () => true,
      }),
    ).toBe(true);
  });

  test("uses mtime as the lease timestamp for legacy PID-only locks", () => {
    expect(
      shouldReclaimStartupLock({
        contents: "1",
        mtimeMs: 1_000,
        now: 20_000,
        isAlive: () => true,
      }),
    ).toBe(true);
  });
});
