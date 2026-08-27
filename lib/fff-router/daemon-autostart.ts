import { spawn as spawnChildProcess } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DAEMON_PROTOCOL_VERSION,
  PACKAGE_VERSION,
  getDaemonConfig,
  getDaemonOriginFromConfig,
  getDaemonReloadFingerprint,
  getDaemonServerFingerprint,
  getDaemonPaths,
} from "./daemon-config";
import { readDaemonMetadata, type DaemonMetadata } from "./http-daemon";
import { requestJson } from "./http-json";
import { bearerHeaders, readDaemonAuthToken } from "./local-auth";
import { resolveExecutableOnPath as defaultResolveExecutableOnPath } from "./tool-resolution";

type DaemonHealthMismatchKind = "protocol" | "version" | "server" | "reload";
type VersionCompatibility = "same" | "running-newer";
type DaemonLaunchSource = "env" | "path" | "packaged" | "native";
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const STARTUP_LOCK_TIMEOUT_MS = 15_000;

class DaemonHealthMismatchError extends Error {
  constructor(
    message: string,
    readonly mismatchKind: DaemonHealthMismatchKind,
    readonly metadata: Partial<DaemonMetadata> | null,
  ) {
    super(message);
  }
}

function packagedDaemonEntrypointPath(): string {
  const primaryCandidatePath = path.resolve(moduleDir, "../../dist/bin/fff-routerd.js");
  const candidatePaths = [
    primaryCandidatePath,
    path.resolve(moduleDir, "../../bin/fff-routerd.js"),
  ];

  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return primaryCandidatePath;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function resolveDaemonLaunchCommand(
  env: NodeJS.ProcessEnv = process.env,
  deps: {
    preferPackaged?: boolean;
    resolveExecutableOnPath?: (command: string) => string | null;
    nativeRuntime?: boolean;
  } = {},
): { command: string; args: string[]; source: DaemonLaunchSource } {
  if (env.FFF_ROUTER_DAEMON_BIN) {
    return { command: env.FFF_ROUTER_DAEMON_BIN, args: [], source: "env" };
  }

  if (env.FFF_ROUTER_DAEMON_ENTRYPOINT) {
    return { command: process.execPath, args: [env.FFF_ROUTER_DAEMON_ENTRYPOINT], source: "env" };
  }

  if (
    deps.nativeRuntime ??
    Boolean((process.versions as Record<string, string | undefined>).perry)
  ) {
    return { command: process.execPath, args: ["__daemon"], source: "native" };
  }

  if (!deps.preferPackaged && env.FFF_ROUTER_DAEMON_ALLOW_PATH === "1") {
    const resolvedCommand = (
      deps.resolveExecutableOnPath ?? ((command) => defaultResolveExecutableOnPath(command, env))
    )("fff-routerd");
    if (resolvedCommand) {
      return { command: resolvedCommand, args: [], source: "path" };
    }
  }

  return {
    command: process.execPath,
    args: [packagedDaemonEntrypointPath()],
    source: "packaged",
  };
}

async function fetchHealthMetadata(env?: NodeJS.ProcessEnv): Promise<Partial<DaemonMetadata>> {
  const config = getDaemonConfig({ env });
  const response = await requestJson(`${getDaemonOriginFromConfig(config)}/health`, {
    headers: bearerHeaders(await readDaemonAuthToken(env)),
  });
  if (!response.ok) {
    throw new Error(`daemon healthcheck failed with status ${response.status}`);
  }

  const payload = response.payload as {
    ok?: boolean;
    metadata?: Partial<DaemonMetadata> | null;
  };
  if (!payload.ok || !payload.metadata) {
    throw new Error("daemon healthcheck returned an invalid payload");
  }

  return payload.metadata;
}

function parsePackageVersion(version: unknown): [number, number, number] | null {
  if (typeof version !== "string") {
    return null;
  }
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[.-].*)?$/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function comparePackageVersions(left: unknown, right: unknown): number | null {
  const leftParts = parsePackageVersion(left);
  const rightParts = parsePackageVersion(right);
  if (!leftParts || !rightParts) {
    return null;
  }

  for (const index of [0, 1, 2] as const) {
    if (leftParts[index] < rightParts[index]) {
      return -1;
    }
    if (leftParts[index] > rightParts[index]) {
      return 1;
    }
  }
  return 0;
}

function endpointMatchesConfig(
  metadata: Partial<DaemonMetadata>,
  config = getDaemonConfig(),
): boolean {
  return (
    metadata.host === config.host &&
    metadata.port === config.port &&
    metadata.mcpPath === config.mcpPath
  );
}

function isNewerCompatibleDaemon(
  metadata: Partial<DaemonMetadata> | null | undefined,
  env?: NodeJS.ProcessEnv,
): boolean {
  if (!metadata) {
    return false;
  }
  return (
    comparePackageVersions(metadata.packageVersion, PACKAGE_VERSION) === 1 &&
    metadata.protocolVersion === DAEMON_PROTOCOL_VERSION &&
    endpointMatchesConfig(metadata, getDaemonConfig({ env }))
  );
}

function assertCompatibleProtocolAndVersion(
  metadata: Partial<DaemonMetadata>,
  env?: NodeJS.ProcessEnv,
): VersionCompatibility {
  const versionComparison = comparePackageVersions(metadata.packageVersion, PACKAGE_VERSION);
  const runningDaemonIsNewer = versionComparison === 1;

  if (metadata.protocolVersion !== DAEMON_PROTOCOL_VERSION) {
    if (runningDaemonIsNewer) {
      throw new Error(
        `newer incompatible fff-routerd is already running: expected protocol ${DAEMON_PROTOCOL_VERSION}, got ${metadata.protocolVersion}. Update this client or stop fff-routerd manually.`,
      );
    }
    throw new DaemonHealthMismatchError(
      `daemon protocol mismatch: expected ${DAEMON_PROTOCOL_VERSION}, got ${metadata.protocolVersion}`,
      "protocol",
      metadata,
    );
  }

  if (versionComparison === 1) {
    if (!endpointMatchesConfig(metadata, getDaemonConfig({ env }))) {
      throw new Error(
        "newer fff-routerd is already running at this endpoint, but its metadata does not match the expected daemon endpoint. Stop fff-routerd manually before starting this client.",
      );
    }
    return "running-newer";
  }

  if (versionComparison !== 0 || metadata.packageVersion !== PACKAGE_VERSION) {
    throw new DaemonHealthMismatchError(
      `daemon package version mismatch: expected ${PACKAGE_VERSION}, got ${metadata.packageVersion}`,
      "version",
      metadata,
    );
  }

  return "same";
}

export async function checkDaemonBaseHealth(env?: NodeJS.ProcessEnv): Promise<void> {
  const metadata = await fetchHealthMetadata(env);
  if (assertCompatibleProtocolAndVersion(metadata, env) === "running-newer") {
    return;
  }

  const expectedServerFingerprint = getDaemonServerFingerprint({ env });
  if (metadata.serverFingerprint !== expectedServerFingerprint) {
    throw new DaemonHealthMismatchError(
      "daemon server config mismatch; restart required",
      "server",
      metadata,
    );
  }
}

export async function checkDaemonHealth(env?: NodeJS.ProcessEnv): Promise<void> {
  const metadata = await fetchHealthMetadata(env);
  if (assertCompatibleProtocolAndVersion(metadata, env) === "running-newer") {
    return;
  }

  const expectedServerFingerprint = getDaemonServerFingerprint({ env });
  if (metadata.serverFingerprint !== expectedServerFingerprint) {
    throw new DaemonHealthMismatchError(
      "daemon server config mismatch; restart required",
      "server",
      metadata,
    );
  }

  const expectedReloadFingerprint = getDaemonReloadFingerprint({ env });
  if (metadata.reloadFingerprint !== expectedReloadFingerprint) {
    throw new DaemonHealthMismatchError(
      "daemon reload config mismatch; send SIGHUP to reload configuration",
      "reload",
      metadata,
    );
  }
}

export function shouldReclaimStartupLock(args: {
  contents: string;
  mtimeMs: number;
  now?: number;
  isAlive?: (pid: number) => boolean;
}): boolean {
  const now = args.now ?? Date.now();
  let pid = 0;
  let createdAt = args.mtimeMs;
  try {
    const parsed = JSON.parse(args.contents) as unknown;
    if (typeof parsed === "number") {
      pid = parsed;
    } else if (parsed && typeof parsed === "object") {
      const record = parsed as { pid?: unknown; createdAt?: unknown };
      pid = typeof record.pid === "number" ? record.pid : 0;
      createdAt = typeof record.createdAt === "number" ? record.createdAt : args.mtimeMs;
    }
  } catch {
    // v0 locks contained only a PID. Their mtime is the lease timestamp.
    pid = Number.parseInt(args.contents.trim(), 10);
  }

  if (!Number.isFinite(pid) || pid <= 0) {
    return true;
  }
  if (!Number.isFinite(createdAt) || now - createdAt >= STARTUP_LOCK_TIMEOUT_MS) {
    return true;
  }
  return !(args.isAlive ?? isProcessAlive)(pid);
}

async function withStartupLock<T>(callback: () => Promise<T>, env?: NodeJS.ProcessEnv): Promise<T> {
  const paths = getDaemonPaths({ env });
  mkdirSync(paths.dir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    chmodSync(paths.dir, 0o700);
  }
  const startedAt = Date.now();

  while (true) {
    let lockFd: number;
    try {
      lockFd = openSync(paths.lockPath, "wx", 0o600);
      writeFileSync(lockFd, JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
    } catch (error) {
      if (typeof error !== "object" || !error || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }

      let contents = "";
      let lockStat: ReturnType<typeof statSync> | null = null;
      try {
        contents = readFileSync(paths.lockPath, "utf8");
        lockStat = statSync(paths.lockPath);
      } catch {
        // The lock may have disappeared between openSync and inspection.
      }
      if (
        !lockStat ||
        shouldReclaimStartupLock({ contents, mtimeMs: lockStat.mtimeMs, now: Date.now() })
      ) {
        rmSync(paths.lockPath, { force: true });
        continue;
      }

      if (Date.now() - startedAt > STARTUP_LOCK_TIMEOUT_MS) {
        throw new Error("timed out while waiting for the daemon startup lock");
      }

      await sleep(50);
      continue;
    }

    try {
      return await callback();
    } finally {
      closeSync(lockFd);
      rmSync(paths.lockPath, { force: true });
    }
  }
}

function isRecoverableHealthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = error.message.toLowerCase();
  return (
    code === "ECONNREFUSED" ||
    code === "ConnectionRefused" ||
    message.includes("fetch") ||
    message.includes("econnrefused") ||
    message.includes("connectionrefused") ||
    message.includes("unable to connect") ||
    message.includes("healthcheck failed")
  );
}

function mismatchKind(error: unknown): DaemonHealthMismatchKind | null {
  if (error instanceof DaemonHealthMismatchError) {
    return error.mismatchKind;
  }

  if (
    typeof error === "object" &&
    error &&
    "mismatchKind" in error &&
    (error.mismatchKind === "protocol" ||
      error.mismatchKind === "version" ||
      error.mismatchKind === "server" ||
      error.mismatchKind === "reload")
  ) {
    return error.mismatchKind;
  }

  return null;
}

function mismatchPid(error: unknown): number | null {
  if (error instanceof DaemonHealthMismatchError && typeof error.metadata?.pid === "number") {
    return error.metadata.pid;
  }

  if (
    typeof error === "object" &&
    error &&
    "metadata" in error &&
    typeof error.metadata === "object" &&
    error.metadata &&
    "pid" in error.metadata &&
    typeof error.metadata.pid === "number"
  ) {
    return error.metadata.pid;
  }

  return null;
}

function mismatchMetadata(error: unknown): Partial<DaemonMetadata> | null {
  if (error instanceof DaemonHealthMismatchError) {
    return error.metadata;
  }

  if (
    typeof error === "object" &&
    error &&
    "metadata" in error &&
    typeof error.metadata === "object" &&
    error.metadata
  ) {
    return error.metadata as Partial<DaemonMetadata>;
  }

  return null;
}

function shouldPreserveNewerDaemonMismatch(error: unknown, env?: NodeJS.ProcessEnv): boolean {
  return mismatchKind(error) !== null && isNewerCompatibleDaemon(mismatchMetadata(error), env);
}

function spawnDaemon(
  env?: NodeJS.ProcessEnv,
  options?: { preferPackaged?: boolean },
): { unref: () => void; source: DaemonLaunchSource } {
  const launchCommand = resolveDaemonLaunchCommand(env ?? process.env, options);
  const paths = getDaemonPaths({ env });
  mkdirSync(paths.dir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    chmodSync(paths.dir, 0o700);
  }
  const stdoutFd = openSync(paths.stdoutLogPath, "a", 0o600);
  const stderrFd = openSync(paths.stderrLogPath, "a", 0o600);
  let child: ReturnType<typeof spawnChildProcess>;
  try {
    child = spawnChildProcess(launchCommand.command, launchCommand.args, {
      env: env ?? process.env,
      detached: true,
      stdio: ["ignore", stdoutFd, stderrFd],
    });
  } finally {
    closeSync(stdoutFd);
    closeSync(stderrFd);
  }
  child.once("error", (error) => {
    try {
      appendFileSync(paths.stderrLogPath, `fff-routerd spawn failed: ${error.message}\n`, {
        mode: 0o600,
      });
    } catch {
      // A logging failure cannot make the caller retain the detached child.
    }
  });
  return {
    unref: () => child.unref(),
    source: launchCommand.source,
  };
}

async function readLogTail(pathValue: string, maxBytes = 4096): Promise<string> {
  let fd: number | undefined;
  try {
    fd = openSync(pathValue, "r");
    const details = fstatSync(fd);
    const length = Math.min(details.size, maxBytes);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, Math.max(0, details.size - length));
    return buffer.toString("utf8").trimEnd();
  } catch {
    return "";
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Ignore concurrent log rotation/closure.
      }
    }
  }
}

