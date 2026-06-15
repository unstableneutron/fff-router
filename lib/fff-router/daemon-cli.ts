import {
  getDoctorFffMcpStatus,
  installFffMcpBinary,
  type DoctorFffMcpStatus,
} from "./fff-mcp-installer";
import { runAgentMcpServer } from "./agent-mcp";
import { readDaemonLogs, resolveDaemonLaunchCommand } from "./daemon-autostart";
import { runInteractiveUpdate } from "./daemon-update";
import { startHttpDaemon, type DaemonMetadata } from "./http-daemon";
import {
  getDaemonConfig,
  getDaemonEndpoint,
  getDaemonOriginFromConfig,
  getDaemonPaths,
  getDaemonPolicyConfigPaths,
} from "./daemon-config";
import { runMcpSocketBridge } from "./mcp-bridge";
import type { RuntimeDiagnostic } from "./runtime-manager";
import { getToolDiagnostic, type ToolDiagnostic } from "./tool-resolution";

export type DaemonCliCommand =
  | { name: "run" }
  | { name: "mcp"; profile: "agent" | "structured" }
  | { name: "status" }
  | { name: "reload"; clearRuntimes?: boolean }
  | { name: "stop" }
  | { name: "logs" }
  | { name: "doctor" }
  | { name: "install-fff-mcp" }
  | { name: "update" };

export type DaemonStatus = {
  running: boolean;
  metadata: DaemonMetadata | null;
};

export type ToolReport = {
  fffMcp: DoctorFffMcpStatus;
  rg: ToolDiagnostic;
  fd: ToolDiagnostic;
  daemon: ReturnType<typeof resolveDaemonLaunchCommand>;
};

export type DaemonStatusReport = DaemonStatus & {
  tools: ToolReport;
};

export type DoctorReport = DaemonStatus & {
  endpoint?: string;
  configPath?: string;
  stateDir?: string;
  daemonConfig?: ReturnType<typeof getDaemonConfig>;
  fffMcp: DoctorFffMcpStatus;
  tools?: ToolReport;
  runtimes?: RuntimeDiagnostic[];
};

type ExecuteDaemonCliDeps = {
  getStatus: () => Promise<DaemonStatus>;
  getStatusReport?: () => Promise<DaemonStatusReport>;
  reloadDaemon: (options?: { clearRuntimes?: boolean }) => Promise<boolean>;
  stopDaemon: () => Promise<boolean>;
  getLogs?: () => Promise<Awaited<ReturnType<typeof readDaemonLogs>>>;
  getDoctorReport: () => Promise<DoctorReport>;
  installFffMcp: () => Promise<string>;
  runUpdate?: () => Promise<number>;
  runDaemon: () => Promise<void>;
  runMcpServer?: (profile: "agent" | "structured") => Promise<void>;
  writeStdout: (text: string) => void;
  writeStderr: (text: string) => void;
};

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function fetchHealthMetadata(env: NodeJS.ProcessEnv): Promise<DaemonMetadata | null> {
  try {
    const config = getDaemonConfig({ env });
    const response = await fetch(new URL("/health", getDaemonOriginFromConfig(config)));
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      metadata?: DaemonMetadata | null;
    };
    return payload.ok && payload.metadata ? payload.metadata : null;
  } catch {
    return null;
  }
}

