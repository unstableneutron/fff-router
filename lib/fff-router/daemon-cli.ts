import {
  getDoctorFffMcpStatus,
  installFffMcpBinary,
  type DoctorFffMcpStatus,
} from "./fff-mcp-installer";
import { readDaemonMetadata, startHttpDaemon, type DaemonMetadata } from "./http-daemon";
import {
  getDaemonConfig,
  getDaemonEndpoint,
  getDaemonPaths,
  getDaemonPolicyConfigPaths,
} from "./daemon-config";

export type DaemonCliCommand =
  | { name: "run" }
  | { name: "status" }
  | { name: "reload" }
  | { name: "stop" }
  | { name: "doctor" }
  | { name: "install-fff-mcp" };

export type DaemonStatus = {
  running: boolean;
  metadata: DaemonMetadata | null;
};

export type DoctorReport = DaemonStatus & {
  endpoint?: string;
  configPath?: string;
  stateDir?: string;
  daemonConfig?: ReturnType<typeof getDaemonConfig>;
  fffMcp: DoctorFffMcpStatus;
};

type ExecuteDaemonCliDeps = {
  getStatus: () => Promise<DaemonStatus>;
  reloadDaemon: () => Promise<boolean>;
  stopDaemon: () => Promise<boolean>;
  getDoctorReport: () => Promise<DoctorReport>;
  installFffMcp: () => Promise<string>;
  runDaemon: () => Promise<void>;
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

export function parseDaemonCliCommand(argv: string[]): DaemonCliCommand {
  const [command] = argv;
  switch (command) {
    case undefined:
    case "run":
      return { name: "run" };
    case "status":
      return { name: "status" };
    case "reload":
      return { name: "reload" };
    case "stop":
      return { name: "stop" };
    case "doctor":
      return { name: "doctor" };
    case "install-fff-mcp":
      return { name: "install-fff-mcp" };
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

export async function getDaemonStatus(env: NodeJS.ProcessEnv = process.env): Promise<DaemonStatus> {
  const metadata = await readDaemonMetadata(getDaemonPaths({ env }).metadataPath);
  if (!metadata || !isProcessAlive(metadata.pid)) {
    return { running: false, metadata: null };
  }

  return { running: true, metadata };
}

export async function reloadDaemon(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const status = await getDaemonStatus(env);
  if (!status.metadata) {
    return false;
  }

  process.kill(status.metadata.pid, "SIGHUP");
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

  process.kill(status.metadata.pid, "SIGTERM");
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

  await new Promise(() => {});
}

export async function getDoctorReport(env: NodeJS.ProcessEnv = process.env): Promise<DoctorReport> {
  const status = await getDaemonStatus(env);
  const policyPaths = getDaemonPolicyConfigPaths({ env });
  const daemonPaths = getDaemonPaths({ env });

  return {
    ...status,
    endpoint: getDaemonEndpoint({ env }),
    configPath: policyPaths.jsonPath,
    stateDir: daemonPaths.dir,
    daemonConfig: getDaemonConfig({ env }),
    fffMcp: await getDoctorFffMcpStatus(env),
  };
}

export async function executeDaemonCliCommand(
  command: DaemonCliCommand,
  deps: ExecuteDaemonCliDeps,
): Promise<number> {
  switch (command.name) {
    case "run":
      await deps.runDaemon();
      return 0;
    case "status": {
      const status = await deps.getStatus();
      deps.writeStdout(`${JSON.stringify(status, null, 2)}\n`);
      return 0;
    }
    case "reload": {
      const reloaded = await deps.reloadDaemon();
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
  }
}

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const command = parseDaemonCliCommand(argv);
  return await executeDaemonCliCommand(command, {
    getStatus: async () => await getDaemonStatus(env),
    reloadDaemon: async () => await reloadDaemon(env),
    stopDaemon: async () => await stopDaemon(env),
    getDoctorReport: async () => await getDoctorReport(env),
    installFffMcp: async () => await installFffMcpBinary({ env }),
    runDaemon: async () => await runForegroundDaemon(env),
    writeStdout: (text) => process.stdout.write(text),
    writeStderr: (text) => process.stderr.write(text),
  });
}
