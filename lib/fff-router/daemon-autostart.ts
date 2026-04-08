import { spawn as spawnChildProcess } from "node:child_process";
import { constants as fsConstants, accessSync, existsSync } from "node:fs";
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

type DaemonHealthMismatchKind = "protocol" | "version" | "server" | "reload";

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

function isExecutable(pathValue: string): boolean {
  try {
    accessSync(pathValue, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandExtensions(env: NodeJS.ProcessEnv): string[] {
  if (process.platform !== "win32") {
    return [""];
  }

  const pathExt = env.PATHEXT?.split(";").filter(Boolean);
  return pathExt && pathExt.length > 0 ? pathExt : [".EXE", ".CMD", ".BAT", ".COM"];
}

function defaultResolveExecutableOnPath(command: string, env: NodeJS.ProcessEnv): string | null {
  const pathValue = env.PATH || process.env.PATH || "";
  const directories = pathValue.split(path.delimiter).filter(Boolean);
  const extensions = commandExtensions(env);

  for (const directory of directories) {
    for (const extension of extensions) {
      const candidatePath =
        process.platform === "win32" && extension && !command.toUpperCase().endsWith(extension)
          ? path.join(directory, `${command}${extension}`)
          : path.join(directory, command);
      if (existsSync(candidatePath) && isExecutable(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return null;
}

export function resolveDaemonLaunchCommand(
  env: NodeJS.ProcessEnv = process.env,
  deps: {
    preferPackaged?: boolean;
    resolveExecutableOnPath?: (command: string) => string | null;
  } = {},
): { command: string; args: string[]; source: "path" | "packaged" } {
  if (!deps.preferPackaged) {
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

function assertMatchingProtocolAndVersion(metadata: Partial<DaemonMetadata>): void {
  if (metadata.protocolVersion !== DAEMON_PROTOCOL_VERSION) {
    throw new DaemonHealthMismatchError(
      `daemon protocol mismatch: expected ${DAEMON_PROTOCOL_VERSION}, got ${metadata.protocolVersion}`,
      "protocol",
      metadata,
    );
  }

  if (metadata.packageVersion !== PACKAGE_VERSION) {
    throw new DaemonHealthMismatchError(
      `daemon package version mismatch: expected ${PACKAGE_VERSION}, got ${metadata.packageVersion}`,
      "version",
      metadata,
    );
  }
}

export async function checkDaemonBaseHealth(env?: NodeJS.ProcessEnv): Promise<void> {
  const metadata = await fetchHealthMetadata(env);
  assertMatchingProtocolAndVersion(metadata);

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
  assertMatchingProtocolAndVersion(metadata);

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

function spawnDaemon(
  env?: NodeJS.ProcessEnv,
  options?: { preferPackaged?: boolean },
): { unref: () => void; source: "path" | "packaged" } {
  const launchCommand = resolveDaemonLaunchCommand(env ?? process.env, options);
  const child = spawnChildProcess(launchCommand.command, launchCommand.args, {
    env: env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.destroy();
  child.stderr?.destroy();
  return {
    unref: () => child.unref(),
    source: launchCommand.source,
  };
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

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
    ) => { unref: () => void; source: "path" | "packaged" };
    waitForDaemonReady: (env?: NodeJS.ProcessEnv) => Promise<void>;
    withStartupLock: (callback: () => Promise<void>, env?: NodeJS.ProcessEnv) => Promise<void>;
  },
): Promise<void> {
  try {
    await deps.checkDaemonHealth(env);
    return;
  } catch (error) {
    if (!isRecoverableHealthError(error) && mismatchKind(error) === null) {
      throw error;
    }
  }

  await deps.withStartupLock(async () => {
    try {
      await deps.checkDaemonHealth(env);
      return;
    } catch (error) {
      const pid = mismatchPid(error) ?? (await deps.readRunningDaemonMetadata(env))?.pid ?? null;

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

    const existingPid = (await deps.readRunningDaemonMetadata(env))?.pid ?? null;
    if (existingPid) {
      await deps.terminateProcess(existingPid);
    }

    let child = deps.spawnDaemon(env);
    try {
      try {
        await deps.waitForDaemonReady(env);
      } catch (error) {
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
