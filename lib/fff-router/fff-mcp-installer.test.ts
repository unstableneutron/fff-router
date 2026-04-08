import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  detectFffMcpTarget,
  getDoctorFffMcpStatus,
  installFffMcpBinary,
} from "./fff-mcp-installer";

const tempDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "fff-mcp-installer-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("detectFffMcpTarget", () => {
  test("maps supported linux and darwin platforms", () => {
    expect(detectFffMcpTarget("linux", "x64")).toBe("x86_64-unknown-linux-musl");
    expect(detectFffMcpTarget("linux", "arm64")).toBe("aarch64-unknown-linux-musl");
    expect(detectFffMcpTarget("darwin", "arm64")).toBe("aarch64-apple-darwin");
  });

  test("rejects unsupported combinations", () => {
    expect(() => detectFffMcpTarget("linux", "ia32")).toThrow(/unsupported architecture/i);
    expect(() => detectFffMcpTarget("freebsd", "x64")).toThrow(/unsupported os/i);
  });
});

describe("getDoctorFffMcpStatus", () => {
  test("reports found binary from PATH", async () => {
    const dir = await makeTempDir();
    const binaryPath = path.join(dir, "fff-mcp");
    await writeFile(binaryPath, "#!/bin/sh\nexit 0\n");

    const status = await getDoctorFffMcpStatus({ PATH: dir } as NodeJS.ProcessEnv);
    expect(status).toEqual({ found: true, path: binaryPath });
  });
});

describe("installFffMcpBinary", () => {
  test("downloads the release asset into the install dir", async () => {
    const home = await makeTempDir();
    const installDir = path.join(home, "bin");

    const installedPath = await installFffMcpBinary({
      env: { HOME: home, FFF_MCP_INSTALL_DIR: installDir } as NodeJS.ProcessEnv,
      target: "aarch64-apple-darwin",
      getLatestTag: async () => "v1.2.3",
      downloadToFile: async (_url, destinationPath) => {
        await writeFile(destinationPath, "binary-data");
      },
    });

    expect(installedPath).toBe(path.join(installDir, "fff-mcp"));
    expect(await readFile(installedPath, "utf8")).toBe("binary-data");
    const manifest = JSON.parse(
      await readFile(path.join(installDir, ".fff-mcp-install.json"), "utf8"),
    ) as { tag: string; target: string };
    expect(manifest.tag).toBe("v1.2.3");
    expect(manifest.target).toBe("aarch64-apple-darwin");
  });
});
