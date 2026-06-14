import { spawn as spawnChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
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
import { resolveExecutableOnPath as defaultResolveExecutableOnPath } from "./tool-resolution";

type DaemonHealthMismatchKind = "protocol" | "version" | "server" | "reload";
type VersionCompatibility = "same" | "running-newer";

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
  const primaryCandidatePath = path.resolve(import.meta.dirname, "../../dist/bin/fff-routerd.js");
  const candidatePaths = [
    primaryCandidatePath,
    path.resolve(import.meta.dirname, "../../bin/fff-routerd.js"),
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
  } = {},
): { command: string; args: string[]; source: "env" | "path" | "packaged" } {
  if (env.FFF_ROUTER_DAEMON_BIN) {
    return { command: env.FFF_ROUTER_DAEMON_BIN, args: [], source: "env" };
  }

  if (env.FFF_ROUTER_DAEMON_ENTRYPOINT) {
    return { command: process.execPath, args: [env.FFF_ROUTER_DAEMON_ENTRYPOINT], source: "env" };
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
  const response = await fetch(new URL(`/health`, getDaemonOriginFromConfig(config)));
  if (!response.ok) {
    throw new Error(`daemon healthcheck failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
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

async function withStartupLock<T>(callback: () => Promise<T>, env?: NodeJS.ProcessEnv): Promise<T> {
  const paths = getDaemonPaths({ env });
  await mkdir(paths.dir, { recursive: true });
  const startedAt = Date.now();

  while (true) {
    try {
      const handle = await open(paths.lockPath, "wx");
      await handle.writeFile(String(process.pid));
      try {
        return await callback();
      } finally {
        await handle.close().catch(() => {});
        await rm(paths.lockPath, { force: true }).catch(() => {});
      }
    } catch (error) {
      if (typeof error !== "object" || !error || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }

      const lockOwner = Number.parseInt(
        (await readFile(paths.lockPath, "utf8").catch(() => "0")).trim(),
        10,
      );
      if (!Number.isFinite(lockOwner) || lockOwner <= 0 || !isProcessAlive(lockOwner)) {
        await rm(paths.lockPath, { force: true }).catch(() => {});
        continue;
      }

      if (Date.now() - startedAt > 15_000) {
        throw new Error("timed out while waiting for the daemon startup lock");
      }

      await sleep(50);
    }
  }
}

function isRecoverableHealthError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return (
    code === "ECONNREFUSED" ||
    code === "ConnectionRefused" ||
    error.message.includes("fetch") ||
    error.message.includes("ECONNREFUSED") ||
    error.message.includes("ConnectionRefused") ||
    error.message.includes("Unable to connect") ||
    error.message.includes("healthcheck failed")
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
): { unref: () => void; source: "env" | "path" | "packaged" } {
  const launchCommand = resolveDaemonLaunchCommand(env ?? process.env, options);
  const paths = getDaemonPaths({ env });
  mkdirSync(paths.dir, { recursive: true });
  const child = spawnChildProcess(launchCommand.command, launchCommand.args, {
    env: env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdoutLog = createWriteStream(paths.stdoutLogPath, { flags: "a" });
  const stderrLog = createWriteStream(paths.stderrLogPath, { flags: "a" });
  child.stdout?.pipe(stdoutLog);
  child.stderr?.pipe(stderrLog);
  child.once("error", (error) => {
    stderrLog.write(`fff-routerd spawn failed: ${error.message}\n`);
    stdoutLog.end();
    stderrLog.end();
  });
  child.once("close", () => {
    stdoutLog.end();
    stderrLog.end();
  });
  return {
    unref: () => child.unref(),
    source: launchCommand.source,
  };
}

async function readLogTail(pathValue: string, maxBytes = 4096): Promise<string> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(pathValue, "r");
    const stat = await handle.stat();
    const length = Math.min(stat.size, maxBytes);
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, Math.max(0, stat.size - length));
    return buffer.toString("utf8").trimEnd();
  } catch {
    return "";
  } finally {
    await handle?.close().catch(() => {});
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
    ) => { unref: () => void; source: "env" | "path" | "packaged" };
    waitForDaemonReady: (env?: NodeJS.ProcessEnv) => Promise<void>;
    withStartupLock: (callback: () => Promise<void>, env?: NodeJS.ProcessEnv) => Promise<void>;
  },
): Promise<void> {
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

  await deps.withStartupLock(async () => {
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
