import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  executeDaemonCliCommand,
  getDaemonStatus,
  parseDaemonCliCommand,
  reloadDaemon,
  stopDaemon,
} from "./daemon-cli";
import { DAEMON_PROTOCOL_VERSION, PACKAGE_VERSION } from "./daemon-config";
import type { DaemonMetadata } from "./http-daemon";

const tempDirs: string[] = [];
const originalFetch = globalThis.fetch;

async function makeTempHome(): Promise<string> {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "fff-router-daemon-cli-"));
  tempDirs.push(tempHome);
  return tempHome;
}

async function writeConfigFile(args: { home: string; port: number }): Promise<void> {
  const dir = path.join(args.home, ".config", "fff-routerd");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "config.json"),
    `{
      "host": "127.0.0.1",
      "port": ${args.port},
      "mcpPath": "/mcp",
      "backend": "fff-node"
    }`,
  );
}

async function writeDaemonJson(args: { home: string; metadata: DaemonMetadata }): Promise<void> {
  const dir = path.join(args.home, ".local", "state", "fff-routerd");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "daemon.json"), `${JSON.stringify(args.metadata, null, 2)}\n`);
}

function daemonMetadata(pid: number, port: number): DaemonMetadata {
  return {
    pid,
    host: "127.0.0.1",
    port,
    mcpPath: "/mcp",
    protocolVersion: DAEMON_PROTOCOL_VERSION,
    packageVersion: PACKAGE_VERSION,
    serverFingerprint: "server",
    reloadFingerprint: "reload",
    startedAt: 1,
  };
}

function mockHealth(metadata: DaemonMetadata | null): void {
  globalThis.fetch = vi.fn(
    async () =>
      new Response(JSON.stringify({ ok: Boolean(metadata), metadata }), {
        status: metadata ? 200 : 503,
        headers: { "content-type": "application/json" },
      }),
  ) as unknown as typeof fetch;
}

