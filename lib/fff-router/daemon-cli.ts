import { getDoctorFffMcpStatus, type DoctorFffMcpStatus } from "./fff-mcp-installer";
import { readDaemonLogs, resolveDaemonLaunchCommand } from "./daemon-autostart";
import { startHttpDaemon, type DaemonMetadata } from "./http-daemon";
import {
  getDaemonConfig,
  getDaemonEndpoint,
  getDaemonOriginFromConfig,
  getDaemonPaths,
  getDaemonPolicyConfigPaths,
} from "./daemon-config";
import type { WorkerDiagnostic } from "./types";
import { bearerHeaders, readDaemonAuthToken } from "./local-auth";

export type DaemonStatus = {
  running: boolean;
  metadata: DaemonMetadata | null;
  workers?: WorkerDiagnostic[];
};

export type DoctorReport = DaemonStatus & {
  endpoint: string;
  configPath: string;
  stateDir: string;
  daemonConfig: ReturnType<typeof getDaemonConfig>;
  fffMcp: DoctorFffMcpStatus;
  daemon: ReturnType<typeof resolveDaemonLaunchCommand>;
};

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function fetchHealth(env: NodeJS.ProcessEnv): Promise<{
  metadata: DaemonMetadata;
  workers: WorkerDiagnostic[];
} | null> {
  try {
    const config = getDaemonConfig({ env });
    const response = await fetch(new URL("/health", getDaemonOriginFromConfig(config)), {
      headers: bearerHeaders(await readDaemonAuthToken(env)),
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      ok?: boolean;
      metadata?: DaemonMetadata | null;
      workers?: WorkerDiagnostic[];
    };
    return payload.ok && payload.metadata
      ? { metadata: payload.metadata, workers: payload.workers ?? [] }
      : null;
  } catch {
    return null;
  }
}

export async function getDaemonStatus(env: NodeJS.ProcessEnv = process.env): Promise<DaemonStatus> {
  const health = await fetchHealth(env);
  return health
    ? { running: true, metadata: health.metadata, workers: health.workers }
    : { running: false, metadata: null };
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
    return true;
  } catch (caught) {
    if (typeof caught === "object" && caught && "code" in caught && caught.code === "ESRCH") {
      return false;
    }
    throw caught;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function stopDaemon(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const status = await getDaemonStatus(env);
  if (!status.metadata) {
    return false;
  }
  try {
    process.kill(status.metadata.pid, "SIGTERM");
  } catch (caught) {
    if (typeof caught === "object" && caught && "code" in caught && caught.code === "ESRCH") {
      return false;
    }
    throw caught;
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
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    const hardExit = setTimeout(() => process.exit(1), 5_000);
    hardExit.unref?.();
    try {
      await daemon.close();
      clearTimeout(hardExit);
      process.exit(0);
    } catch (caught) {
      console.error("fff-routerd shutdown failed:", caught);
      process.exit(1);
    }
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  process.on("SIGHUP", () => {
    void daemon.reload().catch((caught) => {
      console.error("fff-routerd reload failed:", caught);
    });
  });
  process.on("SIGUSR2", () => {
    void daemon.reload({ clearRuntimes: true }).catch((caught) => {
      console.error("fff-routerd worker eviction failed:", caught);
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
    daemon: resolveDaemonLaunchCommand(env),
  };
}

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const command = argv[0] ?? "run";
  if (command === "run" && argv.length <= 1) {
    await runForegroundDaemon(env);
    return 0;
  }
  if (command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(
      "Usage: fff-routerd [run]\n\nRun the per-user fff-mcp routing daemon. Use the 'fff' command for search and administration.\n",
    );
    return 0;
  }
  throw new Error("fff-routerd only accepts 'run'; use 'fff --help' for client commands");
}

export { readDaemonLogs };