export async function formatDaemonStartupError(
  error: unknown,
  env?: NodeJS.ProcessEnv,
): Promise<Error> {
  const paths = getDaemonPaths({ env });
  const message = error instanceof Error ? error.message : String(error);
  const stderrTail = await readLogTail(paths.stderrLogPath);
  const details = [
    message,
    `daemon stdout log: ${paths.stdoutLogPath}`,
    `daemon stderr log: ${paths.stderrLogPath}`,
    ...(stderrTail ? [`recent daemon stderr:\n${stderrTail}`] : []),
  ];
  return new Error(details.join("\n"));
}

async function waitForDaemonReady(env?: NodeJS.ProcessEnv): Promise<void> {
  let lastError: unknown;
  for (const delay of [50, 100, 200, 400, 800, 1200]) {
    const metadata = await readRunningDaemonMetadata(env);
    if (!metadata || !isProcessAlive(metadata.pid)) {
      lastError = new Error("daemon metadata is not ready");
      await sleep(delay);
      continue;
    }
    try {
      await checkDaemonHealth(env);
      return;
    } catch (error) {
      lastError = error;
      await sleep(delay);
    }
  }

  throw await formatDaemonStartupError(lastError, env);
}

export async function readDaemonLogs(env?: NodeJS.ProcessEnv): Promise<{
  stdoutPath: string;
  stderrPath: string;
  stdout: string;
  stderr: string;
}> {
  const paths = getDaemonPaths({ env });
  return {
    stdoutPath: paths.stdoutLogPath,
    stderrPath: paths.stderrLogPath,
    stdout: await readLogTail(paths.stdoutLogPath),
    stderr: await readLogTail(paths.stderrLogPath),
  };
}

