import { describe, expect, test } from "vitest";
import { getToolDiagnostic, resolveToolCommand } from "./tool-resolution";

describe("resolveToolCommand", () => {
  test("honors fff-mcp, rg, and fd env overrides", () => {
    const env = {
      FFF_ROUTER_FFF_MCP_BIN: "/opt/bin/fff-mcp",
      FFF_ROUTER_RG_BIN: "/opt/bin/rg",
      FFF_ROUTER_FD_BIN: "/opt/bin/fd",
    } as NodeJS.ProcessEnv;

    expect(resolveToolCommand("fff-mcp", { env }).command).toBe("/opt/bin/fff-mcp");
    expect(resolveToolCommand("rg", { env }).command).toBe("/opt/bin/rg");
    expect(resolveToolCommand("fd", { env }).command).toBe("/opt/bin/fd");
  });

  test("checks override executable bit once", () => {
    let checks = 0;

    const result = resolveToolCommand("rg", {
      env: { FFF_ROUTER_RG_BIN: "/opt/bin/rg" } as NodeJS.ProcessEnv,
      isExecutable: () => {
        checks += 1;
        return false;
      },
    });

    expect(checks).toBe(1);
    expect(result).toMatchObject({
      command: "/opt/bin/rg",
      executable: false,
      remediation: expect.stringContaining("FFF_ROUTER_RG_BIN"),
    });
  });

  test("falls back to PATH when no override is set", () => {
    expect(
      resolveToolCommand("rg", {
        env: { PATH: "/bin" } as NodeJS.ProcessEnv,
        resolveExecutableOnPath: (command) => (command === "rg" ? "/bin/rg" : null),
        isExecutable: () => true,
      }),
    ).toMatchObject({
      tool: "rg",
      command: "/bin/rg",
      source: "path",
      executable: true,
    });
  });

  test("reports missing tools with remediation", () => {
    expect(
      resolveToolCommand("fd", {
        env: { PATH: "/bin" } as NodeJS.ProcessEnv,
        resolveExecutableOnPath: () => null,
      }),
    ).toMatchObject({
      tool: "fd",
      command: null,
      source: "missing",
      executable: false,
      remediation: expect.stringContaining("FFF_ROUTER_FD_BIN"),
    });
  });
});

describe("getToolDiagnostic", () => {
  test("includes version output for resolved executable tools", async () => {
    await expect(
      getToolDiagnostic("rg", {
        env: { PATH: "/bin" } as NodeJS.ProcessEnv,
        resolveExecutableOnPath: () => "/bin/rg",
        isExecutable: () => true,
        runVersion: async (command) => `${command} 14.1.0\n`,
      }),
    ).resolves.toMatchObject({
      tool: "rg",
      command: "/bin/rg",
      source: "path",
      executable: true,
      version: "/bin/rg 14.1.0",
    });
  });

  test("omits version when version probe times out", async () => {
    await expect(
      getToolDiagnostic("rg", {
        env: { PATH: "/bin" } as NodeJS.ProcessEnv,
        resolveExecutableOnPath: () => "/bin/rg",
        isExecutable: () => true,
        versionTimeoutMs: 1,
        runVersion: async (_command, options) => {
          await new Promise((resolve) => setTimeout(resolve, options.timeoutMs + 10));
          return "/bin/rg 14.1.0\n";
        },
      }),
    ).resolves.toMatchObject({
      tool: "rg",
      command: "/bin/rg",
      executable: true,
    });
    await expect(
      getToolDiagnostic("rg", {
        env: { PATH: "/bin" } as NodeJS.ProcessEnv,
        resolveExecutableOnPath: () => "/bin/rg",
        isExecutable: () => true,
        versionTimeoutMs: 1,
        runVersion: async (_command, options) => {
          await new Promise((resolve) => setTimeout(resolve, options.timeoutMs + 10));
          return "/bin/rg 14.1.0\n";
        },
      }),
    ).resolves.not.toHaveProperty("version");
  });
});
