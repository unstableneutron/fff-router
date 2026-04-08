import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  getDaemonConfig,
  getDaemonEndpoint,
  getDaemonPaths,
  getDaemonPolicyConfigPaths,
  getDaemonReloadFingerprint,
  getDaemonServerFingerprint,
  getDefaultDaemonFileConfig,
  loadDaemonReloadConfig,
  readPreferredDaemonPolicyFile,
} from "./daemon-config";

const tempDirs: string[] = [];

async function makeTempHome(): Promise<string> {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "fff-router-daemon-config-"));
  tempDirs.push(tempHome);
  return tempHome;
}

async function writeConfigFile(args: {
  home: string;
  fileName: "config.json" | "config.jsonc";
  text: string;
}): Promise<void> {
  const dir = path.join(args.home, ".config", "fff-routerd");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, args.fileName), args.text);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("daemon config file", () => {
  test("creates ~/.config/fff-routerd/config.json with defaults on first read", async () => {
    const home = await makeTempHome();
    const env = { HOME: home } as NodeJS.ProcessEnv;

    const file = readPreferredDaemonPolicyFile({ env });
    const written = await readFile(file.path, "utf8");

    expect(file.path).toBe(path.join(home, ".config", "fff-routerd", "config.json"));
    expect(JSON.parse(written)).toEqual(getDefaultDaemonFileConfig());
  });

  test("reads config from config.json with comments", async () => {
    const home = await makeTempHome();
    await writeConfigFile({
      home,
      fileName: "config.json",
      text: `{
        // comments should work in config.json too
        "host": "127.0.0.1",
        "port": 9999,
        "mcpPath": "/custom",
        "backend": "rg",
        "allowlist": ["~/.config", "$HOME/src"],
        "promotion": { "windowMs": 1234 }
      }`,
    });

    const env = { HOME: home } as NodeJS.ProcessEnv;
    expect(getDaemonConfig({ env })).toEqual({
      host: "127.0.0.1",
      port: 9999,
      mcpPath: "/custom",
    });
    expect(loadDaemonReloadConfig({ env }).backend.primaryBackendId).toBe("rg");
    expect(loadDaemonReloadConfig({ env }).router.allowlistedNonGitPrefixes).toEqual([
      { prefix: path.join(home, ".config"), mode: "first-child-root" },
      { prefix: path.join(home, "src"), mode: "first-child-root" },
    ]);
    expect(loadDaemonReloadConfig({ env }).router.promotion.windowMs).toBe(1234);
  });

  test("falls back to config.jsonc when config.json is absent", async () => {
    const home = await makeTempHome();
    await writeConfigFile({
      home,
      fileName: "config.jsonc",
      text: `{
        /* comments should work in config.jsonc */
        "backend": "fff-mcp"
      }`,
    });

    const config = loadDaemonReloadConfig({ env: { HOME: home } as NodeJS.ProcessEnv });
    expect(config.backend.primaryBackendId).toBe("fff-mcp");
    expect(config.backend.fallbackBackendId).toBe("rg");
  });

  test("prefers config.json when both files exist", async () => {
    const home = await makeTempHome();
    await writeConfigFile({
      home,
      fileName: "config.json",
      text: `{ "backend": "rg" }`,
    });
    await writeConfigFile({
      home,
      fileName: "config.jsonc",
      text: `{ "backend": "fff-mcp" }`,
    });

    const config = loadDaemonReloadConfig({ env: { HOME: home } as NodeJS.ProcessEnv });
    expect(config.backend.primaryBackendId).toBe("rg");
  });

  test("rejects config files with invalid value types", async () => {
    const home = await makeTempHome();
    await writeConfigFile({
      home,
      fileName: "config.json",
      text: `{
        "ttl": { "gitMs": "60000" }
      }`,
    });

    expect(() => loadDaemonReloadConfig({ env: { HOME: home } as NodeJS.ProcessEnv })).toThrow(
      /ttl\.gitMs must be a finite number/i,
    );
  });

  test("rejects invalid port and mcpPath values", async () => {
    const home = await makeTempHome();
    await writeConfigFile({
      home,
      fileName: "config.json",
      text: `{
        "port": 70000,
        "mcpPath": "mcp"
      }`,
    });

    expect(() => getDaemonConfig({ env: { HOME: home } as NodeJS.ProcessEnv })).toThrow(
      /port must be an integer between 1 and 65535/i,
    );
  });

  test("formats IPv6 daemon endpoints correctly", async () => {
    const home = await makeTempHome();
    await writeConfigFile({
      home,
      fileName: "config.json",
      text: `{
        "host": "::1",
        "port": 4319,
        "mcpPath": "/mcp"
      }`,
    });

    expect(getDaemonEndpoint({ env: { HOME: home } as NodeJS.ProcessEnv })).toBe(
      "http://[::1]:4319/mcp",
    );
  });

  test("returns config file paths under ~/.config/fff-routerd", async () => {
    const home = await makeTempHome();

    expect(getDaemonPolicyConfigPaths({ env: { HOME: home } as NodeJS.ProcessEnv })).toEqual({
      dir: path.join(home, ".config", "fff-routerd"),
      jsonPath: path.join(home, ".config", "fff-routerd", "config.json"),
      jsoncPath: path.join(home, ".config", "fff-routerd", "config.jsonc"),
    });
  });

  test("stores daemon state under XDG state home", async () => {
    const home = await makeTempHome();

    expect(getDaemonPaths({ env: { HOME: home } as NodeJS.ProcessEnv })).toEqual({
      dir: path.join(home, ".local", "state", "fff-routerd"),
      metadataPath: path.join(home, ".local", "state", "fff-routerd", "daemon.json"),
      lockPath: path.join(home, ".local", "state", "fff-routerd", "startup.lock"),
    });
  });
});