afterEach(async () => {
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("parseDaemonCliCommand", () => {
  test("defaults to run with no args", () => {
    expect(parseDaemonCliCommand([])).toEqual({ name: "run" });
  });

  test("parses status, reload, stop, doctor, install-fff-mcp, update, and mcp", () => {
    expect(parseDaemonCliCommand(["status"])).toEqual({ name: "status" });
    expect(parseDaemonCliCommand(["reload"])).toEqual({ name: "reload" });
    expect(parseDaemonCliCommand(["stop"])).toEqual({ name: "stop" });
    expect(parseDaemonCliCommand(["logs"])).toEqual({ name: "logs" });
    expect(parseDaemonCliCommand(["doctor"])).toEqual({ name: "doctor" });
    expect(parseDaemonCliCommand(["install-fff-mcp"])).toEqual({ name: "install-fff-mcp" });
    expect(parseDaemonCliCommand(["update"])).toEqual({ name: "update" });
    expect(parseDaemonCliCommand(["mcp"])).toEqual({ name: "mcp", profile: "agent" });
    expect(parseDaemonCliCommand(["mcp", "--profile", "agent"])).toEqual({
      name: "mcp",
      profile: "agent",
    });
    expect(parseDaemonCliCommand(["mcp", "--profile", "structured"])).toEqual({
      name: "mcp",
      profile: "structured",
    });
    expect(parseDaemonCliCommand(["mcp", "--structured"])).toEqual({
      name: "mcp",
      profile: "structured",
    });
  });

  test("rejects unknown mcp profiles", () => {
    expect(() => parseDaemonCliCommand(["mcp", "--profile", "wat"])).toThrow(
      /unknown mcp profile/i,
    );
  });

  test("rejects unknown commands", () => {
    expect(() => parseDaemonCliCommand(["wat"])).toThrow(/unknown command/i);
  });
});

describe("daemon lifecycle health checks", () => {
  test("status returns live health metadata instead of stale daemon.json metadata", async () => {
    const home = await makeTempHome();
    await writeConfigFile({ home, port: 46401 });
    await writeDaemonJson({ home, metadata: daemonMetadata(111, 46401) });
    const healthMetadata = daemonMetadata(222, 46401);
    mockHealth(healthMetadata);
    vi.spyOn(process, "kill").mockReturnValue(true);

    await expect(getDaemonStatus({ HOME: home } as NodeJS.ProcessEnv)).resolves.toEqual({
      running: true,
      metadata: healthMetadata,
    });
  });

  test("status reports stopped when daemon.json exists but health is unavailable", async () => {
    const home = await makeTempHome();
    await writeConfigFile({ home, port: 46402 });
    await writeDaemonJson({ home, metadata: daemonMetadata(process.pid, 46402) });
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    await expect(getDaemonStatus({ HOME: home } as NodeJS.ProcessEnv)).resolves.toEqual({
      running: false,
      metadata: null,
    });
  });

  test("reload signals the pid from live health metadata", async () => {
    const home = await makeTempHome();
    await writeConfigFile({ home, port: 46403 });
    await writeDaemonJson({ home, metadata: daemonMetadata(111, 46403) });
    mockHealth(daemonMetadata(222, 46403));
    const kill = vi.spyOn(process, "kill").mockReturnValue(true);

    await expect(reloadDaemon({ HOME: home } as NodeJS.ProcessEnv)).resolves.toBe(true);

    expect(kill).toHaveBeenCalledWith(222, "SIGHUP");
    expect(kill).not.toHaveBeenCalledWith(111, "SIGHUP");
  });

  test("reload reports not running when the health pid vanishes before SIGHUP", async () => {
    const home = await makeTempHome();
    await writeConfigFile({ home, port: 46406 });
    mockHealth(daemonMetadata(222, 46406));
    vi.spyOn(process, "kill").mockImplementation((_pid, signal) => {
      if (signal === "SIGHUP") {
        const error = new Error("no such process");
        (error as NodeJS.ErrnoException).code = "ESRCH";
        throw error;
      }
      return true;
    });

    await expect(reloadDaemon({ HOME: home } as NodeJS.ProcessEnv)).resolves.toBe(false);
  });

  test("stop signals the pid from live health metadata", async () => {
    const home = await makeTempHome();
    await writeConfigFile({ home, port: 46404 });
    await writeDaemonJson({ home, metadata: daemonMetadata(111, 46404) });
    mockHealth(daemonMetadata(222, 46404));
    const kill = vi.spyOn(process, "kill").mockImplementation((_pid, signal) => {
      if (signal === 0) {
        throw new Error("ESRCH");
      }
      return true;
    });

    await expect(stopDaemon({ HOME: home } as NodeJS.ProcessEnv)).resolves.toBe(true);

    expect(kill).toHaveBeenCalledWith(222, "SIGTERM");
    expect(kill).not.toHaveBeenCalledWith(111, "SIGTERM");
  });

  test("stop reports not running when the health pid vanishes before SIGTERM", async () => {
    const home = await makeTempHome();
    await writeConfigFile({ home, port: 46405 });
    mockHealth(daemonMetadata(222, 46405));
    vi.spyOn(process, "kill").mockImplementation((_pid, signal) => {
      if (signal === "SIGTERM") {
        const error = new Error("no such process");
        (error as NodeJS.ErrnoException).code = "ESRCH";
        throw error;
      }
      return true;
    });

    await expect(stopDaemon({ HOME: home } as NodeJS.ProcessEnv)).resolves.toBe(false);
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

  test("status uses richer status report when provided", async () => {
    const writeStdout = vi.fn();
    const report = {
      running: true,
      metadata,
      tools: {
        fffMcp: {
          found: true as const,
          path: "/bin/fff-mcp",
          source: "path" as const,
          executable: true,
          envVar: "FFF_ROUTER_FFF_MCP_BIN",
        },
        rg: {
          tool: "rg" as const,
          command: "/bin/rg",
          source: "path" as const,
          envVar: "FFF_ROUTER_RG_BIN",
          executable: true,
        },
        fd: {
          tool: "fd" as const,
          command: "/bin/fd",
          source: "path" as const,
          envVar: "FFF_ROUTER_FD_BIN",
          executable: true,
        },
        daemon: {
          command: process.execPath,
          args: ["/pkg/fff-routerd.js"],
          source: "packaged" as const,
        },
      },
    };

    const exitCode = await executeDaemonCliCommand(
      { name: "status" },
      {
        getStatus: async () => ({ running: true, metadata }),
        getStatusReport: async () => report,
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
    expect(writeStdout).toHaveBeenCalledWith(`${JSON.stringify(report, null, 2)}\n`);
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

  test("mcp delegates to the selected MCP profile runner", async () => {
    const runMcpServer = vi.fn(async () => {});

    const exitCode = await executeDaemonCliCommand(
      { name: "mcp", profile: "agent" },
      {
        getStatus: async () => ({ running: false, metadata: null }),
        reloadDaemon: async () => false,
        stopDaemon: async () => false,
        getDoctorReport: async () => ({ running: false, metadata: null, fffMcp: { found: false } }),
        installFffMcp: async () => "/tmp/fff-mcp",
        runDaemon: async () => {},
        runMcpServer,
        writeStdout: vi.fn(),
        writeStderr: vi.fn(),
      },
    );

    expect(exitCode).toBe(0);
    expect(runMcpServer).toHaveBeenCalledWith("agent");
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
          fffMcp: {
            found: true,
            path: "/home/test/.local/bin/fff-mcp",
            source: "path",
            executable: true,
            envVar: "FFF_ROUTER_FFF_MCP_BIN",
          },
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
          fffMcp: {
            found: true,
            path: "/home/test/.local/bin/fff-mcp",
            source: "path",
            executable: true,
            envVar: "FFF_ROUTER_FFF_MCP_BIN",
          },
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

  test("update delegates to the interactive updater", async () => {
    const runUpdate = vi.fn(async () => 0);

    const exitCode = await executeDaemonCliCommand(
      { name: "update" },
      {
        getStatus: async () => ({ running: false, metadata: null }),
        reloadDaemon: async () => false,
        stopDaemon: async () => false,
        getDoctorReport: async () => ({ running: false, metadata: null, fffMcp: { found: false } }),
        installFffMcp: async () => "/tmp/fff-mcp",
        getLogs: async () => ({
          stdoutPath: "/tmp/out",
          stderrPath: "/tmp/err",
          stdout: "",
          stderr: "",
        }),
        runDaemon: async () => {},
        runUpdate,
        writeStdout: vi.fn(),
        writeStderr: vi.fn(),
      },
    );

    expect(exitCode).toBe(0);
    expect(runUpdate).toHaveBeenCalledTimes(1);
  });

  test("logs prints daemon log tails", async () => {
    const writeStdout = vi.fn();

    const exitCode = await executeDaemonCliCommand(
      { name: "logs" },
      {
        getStatus: async () => ({ running: false, metadata: null }),
        reloadDaemon: async () => false,
        stopDaemon: async () => false,
        getDoctorReport: async () => ({ running: false, metadata: null, fffMcp: { found: false } }),
        installFffMcp: async () => "/tmp/fff-mcp",
        getLogs: async () => ({
          stdoutPath: "/tmp/daemon.stdout.log",
          stderrPath: "/tmp/daemon.stderr.log",
          stdout: "out tail",
          stderr: "err tail",
        }),
        runDaemon: async () => {},
        writeStdout,
        writeStderr: vi.fn(),
      },
    );

    expect(exitCode).toBe(0);
    expect(writeStdout).toHaveBeenCalledWith(
      `${JSON.stringify(
        {
          stdoutPath: "/tmp/daemon.stdout.log",
          stderrPath: "/tmp/daemon.stderr.log",
          stdout: "out tail",
          stderr: "err tail",
        },
        null,
        2,
      )}\n`,
    );
  });
});
