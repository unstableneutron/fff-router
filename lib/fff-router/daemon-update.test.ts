import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  checkFffMcpUpdate,
  checkFffRouterdUpdate,
  installFffMcpUpdate,
  runInteractiveUpdate,
  selectLatestFffMcpRelease,
  type FffMcpUpdatePlan,
} from "./daemon-update";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fff-router-update-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("runInteractiveUpdate", () => {
  test("prompts for available fff-mcp and fff-routerd updates", async () => {
    const prompts: string[] = [];
    const stdout: string[] = [];
    const installFffMcpUpdate = vi.fn(async () => "/home/test/.local/bin/fff-mcp");
    const installFffRouterdUpdate = vi.fn(async () => {});
    const stopDaemon = vi.fn(async () => true);

    const exitCode = await runInteractiveUpdate({
      checkFffMcpUpdate: async () => ({
        kind: "outdated",
        binaryPath: "/home/test/.local/bin/fff-mcp",
        target: "aarch64-apple-darwin",
        currentVersion: "0.9.1",
        latestVersion: "0.9.4",
        latestTag: "v0.9.4",
        assetUrl: "https://example.test/fff-mcp",
        checksumUrl: "https://example.test/fff-mcp.sha256",
      }),
      checkFffRouterdUpdate: async () => ({
        kind: "outdated",
        currentVersion: "0.7.0",
        latestVersion: "0.7.1",
        command: ["aube", "add", "-g", "github:unstableneutron/fff-router"],
      }),
      installFffMcpUpdate,
      installFffRouterdUpdate,
      stopDaemon,
      confirm: async (question) => {
        prompts.push(question);
        return true;
      },
      writeStdout: (text) => stdout.push(text),
      writeStderr: () => {},
    });

    expect(exitCode).toBe(0);
    expect(prompts).toEqual([
      "Update fff-mcp 0.9.1 -> 0.9.4?",
      "Update fff-routerd 0.7.0 -> 0.7.1 with aube?",
    ]);
    expect(installFffMcpUpdate).toHaveBeenCalledTimes(1);
    expect(installFffRouterdUpdate).toHaveBeenCalledTimes(1);
    expect(stopDaemon).toHaveBeenCalledTimes(1);
    expect(stdout.join("")).toContain("Updated fff-mcp to 0.9.4");
    expect(stdout.join("")).toContain("Updated fff-routerd to 0.7.1");
    expect(stdout.join("")).toContain("Stopped fff-routerd; it will restart on the next request.");
  });

  test("skips declined updates and leaves the daemon running", async () => {
    const installFffMcpUpdate = vi.fn(async () => "/home/test/.local/bin/fff-mcp");
    const stopDaemon = vi.fn(async () => true);
    const stdout: string[] = [];

    const exitCode = await runInteractiveUpdate({
      checkFffMcpUpdate: async () => ({
        kind: "outdated",
        binaryPath: "/home/test/.local/bin/fff-mcp",
        target: "aarch64-apple-darwin",
        currentVersion: "0.9.1",
        latestVersion: "0.9.4",
        latestTag: "v0.9.4",
        assetUrl: "https://example.test/fff-mcp",
        checksumUrl: "https://example.test/fff-mcp.sha256",
      }),
      checkFffRouterdUpdate: async () => ({
        kind: "current",
        currentVersion: "0.7.0",
        latestVersion: "0.7.0",
      }),
      installFffMcpUpdate,
      installFffRouterdUpdate: async () => {},
      stopDaemon,
      confirm: async () => false,
      writeStdout: (text) => stdout.push(text),
      writeStderr: () => {},
    });

    expect(exitCode).toBe(0);
    expect(installFffMcpUpdate).not.toHaveBeenCalled();
    expect(stopDaemon).not.toHaveBeenCalled();
    expect(stdout.join("")).toContain("Skipped fff-mcp update.");
    expect(stdout.join("")).toContain("fff-routerd is already up to date (0.7.0).");
  });
});

