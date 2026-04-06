import { afterEach, describe, expect, test } from "vitest";
import { checkDaemonHealth } from "./daemon-autostart";
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
