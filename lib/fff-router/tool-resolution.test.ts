import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { resolveToolCommand } from "./tool-resolution";

describe("fff-mcp command resolution", () => {
  test("prefers the explicit override", () => {
    expect(
      resolveToolCommand("fff-mcp", {
        env: { FFF_ROUTER_FFF_MCP_BIN: "/custom/fff-mcp" },
        isExecutable: () => true,
      }),
    ).toMatchObject({ command: "/custom/fff-mcp", source: "env", executable: true });
  });

  test("uses PATH before the managed install", () => {
    expect(
      resolveToolCommand("fff-mcp", {
        env: { HOME: "/home/test" },
        resolveExecutableOnPath: () => "/usr/bin/fff-mcp",
        isExecutable: () => true,
      }),
    ).toMatchObject({ command: "/usr/bin/fff-mcp", source: "path" });
  });

  test("discovers the setup-managed binary even when ~/.local/bin is not on PATH", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "fff-router-tool-"));
    const binary = path.join(home, ".local", "bin", "fff-mcp");
    await import("node:fs/promises").then(({ mkdir }) =>
      mkdir(path.dirname(binary), { recursive: true }),
    );
    await writeFile(binary, "#!/bin/sh\n");
    await chmod(binary, 0o755);
    expect(
      resolveToolCommand("fff-mcp", {
        env: { HOME: home, PATH: "" },
        resolveExecutableOnPath: () => null,
      }),
    ).toMatchObject({ command: binary, source: "managed", executable: true });
  });
});