describe("checkFffMcpUpdate", () => {
  test("checks the standard install path instead of PATH", async () => {
    const plan = await checkFffMcpUpdate({
      env: { HOME: "/home/test", PATH: "/tmp/elsewhere" } as NodeJS.ProcessEnv,
      target: "aarch64-apple-darwin",
      readInstalledVersion: async (binaryPath) => {
        expect(binaryPath).toBe("/home/test/.local/bin/fff-mcp");
        return "0.9.1";
      },
      getLatestRelease: async () => ({
        tag: "v0.9.4",
        version: "0.9.4",
        assetUrl: "https://example.test/fff-mcp-aarch64-apple-darwin",
        checksumUrl: "https://example.test/fff-mcp-aarch64-apple-darwin.sha256",
      }),
    });

    expect(plan).toMatchObject({
      kind: "outdated",
      binaryPath: "/home/test/.local/bin/fff-mcp",
      currentVersion: "0.9.1",
      latestVersion: "0.9.4",
    });
  });
});

describe("selectLatestFffMcpRelease", () => {
  test("skips nightly releases when selecting the newest compatible asset", () => {
    const release = selectLatestFffMcpRelease(
      [
        {
          tag_name: "0.9.5-nightly.cf171e0",
          prerelease: true,
          assets: [
            {
              name: "fff-mcp-aarch64-apple-darwin",
              browser_download_url: "https://example.test/nightly/fff-mcp",
            },
            {
              name: "fff-mcp-aarch64-apple-darwin.sha256",
              browser_download_url: "https://example.test/nightly/fff-mcp.sha256",
            },
          ],
        },
        {
          tag_name: "v0.9.4",
          prerelease: false,
          assets: [
            {
              name: "fff-mcp-aarch64-apple-darwin",
              browser_download_url: "https://example.test/stable/fff-mcp",
            },
            {
              name: "fff-mcp-aarch64-apple-darwin.sha256",
              browser_download_url: "https://example.test/stable/fff-mcp.sha256",
            },
          ],
        },
      ],
      "aarch64-apple-darwin",
    );

    expect(release).toEqual({
      tag: "v0.9.4",
      version: "0.9.4",
      assetUrl: "https://example.test/stable/fff-mcp",
      checksumUrl: "https://example.test/stable/fff-mcp.sha256",
    });
  });
});

describe("installFffMcpUpdate", () => {
  test("verifies the release checksum and atomically replaces the binary", async () => {
    const home = await makeTempDir();
    const installDir = path.join(home, ".local", "bin");
    const binaryPath = path.join(installDir, "fff-mcp");
    const bytes = Buffer.from("new fff-mcp binary");
    const digest = createHash("sha256").update(bytes).digest("hex");
    const plan: FffMcpUpdatePlan = {
      kind: "outdated",
      binaryPath,
      target: "aarch64-apple-darwin",
      currentVersion: "0.9.1",
      latestVersion: "0.9.4",
      latestTag: "v0.9.4",
      assetUrl: "https://example.test/fff-mcp",
      checksumUrl: "https://example.test/fff-mcp.sha256",
    };

    await mkdir(installDir, { recursive: true });
    await writeFile(binaryPath, "old binary");
    const installedPath = await installFffMcpUpdate(plan, {
      downloadToFile: async (_url, destinationPath) => {
        await writeFile(destinationPath, bytes);
      },
      fetchText: async () => `${digest}  fff-mcp-aarch64-apple-darwin\n`,
    });

    expect(installedPath).toBe(binaryPath);
    expect(await readFile(binaryPath, "utf8")).toBe("new fff-mcp binary");
    const manifest = JSON.parse(
      await readFile(path.join(installDir, ".fff-mcp-install.json"), "utf8"),
    ) as { tag: string; target: string; version: string };
    expect(manifest).toMatchObject({
      tag: "v0.9.4",
      target: "aarch64-apple-darwin",
      version: "0.9.4",
    });
  });
});

describe("checkFffRouterdUpdate", () => {
  test("checks the GitHub package version and prepares an aube update command", async () => {
    const plan = await checkFffRouterdUpdate({
      currentVersion: "0.7.0",
      commandExists: async (command) => command === "aube",
      getLatestVersion: async () => "0.7.1",
    });

    expect(plan).toEqual({
      kind: "outdated",
      currentVersion: "0.7.0",
      latestVersion: "0.7.1",
      command: ["aube", "add", "-g", "github:unstableneutron/fff-router"],
    });
  });
});
