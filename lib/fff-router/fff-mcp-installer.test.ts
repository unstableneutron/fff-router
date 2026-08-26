import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { detectFffMcpTarget, getDoctorFffMcpStatus } from "./fff-mcp-installer";

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
    await chmod(binaryPath, 0o755);

    const status = await getDoctorFffMcpStatus({ PATH: dir } as NodeJS.ProcessEnv);
    expect(status).toMatchObject({
      found: true,
      path: binaryPath,
      source: "path",
      executable: true,
    });
  });
});