describe("daemon fingerprints", () => {
  test("reload fingerprint changes when backend or router policy changes", async () => {
    const home = await makeTempHome();
    const env = { HOME: home } as NodeJS.ProcessEnv;

    await writeConfigFile({
      home,
      fileName: "config.json",
      text: `{ "backend": "fff-node", "allowlist": ["~/.config"] }`,
    });
    const before = getDaemonReloadFingerprint({ env });

    await writeConfigFile({
      home,
      fileName: "config.json",
      text: `{ "backend": "rg", "allowlist": ["~/.config", "$HOME/src"] }`,
    });

    expect(getDaemonReloadFingerprint({ env })).not.toBe(before);
  });

  test("server fingerprint ignores reloadable policy changes", async () => {
    const home = await makeTempHome();
    const env = { HOME: home } as NodeJS.ProcessEnv;

    await writeConfigFile({
      home,
      fileName: "config.json",
      text: `{ "host": "127.0.0.1", "port": 4319, "mcpPath": "/mcp", "backend": "fff-node" }`,
    });
    const before = getDaemonServerFingerprint({ env });

    await writeConfigFile({
      home,
      fileName: "config.json",
      text: `{ "host": "127.0.0.1", "port": 4319, "mcpPath": "/mcp", "backend": "rg" }`,
    });

    expect(getDaemonServerFingerprint({ env })).toBe(before);
  });

  test("server fingerprint changes when host, port, or mcp path changes", async () => {
    const home = await makeTempHome();
    const env = { HOME: home } as NodeJS.ProcessEnv;
    await writeConfigFile({
      home,
      fileName: "config.json",
      text: `{ "host": "127.0.0.1", "port": 4319, "mcpPath": "/mcp" }`,
    });

    expect(getDaemonServerFingerprint({ env })).not.toBe(
      getDaemonServerFingerprint({
        env,
        daemonConfig: { port: 4320 },
      }),
    );
  });
});