export function parseDaemonCliCommand(argv: string[]): DaemonCliCommand {
  const [command, ...rest] = argv;
  switch (command) {
    case undefined:
    case "run":
      return { name: "run" };
    case "mcp":
      if (rest.length === 0) {
        return { name: "mcp", profile: "agent" };
      }
      if (rest.length === 1 && rest[0] === "--structured") {
        return { name: "mcp", profile: "structured" };
      }
      if (rest.length === 2 && rest[0] === "--profile") {
        if (rest[1] === "agent" || rest[1] === "structured") {
          return { name: "mcp", profile: rest[1] };
        }
        throw new Error(`unknown mcp profile: ${rest[1]}`);
      }
      throw new Error(`unknown mcp arguments: ${rest.join(" ")}`);
    case "status":
      return { name: "status" };
    case "reload":
      if (rest.length === 0) {
        return { name: "reload" };
      }
      if (rest.length === 1 && rest[0] === "--clear-runtimes") {
        return { name: "reload", clearRuntimes: true };
      }
      throw new Error(`unknown reload arguments: ${rest.join(" ")}`);
    case "stop":
      return { name: "stop" };
    case "logs":
      return { name: "logs" };
    case "doctor":
      return { name: "doctor" };
    case "install-fff-mcp":
      return { name: "install-fff-mcp" };
    case "update":
      return { name: "update" };
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

export async function getDaemonStatus(env: NodeJS.ProcessEnv = process.env): Promise<DaemonStatus> {
  const metadata = await fetchHealthMetadata(env);
  if (!metadata) {
    return { running: false, metadata: null };
  }

  return { running: true, metadata };
}

async function getToolReport(env: NodeJS.ProcessEnv): Promise<ToolReport> {
  const fffMcp = await getDoctorFffMcpStatus(env);
  return {
    fffMcp,
    rg: await getToolDiagnostic("rg", { env }),
    fd: await getToolDiagnostic("fd", { env }),
    daemon: resolveDaemonLaunchCommand(env),
  };
}

export async function getDaemonStatusReport(
  env: NodeJS.ProcessEnv = process.env,
): Promise<DaemonStatusReport> {
  return {
    ...(await getDaemonStatus(env)),
    tools: await getToolReport(env),
  };
}

export async function reloadDaemon(
  env: NodeJS.ProcessEnv = process.env,
  options: { clearRuntimes?: boolean } = {},
): Promise<boolean> {
  const status = await getDaemonStatus(env);
  if (!status.metadata) {
    return false;
  }

  try {
    process.kill(status.metadata.pid, options.clearRuntimes ? "SIGUSR2" : "SIGHUP");
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ESRCH") {
      return false;
    }
    throw error;
  }
  return true;
}

async function sleep(ms: number): Promise<void> {
  return await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function stopDaemon(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const status = await getDaemonStatus(env);
  if (!status.metadata) {
    return false;
  }

  try {
    process.kill(status.metadata.pid, "SIGTERM");
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ESRCH") {
      return false;
    }
    throw error;
  }
  for (const delay of [25, 50, 100, 200, 400, 800]) {
    if (!isProcessAlive(status.metadata.pid)) {
      return true;
    }
    await sleep(delay);
  }

  if (isProcessAlive(status.metadata.pid)) {
    process.kill(status.metadata.pid, "SIGKILL");
  }
  return true;
}

export async function runForegroundDaemon(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const daemon = await startHttpDaemon({ env });

  const shutdown = async () => {
    const hardExit = setTimeout(() => {
      process.exit(1);
    }, 1_000);
    hardExit.unref?.();

    try {
      await daemon.close();
      clearTimeout(hardExit);
      process.exit(0);
    } catch (error) {
      console.error("fff-routerd shutdown failed:", error);
      clearTimeout(hardExit);
      process.exit(1);
    }
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGHUP", () => {
    void daemon.reload().catch((error) => {
      console.error("fff-routerd reload failed:", error);
    });
  });
  process.on("SIGUSR2", () => {
    void daemon.reload({ clearRuntimes: true }).catch((error) => {
      console.error("fff-routerd clear-runtimes reload failed:", error);
    });
  });

  await new Promise(() => {});
}

export async function getDoctorReport(env: NodeJS.ProcessEnv = process.env): Promise<DoctorReport> {
  const status = await getDaemonStatus(env);
  const policyPaths = getDaemonPolicyConfigPaths({ env });
  const daemonPaths = getDaemonPaths({ env });
  const tools = await getToolReport(env);
  const runtimes = status.metadata
    ? await getRuntimeDiagnosticsFromHealth(status.metadata)
    : undefined;

  return {
    ...status,
    endpoint: getDaemonEndpoint({ env }),
    configPath: policyPaths.jsonPath,
    stateDir: daemonPaths.dir,
    daemonConfig: getDaemonConfig({ env }),
    fffMcp: tools.fffMcp,
    tools,
    ...(runtimes ? { runtimes } : {}),
  };
}

