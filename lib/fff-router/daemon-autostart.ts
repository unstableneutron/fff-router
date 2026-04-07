import { mkdir, open, readFile, rm } from "node:fs/promises";
import { spawn as spawnChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  DAEMON_PROTOCOL_VERSION,
  getDaemonConfig,
  getDaemonConfigFingerprint,
  getDaemonPaths,
} from "./daemon-config";
import { readDaemonMetadata } from "./http-daemon";

class DaemonHealthMismatchError extends Error {
  constructor(
    message: string,
    readonly metadata: {
      pid?: number;
      protocolVersion?: string;
      configFingerprint?: string;
    } | null,
  ) {
    super(message);
  }
}

function daemonEntrypointPath(): string {
  return fileURLToPath(new URL("../../bin/fff-routerd.ts", import.meta.url));
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

export async function checkDaemonHealth(env?: NodeJS.ProcessEnv): Promise<void> {
  const config = getDaemonConfig({ env });
  const response = await fetch(new URL(`/health`, `http://${config.host}:${config.port}`));
  if (!response.ok) {
    throw new Error(`daemon healthcheck failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok?: boolean;
    metadata?: { protocolVersion?: string; configFingerprint?: string } | null;
  };
  if (!payload.ok || !payload.metadata) {
    throw new Error("daemon healthcheck returned an invalid payload");
  }

  if (payload.metadata.protocolVersion !== DAEMON_PROTOCOL_VERSION) {
    throw new DaemonHealthMismatchError(
      `daemon protocol mismatch: expected ${DAEMON_PROTOCOL_VERSION}, got ${payload.metadata.protocolVersion}`,
      payload.metadata,
    );
  }

  const expectedFingerprint = getDaemonConfigFingerprint({ env });
  if (payload.metadata.configFingerprint !== expectedFingerprint) {
    throw new DaemonHealthMismatchError(
      "daemon config mismatch; restart the daemon with the current configuration",
      payload.metadata,
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

function isReplaceableHealthMismatch(error: unknown): boolean {
  return error instanceof Error && /config mismatch/i.test(error.message);
}

function mismatchPid(error: unknown): number | null {
  if (error instanceof DaemonHealthMismatchError && typeof error.metadata?.pid === "number") {
    return error.metadata.pid;
  }
  return null;
}

function spawnDaemon(env?: NodeJS.ProcessEnv) {
  const child = spawnChildProcess(process.execPath, [daemonEntrypointPath()], {
    env: env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.destroy();
  child.stderr?.destroy();
  return child;
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
    readRunningDaemonMetadata: (env?: NodeJS.ProcessEnv) => Promise<{ pid: number } | null>;
    terminateProcess: (pid: number) => Promise<void>;
    spawnDaemon: (env?: NodeJS.ProcessEnv) => { unref: () => void };
    waitForDaemonReady: (env?: NodeJS.ProcessEnv) => Promise<void>;
    withStartupLock: (callback: () => Promise<void>, env?: NodeJS.ProcessEnv) => Promise<void>;
  },
): Promise<void> {
  getDaemonConfigFingerprint({ env });

  try {
    await deps.checkDaemonHealth(env);
    return;
  } catch (error) {
    if (!isRecoverableHealthError(error) && !isReplaceableHealthMismatch(error)) {
      throw error;
    }

    if (isReplaceableHealthMismatch(error)) {
      const pid = mismatchPid(error) ?? (await deps.readRunningDaemonMetadata(env))?.pid ?? null;
      if (pid) {
        await deps.terminateProcess(pid);
      }
    }
  }

  await deps.withStartupLock(async () => {
    try {
      await deps.checkDaemonHealth(env);
      return;
    } catch (error) {
      if (isReplaceableHealthMismatch(error)) {
        const pid = mismatchPid(error) ?? (await deps.readRunningDaemonMetadata(env))?.pid ?? null;
        if (pid) {
          await deps.terminateProcess(pid);
        }
      } else if (!isRecoverableHealthError(error)) {
        throw error;
      }
    }

    const child = deps.spawnDaemon(env);
    try {
      await deps.waitForDaemonReady(env);
    } finally {
      child.unref();
    }
  }, env);
}

export async function ensureDaemonRunning(env?: NodeJS.ProcessEnv): Promise<void> {
  await ensureDaemonRunningWithDeps(env, {
    checkDaemonHealth,
    readRunningDaemonMetadata,
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