async function signalProcess(pid: number, signal: NodeJS.Signals): Promise<void> {
  if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) {
    return;
  }

  try {
    process.kill(pid, signal);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ESRCH") {
      return;
    }
    throw error;
  }
}

async function terminateProcess(pid: number): Promise<void> {
  if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) {
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }

  for (const delay of [25, 50, 100, 200, 400, 800]) {
    if (!isProcessAlive(pid)) {
      return;
    }
    await sleep(delay);
  }

  if (isProcessAlive(pid)) {
    process.kill(pid, "SIGKILL");
  }
}

export async function ensureDaemonRunningWithDeps(
  env: NodeJS.ProcessEnv | undefined,
  deps: {
    checkDaemonHealth: (env?: NodeJS.ProcessEnv) => Promise<void>;
    checkDaemonBaseHealth?: (env?: NodeJS.ProcessEnv) => Promise<void>;
    readRunningDaemonMetadata: (env?: NodeJS.ProcessEnv) => Promise<DaemonMetadata | null>;
    signalProcess: (pid: number, signal: NodeJS.Signals) => Promise<void>;
    terminateProcess: (pid: number) => Promise<void>;
    spawnDaemon: (
      env?: NodeJS.ProcessEnv,
      options?: { preferPackaged?: boolean },
    ) => { unref: () => void; source: DaemonLaunchSource };
    waitForDaemonReady: (env?: NodeJS.ProcessEnv) => Promise<void>;
    withStartupLock: (callback: () => Promise<void>, env?: NodeJS.ProcessEnv) => Promise<void>;
    isProcessAlive?: (pid: number) => boolean;
  },
): Promise<void> {
  const processIsAlive = deps.isProcessAlive ?? isProcessAlive;
  const initialMetadata = await deps.readRunningDaemonMetadata(env);
  if (initialMetadata && processIsAlive(initialMetadata.pid)) {
    try {
      await deps.checkDaemonHealth(env);
      return;
    } catch (error) {
      if (shouldPreserveNewerDaemonMismatch(error, env)) {
        return;
      }
      if (!isRecoverableHealthError(error) && mismatchKind(error) === null) {
        throw error;
      }
    }
  }

  await deps.withStartupLock(async () => {
    const lockedMetadata = await deps.readRunningDaemonMetadata(env);
    if (lockedMetadata && processIsAlive(lockedMetadata.pid)) {
      try {
        await deps.checkDaemonHealth(env);
        return;
      } catch (error) {
        if (shouldPreserveNewerDaemonMismatch(error, env)) {
          return;
        }
        const pid = mismatchPid(error);

        if (mismatchKind(error) === "reload") {
          if (pid) {
            try {
              await deps.signalProcess(pid, "SIGHUP");
              await deps.waitForDaemonReady(env);
              return;
            } catch {
              // Fall through to restart/spawn when reload signaling or readiness fails.
            }
          }
        }

        if (
          mismatchKind(error) === "protocol" ||
          mismatchKind(error) === "version" ||
          mismatchKind(error) === "server" ||
          mismatchKind(error) === "reload"
        ) {
          if (pid) {
            await deps.terminateProcess(pid);
          }
        } else if (!isRecoverableHealthError(error)) {
          throw error;
        }
      }
    }

    let child = deps.spawnDaemon(env);
    try {
      try {
        await deps.waitForDaemonReady(env);
      } catch (error) {
        if (shouldPreserveNewerDaemonMismatch(error, env)) {
          return;
        }
        if (
          child.source === "path" &&
          (mismatchKind(error) === "protocol" || mismatchKind(error) === "version")
        ) {
          const spawnedPid =
            mismatchPid(error) ?? (await deps.readRunningDaemonMetadata(env))?.pid ?? null;
          if (spawnedPid) {
            await deps.terminateProcess(spawnedPid);
          }
          child = deps.spawnDaemon(env, { preferPackaged: true });
          await deps.waitForDaemonReady(env);
        } else {
          throw error;
        }
      }
    } finally {
      child.unref();
    }
  }, env);
}

export async function ensureDaemonRunning(env?: NodeJS.ProcessEnv): Promise<void> {
  await ensureDaemonRunningWithDeps(env, {
    checkDaemonHealth,
    checkDaemonBaseHealth,
    readRunningDaemonMetadata,
    signalProcess,
    terminateProcess,
    spawnDaemon,
    waitForDaemonReady,
    withStartupLock,
  });
}

export async function readRunningDaemonMetadata(env?: NodeJS.ProcessEnv) {
  const paths = getDaemonPaths({ env });
  return await readDaemonMetadata(paths.metadataPath);
}