async function getRuntimeDiagnosticsFromHealth(
  metadata: DaemonMetadata,
): Promise<RuntimeDiagnostic[] | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 500);
  timeout.unref?.();

  try {
    const response = await fetch(
      `${getDaemonOriginFromConfig({
        host: metadata.host,
        port: metadata.port,
        mcpPath: metadata.mcpPath,
      })}/health`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      return undefined;
    }
    const body = (await response.json()) as { runtimes?: unknown };
    if (!Array.isArray(body.runtimes)) {
      return undefined;
    }
    return body.runtimes as RuntimeDiagnostic[];
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeDaemonCliCommand(
  command: DaemonCliCommand,
  deps: ExecuteDaemonCliDeps,
): Promise<number> {
  switch (command.name) {
    case "run":
      await deps.runDaemon();
      return 0;
    case "mcp":
      await (deps.runMcpServer ?? runSelectedMcpServer)(command.profile);
      return 0;
    case "status": {
      const status = await (deps.getStatusReport ?? deps.getStatus)();
      deps.writeStdout(`${JSON.stringify(status, null, 2)}\n`);
      return 0;
    }
    case "reload": {
      const reloaded = await deps.reloadDaemon(
        command.clearRuntimes ? { clearRuntimes: true } : undefined,
      );
      if (!reloaded) {
        deps.writeStderr("fff-routerd is not running\n");
        return 1;
      }
      deps.writeStdout("Reloaded fff-routerd\n");
      return 0;
    }
    case "stop": {
      const stopped = await deps.stopDaemon();
      if (!stopped) {
        deps.writeStderr("fff-routerd is not running\n");
        return 1;
      }
      deps.writeStdout("Stopped fff-routerd\n");
      return 0;
    }
    case "logs": {
      const logs = await (deps.getLogs ?? readDaemonLogs)();
      deps.writeStdout(`${JSON.stringify(logs, null, 2)}\n`);
      return 0;
    }
    case "doctor": {
      const report = await deps.getDoctorReport();
      deps.writeStdout(`${JSON.stringify(report, null, 2)}\n`);
      return 0;
    }
    case "install-fff-mcp": {
      const installedPath = await deps.installFffMcp();
      deps.writeStdout(`Installed fff-mcp to ${installedPath}\n`);
      return 0;
    }
    case "update":
      return await (deps.runUpdate ?? runInteractiveUpdate)();
  }
}

async function runSelectedMcpServer(profile: "agent" | "structured"): Promise<void> {
  if (profile === "structured") {
    await runMcpSocketBridge();
    return;
  }
  await runAgentMcpServer();
}

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const command = parseDaemonCliCommand(argv);
  return await executeDaemonCliCommand(command, {
    getStatus: async () => await getDaemonStatus(env),
    getStatusReport: async () => await getDaemonStatusReport(env),
    reloadDaemon: async (options) => await reloadDaemon(env, options),
    stopDaemon: async () => await stopDaemon(env),
    getLogs: async () => await readDaemonLogs(env),
    getDoctorReport: async () => await getDoctorReport(env),
    installFffMcp: async () => await installFffMcpBinary({ env }),
    runUpdate: async () =>
      await runInteractiveUpdate({
        env,
        stopDaemon: async () => await stopDaemon(env),
      }),
    runDaemon: async () => await runForegroundDaemon(env),
    runMcpServer: async (profile) => {
      if (profile === "structured") {
        await runMcpSocketBridge({ env });
        return;
      }
      await runAgentMcpServer({ env });
    },
    writeStdout: (text) => process.stdout.write(text),
    writeStderr: (text) => process.stderr.write(text),
  });
}
