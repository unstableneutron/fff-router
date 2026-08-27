import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  DAEMON_PROTOCOL_VERSION,
  getDaemonConfig,
  getDaemonPolicyConfigPaths,
  loadDaemonReloadConfig,
} from "./daemon-config";

async function configEnv(value: unknown) {
  const home = await mkdtemp(path.join(os.tmpdir(), "fff-router-config-"));
  const env = { HOME: home, XDG_STATE_HOME: path.join(home, "state") };
  const paths = getDaemonPolicyConfigPaths({ env });
  await mkdir(paths.dir, { recursive: true });
  await writeFile(paths.jsonPath, `${JSON.stringify(value)}\n`);
  return env;
}

describe("v2 daemon config", () => {
  test("uses an explicit v2 protocol identity", () => {
    expect(DAEMON_PROTOCOL_VERSION).toBe("fff-router-v2");
  });

  test("honors XDG_CONFIG_HOME without changing home expansion", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "fff-router-home-"));
    const configRoot = await mkdtemp(path.join(os.tmpdir(), "fff-router-xdg-config-"));
    const env = { HOME: home, XDG_CONFIG_HOME: configRoot };
    const paths = getDaemonPolicyConfigPaths({ env });
    expect(paths.dir).toBe(path.join(configRoot, "fff-routerd"));
    await mkdir(paths.dir, { recursive: true });
    await writeFile(paths.jsonPath, `${JSON.stringify({ warmRoots: ["~/src/project"] })}\n`);
    expect(loadDaemonReloadConfig({ env }).router.warmRoots).toEqual([
      path.join(home, "src/project"),
    ]);
  });

  test("loads warm roots, allowlists, TTLs, limits, and runtime policy", async () => {
    const env = await configEnv({
      host: "127.0.0.2",
      port: 5000,
      warmRoots: ["~/src/project"],
      allowlist: ["~/scratch"],
      ttl: { gitMs: 10, nonGitMs: 5 },
      limits: { maxWorkers: 4, maxNonGitWorkers: 2 },
      runtime: { toolTimeoutMs: 100, sweepIntervalMs: 20, restartBackoffMs: 2 },
    });
    expect(getDaemonConfig({ env })).toMatchObject({ host: "127.0.0.2", port: 5000 });
    expect(loadDaemonReloadConfig({ env }).router).toMatchObject({
      warmRoots: [path.join(env.HOME!, "src/project")],
      allowlistedNonGitPrefixes: [{ prefix: path.join(env.HOME!, "scratch") }],
      ttl: { gitMs: 10, nonGitMs: 5 },
      limits: { maxWorkers: 4, maxNonGitWorkers: 2 },
    });
  });

  test("rejects removed backend selection instead of carrying compatibility", async () => {
    const env = await configEnv({ backend: "fff-node" });
    expect(() => loadDaemonReloadConfig({ env })).toThrow(/unknown field.*backend/);
  });

  test("rejects non-loopback binds", async () => {
    const env = await configEnv({ host: "0.0.0.0" });
    expect(() => getDaemonConfig({ env })).toThrow(/machine-local/);
  });

  test.each(["/health", "/control"])("reserves daemon path %s", async (mcpPath) => {
    const env = await configEnv({ mcpPath });
    expect(() => getDaemonConfig({ env })).toThrow(/reserved/);
  });

  test("rejects incoherent worker limits", async () => {
    const env = await configEnv({ limits: { maxWorkers: 1, maxNonGitWorkers: 2 } });
    expect(() => loadDaemonReloadConfig({ env })).toThrow(/must not exceed/);
  });
});
