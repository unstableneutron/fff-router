import { getDoctorFffMcpStatus, type DoctorFffMcpStatus } from "./fff-mcp-installer";
import { readDaemonLogs, resolveDaemonLaunchCommand } from "./daemon-autostart";
import {
  DAEMON_CONTROL_PATH,
  readDaemonMetadata,
  startHttpDaemon,
  type DaemonMetadata,
} from "./http-daemon";
import {
  getDaemonConfig,
  getDaemonEndpoint,
  getDaemonOriginFromConfig,
  getDaemonPaths,
  getDaemonPolicyConfigPaths,
  PACKAGE_VERSION,
} from "./daemon-config";
import type { RouterStatus, WorkerDiagnostic } from "./types";
import { bearerHeaders, readDaemonAuthToken } from "./local-auth";
import { requestJson } from "./http-json";
import { signalNativeProcessGroup } from "./process-supervisor";

const IS_PERRY = typeof (process.versions as Record<string, string | undefined>).perry === "string";

export type DaemonStatus = {
  running: boolean;
  metadata: DaemonMetadata | null;
  workers?: WorkerDiagnostic[];
  limits?: RouterStatus["limits"];
  resources?: RouterStatus["resources"];
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
  limits?: RouterStatus["limits"];
  resources?: RouterStatus["resources"];
} | null> {
  try {
    const config =
      (await readDaemonMetadata(getDaemonPaths({ env }).metadataPath)) ?? getDaemonConfig({ env });
    const response = await requestJson(`${getDaemonOriginFromConfig(config)}/health`, {
      headers: bearerHeaders(await readDaemonAuthToken(env)),
    });
    if (!response.ok) {
      return null;
    }
    const payload = response.payload as {
      ok?: boolean;
      metadata?: DaemonMetadata | null;
      workers?: WorkerDiagnostic[];
      limits?: RouterStatus["limits"];
      resources?: RouterStatus["resources"];
    };
    return payload.ok && payload.metadata
      ? {
          metadata: payload.metadata,
          workers: payload.workers ?? [],
          ...(payload.limits ? { limits: payload.limits } : {}),
          ...(payload.resources ? { resources: payload.resources } : {}),
        }
      : null;
  } catch {
    return null;
  }
}

type DaemonControlRequest = { action: "reload"; clearRuntimes?: boolean } | { action: "shutdown" };

async function requestDaemonControl(
  metadata: DaemonMetadata,
  request: DaemonControlRequest,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const token = await readDaemonAuthToken(env);
  if (!token) {
    throw new Error("fff-routerd authentication token is unavailable");
  }
  const response = await requestJson(
    `${getDaemonOriginFromConfig(metadata)}${metadata.controlPath ?? DAEMON_CONTROL_PATH}`,
    {
      method: "POST",
      headers: {
        ...bearerHeaders(token),
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
      timeoutMs: request.action === "shutdown" ? 10_000 : 60_000,
    },
  );
  const payload = response.payload;
  if (
    !response.ok ||
    typeof payload !== "object" ||
    payload === null ||
    !("ok" in payload) ||
    payload.ok !== true ||
    !("action" in payload) ||
    payload.action !== request.action
  ) {
    const detail =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String(payload.error)
        : `HTTP ${response.status}`;
    throw new Error(`fff-routerd ${request.action} was rejected: ${detail}`);
  }
}

export async function getDaemonStatus(env: NodeJS.ProcessEnv = process.env): Promise<DaemonStatus> {
  const health = await fetchHealth(env);
  return health ? { running: true, ...health } : { running: false, metadata: null };
}

export async function reloadDaemon(
  env: NodeJS.ProcessEnv = process.env,
  options: { clearRuntimes?: boolean } = {},
): Promise<boolean> {
  const status = await getDaemonStatus(env);
  if (!status.metadata) {
    return false;
  }
  await requestDaemonControl(
    status.metadata,
    { action: "reload", clearRuntimes: options.clearRuntimes === true },
    env,
  );
  return true;
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
    await requestDaemonControl(status.metadata, { action: "shutdown" }, env);
  } catch (caught) {
    // A wedged daemon may not be able to serve its control endpoint. Retain a
    // signal fallback so `stop` can still force containment cleanup; Perry
    // daemons use the authenticated HTTP path during normal operation.
    try {
      process.kill(status.metadata.pid, "SIGTERM");
    } catch (signalError) {
      if (
        typeof signalError === "object" &&
        signalError &&
        "code" in signalError &&
        signalError.code === "ESRCH"
      ) {
        // The authenticated shutdown may have completed before its HTTP
        // acknowledgement reached the client. A missing target means the
        // requested stopped state has already been reached.
        return true;
      }
      throw new AggregateError([caught, signalError], "fff-routerd shutdown failed");
    }
  }
  for (const delay of [25, 50, 100, 200, 400, 800, 1_600, 2_000]) {
    if (!isProcessAlive(status.metadata.pid)) {
      break;
    }
    await sleep(delay);
  }
  if (isProcessAlive(status.metadata.pid)) {
    process.kill(status.metadata.pid, "SIGKILL");
  }
  // A daemon that itself required SIGKILL could not run its own finally path.
  // Clean up every worker process group captured by the authenticated health
  // response so stopped or wedged fff-mcp descendants cannot become orphans.
  const liveWorkerPids = (status.workers ?? [])
    .filter((worker) => worker.state !== "dead")
    .map((worker) => worker.pid);
  for (const pid of new Set(liveWorkerPids)) {
    if (!pid || pid === process.pid || !isProcessAlive(pid)) continue;
    try {
      if (IS_PERRY && process.platform !== "win32") {
        await signalNativeProcessGroup(pid, "SIGKILL");
      } else {
        process.kill(process.platform === "win32" ? pid : -pid, "SIGKILL");
      }
    } catch (caught) {
      if (typeof caught !== "object" || !caught || !("code" in caught) || caught.code !== "ESRCH") {
        throw caught;
      }
    }
  }
  return true;
}

export async function runForegroundDaemon(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const daemon = await startHttpDaemon({ env });
  let shuttingDown = false;
  let shutdownError: unknown;
  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    const hardExit = setTimeout(() => process.exit(1), 5_000);
    try {
      await daemon.close();
      clearTimeout(hardExit);
    } catch (caught) {
      clearTimeout(hardExit);
      console.error("fff-routerd shutdown failed:", caught);
      shutdownError = caught;
    }
  };
  const onSigint = () => void shutdown();
  const onSigterm = () => void shutdown();
  const onSighup = () => {
    void daemon.reload().catch((caught) => {
      console.error("fff-routerd reload failed:", caught);
    });
  };
  const onSigusr2 = () => {
    void daemon.reload({ clearRuntimes: true }).catch((caught) => {
      console.error("fff-routerd worker eviction failed:", caught);
    });
  };
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);
  process.on("SIGHUP", onSighup);
  process.on("SIGUSR2", onSigusr2);
  try {
    await daemon.done;
  } finally {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
    process.off("SIGHUP", onSighup);
    process.off("SIGUSR2", onSigusr2);
  }
  if (shutdownError) throw shutdownError;
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
  if (command === "--version" || command === "-v") {
    process.stdout.write(`${PACKAGE_VERSION}\n`);
    return 0;
  }
  throw new Error("fff-routerd only accepts 'run'; use 'fff --help' for client commands");
}

export { readDaemonLogs };
