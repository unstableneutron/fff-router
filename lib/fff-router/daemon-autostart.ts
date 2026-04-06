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
    throw new Error(
      `daemon protocol mismatch: expected ${DAEMON_PROTOCOL_VERSION}, got ${payload.metadata.protocolVersion}`,
    );
  }

  const expectedFingerprint = getDaemonConfigFingerprint({ env });
  if (payload.metadata.configFingerprint !== expectedFingerprint) {
    throw new Error("daemon config mismatch; restart the daemon with the current configuration");
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

export async function ensureDaemonRunning(env?: NodeJS.ProcessEnv): Promise<void> {
  try {
    await checkDaemonHealth(env);
    return;
  } catch (error) {
    if (!isRecoverableHealthError(error)) {
      throw error;
    }
  }

  await withStartupLock(async () => {
    try {
      await checkDaemonHealth(env);
      return;
    } catch (error) {
      if (!isRecoverableHealthError(error)) {
        throw error;
      }
    }

    const child = spawnDaemon(env);
    try {
      await waitForDaemonReady(env);
    } finally {
      child.unref();
    }
  }, env);
}

export async function readRunningDaemonMetadata(env?: NodeJS.ProcessEnv) {
  const paths = getDaemonPaths({ env });
  return await readDaemonMetadata(paths.metadataPath);
}
