import { describe, expect, test, vi } from "vitest";
import { executeDaemonCliCommand, parseDaemonCliCommand } from "./daemon-cli";
import type { DaemonMetadata } from "./http-daemon";

describe("parseDaemonCliCommand", () => {
  test("defaults to run with no args", () => {
    expect(parseDaemonCliCommand([])).toEqual({ name: "run" });
  });

  test("parses status, reload, stop, doctor, and install-fff-mcp", () => {
    expect(parseDaemonCliCommand(["status"])).toEqual({ name: "status" });
    expect(parseDaemonCliCommand(["reload"])).toEqual({ name: "reload" });
    expect(parseDaemonCliCommand(["stop"])).toEqual({ name: "stop" });
    expect(parseDaemonCliCommand(["doctor"])).toEqual({ name: "doctor" });
    expect(parseDaemonCliCommand(["install-fff-mcp"])).toEqual({ name: "install-fff-mcp" });
  });

  test("rejects unknown commands", () => {
    expect(() => parseDaemonCliCommand(["wat"])).toThrow(/unknown command/i);
  });
});

describe("executeDaemonCliCommand", () => {
  const metadata: DaemonMetadata = {
    pid: 123,
    host: "127.0.0.1",
    port: 4319,
    mcpPath: "/mcp",
    protocolVersion: "fff-router-http-daemon-v1",
    packageVersion: "0.1.0",
    serverFingerprint: "server",
    reloadFingerprint: "reload",
    startedAt: 1,
  };

  test("prints JSON status", async () => {
    const writeStdout = vi.fn();

    const exitCode = await executeDaemonCliCommand(
      { name: "status" },
      {
        getStatus: async () => ({ running: true, metadata }),
        reloadDaemon: async () => false,
        stopDaemon: async () => false,
        getDoctorReport: async () => ({ running: true, metadata, fffMcp: { found: false } }),
        installFffMcp: async () => "/tmp/fff-mcp",
        runDaemon: async () => {},
        writeStdout,
        writeStderr: vi.fn(),
      },
    );

    expect(exitCode).toBe(0);
    expect(writeStdout).toHaveBeenCalledWith(
      `${JSON.stringify({ running: true, metadata }, null, 2)}\n`,
    );
  });

  test("reload reports success", async () => {
    const writeStdout = vi.fn();

    const exitCode = await executeDaemonCliCommand(
      { name: "reload" },
      {
        getStatus: async () => ({ running: true, metadata }),
        reloadDaemon: async () => true,
        stopDaemon: async () => false,
        getDoctorReport: async () => ({ running: true, metadata, fffMcp: { found: false } }),
        installFffMcp: async () => "/tmp/fff-mcp",
        runDaemon: async () => {},
        writeStdout,
        writeStderr: vi.fn(),
      },
    );

    expect(exitCode).toBe(0);
    expect(writeStdout).toHaveBeenCalledWith("Reloaded fff-routerd\n");
  });

  test("stop reports failure when no daemon is running", async () => {
    const writeStderr = vi.fn();

    const exitCode = await executeDaemonCliCommand(
      { name: "stop" },
      {
        getStatus: async () => ({ running: false, metadata: null }),
        reloadDaemon: async () => false,
        stopDaemon: async () => false,
        getDoctorReport: async () => ({ running: false, metadata: null, fffMcp: { found: false } }),
        installFffMcp: async () => "/tmp/fff-mcp",
        runDaemon: async () => {},
        writeStdout: vi.fn(),
        writeStderr,
      },
    );

    expect(exitCode).toBe(1);
    expect(writeStderr).toHaveBeenCalledWith("fff-routerd is not running\n");
  });

  test("run delegates to the daemon runner", async () => {
    const runDaemon = vi.fn(async () => {});

    const exitCode = await executeDaemonCliCommand(
      { name: "run" },
      {
        getStatus: async () => ({ running: false, metadata: null }),
        reloadDaemon: async () => false,
        stopDaemon: async () => false,
        getDoctorReport: async () => ({ running: false, metadata: null, fffMcp: { found: false } }),
        installFffMcp: async () => "/tmp/fff-mcp",
        runDaemon,
        writeStdout: vi.fn(),
        writeStderr: vi.fn(),
      },
    );

    expect(exitCode).toBe(0);
    expect(runDaemon).toHaveBeenCalledTimes(1);
  });

  test("doctor prints JSON diagnostics", async () => {
    const writeStdout = vi.fn();

    const exitCode = await executeDaemonCliCommand(
      { name: "doctor" },
      {
        getStatus: async () => ({ running: true, metadata }),
        reloadDaemon: async () => false,
        stopDaemon: async () => false,
        getDoctorReport: async () => ({
          running: true,
          metadata,
          endpoint: "http://127.0.0.1:4319/mcp",
          configPath: "/home/test/.config/fff-routerd/config.json",
          stateDir: "/home/test/.local/state/fff-routerd",
          fffMcp: { found: true, path: "/home/test/.local/bin/fff-mcp" },
        }),
        installFffMcp: async () => "/tmp/fff-mcp",
        runDaemon: async () => {},
        writeStdout,
        writeStderr: vi.fn(),
      },
    );

    expect(exitCode).toBe(0);
    expect(writeStdout).toHaveBeenCalledWith(
      `${JSON.stringify(
        {
          running: true,
          metadata,
          endpoint: "http://127.0.0.1:4319/mcp",
          configPath: "/home/test/.config/fff-routerd/config.json",
          stateDir: "/home/test/.local/state/fff-routerd",
          fffMcp: { found: true, path: "/home/test/.local/bin/fff-mcp" },
        },
        null,
        2,
      )}\n`,
    );
  });

  test("install-fff-mcp reports installed path", async () => {
    const writeStdout = vi.fn();

    const exitCode = await executeDaemonCliCommand(
      { name: "install-fff-mcp" },
      {
        getStatus: async () => ({ running: false, metadata: null }),
        reloadDaemon: async () => false,
        stopDaemon: async () => false,
        getDoctorReport: async () => ({ running: false, metadata: null, fffMcp: { found: false } }),
        installFffMcp: async () => "/home/test/.local/bin/fff-mcp",
        runDaemon: async () => {},
        writeStdout,
        writeStderr: vi.fn(),
      },
    );

    expect(exitCode).toBe(0);
    expect(writeStdout).toHaveBeenCalledWith(
      "Installed fff-mcp to /home/test/.local/bin/fff-mcp\n",
    );
  });
});
