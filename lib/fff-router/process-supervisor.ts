import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptionsWithoutStdio,
} from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { WorkerResourceUsage, WorkerSupervisionTelemetry } from "./types";

const IS_PERRY = typeof (process.versions as Record<string, string | undefined>).perry === "string";

export type SupervisedProcessExit = {
  code: number | null;
  signal: NodeJS.Signals | null;
  reason?: string;
};

export type ProcessSupervisorOptions = {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  sampleIntervalMs: number;
  maxRssBytes?: number;
  maxRssSamples?: number;
  shutdownGraceMs: number;
  killGraceMs: number;
  maxStderrBytes?: number;
  sample?: (pid: number) => Promise<WorkerResourceUsage | null>;
  spawnProcess?: (
    command: string,
    args: readonly string[],
    options: SpawnOptionsWithoutStdio & { stdio: "pipe"; detached: boolean },
  ) => ChildProcessWithoutNullStreams;
};

function parseCpuTime(value: string): number | undefined {
  const dayParts = value.trim().split("-");
  const day = dayParts.length === 2 ? Number(dayParts[0]) : 0;
  const time = dayParts.at(-1)?.split(":").map(Number) ?? [];
  if (time.some((part) => !Number.isFinite(part))) return undefined;
  const [hours = 0, minutes = 0, seconds = 0] =
    time.length === 3 ? time : time.length === 2 ? [0, ...time] : [0, 0, time[0] ?? 0];
  return (((day * 24 + hours) * 60 + minutes) * 60 + seconds) * 1_000;
}

function stopDetachedProcess(pid: number | undefined): void {
  if (!pid) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, "SIGKILL");
  } catch {
    // The command already exited.
  }
}

export async function signalNativeProcessGroup(pid: number, signal: NodeJS.Signals): Promise<void> {
  const nonce = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const statusPath = path.join(os.tmpdir(), `.fff-router-signal.${nonce}.status`);
  const shell =
    'status_path="$1"; signal_name="$2"; process_group="$3"; kill "-$signal_name" "-$process_group" 2>/dev/null; code=$?; printf "%s\\n" "$code" >"$status_path"';
  const child = spawn(
    "/bin/sh",
    ["-c", shell, "fff-router-signal", statusPath, signal.replace(/^SIG/, ""), String(pid)],
    { detached: false, stdio: "ignore" },
  );
  const deadline = Date.now() + 2_000;
  try {
    while (!existsSync(statusPath)) {
      if (Date.now() >= deadline) {
        try {
          if (child.pid) process.kill(child.pid, "SIGKILL");
        } catch {
          // The short-lived signal helper already exited.
        }
        throw new Error(`timed out sending ${signal} to process group ${pid}`);
      }
      await wait(10);
    }
    const exitCode = Number(readFileSync(statusPath, "utf8").trim());
    if (exitCode !== 0 && isProcessAlive(pid)) {
      throw new Error(`failed to send ${signal} to process group ${pid}`);
    }
  } finally {
    rmSync(statusPath, { force: true });
  }
}

export async function terminateNativeProcessGroup(
  pid: number,
  shutdownGraceMs: number,
  killGraceMs: number,
): Promise<void> {
  await signalNativeProcessGroup(pid, "SIGTERM");
  const termDeadline = Date.now() + Math.max(0, shutdownGraceMs);
  while (isProcessAlive(pid) && Date.now() < termDeadline) await wait(10);

  // Always address the original group with SIGKILL after the grace period.
  // Its leader may have exited while a child remained in the same group.
  await signalNativeProcessGroup(pid, "SIGKILL");
  const killDeadline = Date.now() + Math.max(0, killGraceMs);
  while (isProcessAlive(pid) && Date.now() < killDeadline) await wait(10);
  if (isProcessAlive(pid)) {
    throw new Error(`failed to terminate supervised process group ${pid}`);
  }
}

async function runNativeCommandText(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<string> {
  const nonce = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const basePath = path.join(os.tmpdir(), `.fff-router-command.${nonce}`);
  const outputPath = `${basePath}.stdout`;
  const stderrPath = `${basePath}.stderr`;
  const statusPath = `${basePath}.status`;
  const shell =
    'status_path="$1"; output_path="$2"; stderr_path="$3"; shift 3; "$@" >"$output_path" 2>"$stderr_path"; code=$?; printf "%s\\n" "$code" >"$status_path"';
  const child = spawn(
    "/bin/sh",
    ["-c", shell, "fff-router-command", statusPath, outputPath, stderrPath, command, ...args],
    { detached: process.platform !== "win32", stdio: "ignore" },
  );
  child.unref();
  const deadline = Date.now() + timeoutMs;
  try {
    while (!existsSync(statusPath)) {
      if (Date.now() >= deadline) {
        stopDetachedProcess(child.pid);
        return "";
      }
      await wait(25);
    }
    const exitCode = Number(readFileSync(statusPath, "utf8").trim());
    return exitCode === 0 && existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
  } catch {
    return "";
  } finally {
    rmSync(outputPath, { force: true });
    rmSync(stderrPath, { force: true });
    rmSync(statusPath, { force: true });
  }
}

async function psOutput(): Promise<string> {
  const args = ["-axo", "pid=,ppid=,rss=,time="];
  if (IS_PERRY) {
    return await runNativeCommandText("ps", args, 2_000);
  }
  return await new Promise<string>((resolve, reject) => {
    execFile("ps", args, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  }).catch(() => "");
}

async function sampleWithPs(pid: number): Promise<WorkerResourceUsage | null> {
  const processes = new Map<number, { ppid: number; rssKiB: number; cpuTimeMs?: number }>();
  for (const line of (await psOutput()).split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
    if (!match) continue;
    const processPid = Number(match[1]);
    processes.set(processPid, {
      ppid: Number(match[2]),
      rssKiB: Number(match[3]),
      ...(parseCpuTime(match[4] ?? "") !== undefined
        ? { cpuTimeMs: parseCpuTime(match[4] ?? "") }
        : {}),
    });
  }
  if (!processes.has(pid)) return null;
  const pending = [pid];
  const visited = new Set<number>();
  let rssKiB = 0;
  let cpuTimeMs = 0;
  let measuredCpu = false;
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    const details = processes.get(current);
    if (!details) continue;
    visited.add(current);
    rssKiB += details.rssKiB;
    if (details.cpuTimeMs !== undefined) {
      cpuTimeMs += details.cpuTimeMs;
      measuredCpu = true;
    }
    for (const [candidate, candidateDetails] of processes) {
      if (candidateDetails.ppid === current) pending.push(candidate);
    }
  }
  return {
    sampledAt: Date.now(),
    rssBytes: rssKiB * 1_024,
    processCount: visited.size,
    ...(measuredCpu ? { cpuTimeMs } : {}),
  };
}

export function parseLinuxProcStatCpuTime(value: string): number | undefined {
  const commandEnd = value.lastIndexOf(")");
  if (commandEnd < 0) return undefined;
  const fields = value
    .slice(commandEnd + 1)
    .trim()
    .split(/\s+/);
  const userTicks = Number(fields[11]);
  const systemTicks = Number(fields[12]);
  if (!Number.isFinite(userTicks) || !Number.isFinite(systemTicks)) return undefined;
  // Linux exposes /proc CPU accounting in USER_HZ, whose userspace ABI is 100 ticks/second.
  return ((userTicks + systemTicks) * 1_000) / 100;
}

async function sampleLinuxProc(pid: number): Promise<WorkerResourceUsage | null> {
  const pending = [pid];
  const visited = new Set<number>();
  let rssKiB = 0;
  let threads = 0;
  let cpuTimeMs = 0;
  let measuredCpu = false;
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    try {
      const status = readFileSync(`/proc/${current}/status`, "utf8");
      const statPath = `/proc/${current}/stat`;
      const processStat = existsSync(statPath) ? readFileSync(statPath, "utf8") : "";
      const processRssKiB = Number(status.match(/^VmRSS:\s+(\d+)\s+kB$/m)?.[1]);
      const processThreads = Number(status.match(/^Threads:\s+(\d+)$/m)?.[1]);
      if (Number.isFinite(processRssKiB)) rssKiB += processRssKiB;
      if (Number.isFinite(processThreads)) threads += processThreads;
      const processCpuTimeMs = parseLinuxProcStatCpuTime(processStat);
      if (processCpuTimeMs !== undefined) {
        cpuTimeMs += processCpuTimeMs;
        measuredCpu = true;
      }
      const childrenPath = `/proc/${current}/task/${current}/children`;
      const children = existsSync(childrenPath) ? readFileSync(childrenPath, "utf8") : "";
      for (const child of children.trim().split(/\s+/)) {
        const childPid = Number(child);
        if (Number.isInteger(childPid) && childPid > 0) pending.push(childPid);
      }
    } catch {
      if (current === pid) return null;
    }
  }
  return {
    sampledAt: Date.now(),
    rssBytes: rssKiB * 1_024,
    processCount: visited.size,
    ...(measuredCpu ? { cpuTimeMs } : {}),
    ...(threads > 0 ? { threads } : {}),
  };
}

export async function sampleProcessResources(pid: number): Promise<WorkerResourceUsage | null> {
  return process.platform === "linux"
    ? ((await sampleLinuxProc(pid)) ?? (await sampleWithPs(pid)))
    : await sampleWithPs(pid);
}

function isMissingProcessError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ESRCH";
}

function isProcessAlive(pid: number): boolean {
  if (process.platform === "linux") {
    const statPath = `/proc/${pid}/stat`;
    if (!existsSync(statPath)) return false;
    try {
      const stat = readFileSync(statPath, "utf8");
      const commandEnd = stat.lastIndexOf(")");
      if (
        commandEnd >= 0 &&
        stat
          .slice(commandEnd + 1)
          .trimStart()
          .startsWith("Z ")
      )
        return false;
    } catch {
      return false;
    }
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

export class ProcessSupervisor {
  readonly child: ChildProcessWithoutNullStreams;
  readonly spawned: Promise<void>;
  readonly telemetry: WorkerSupervisionTelemetry = {
    resources: null,
    terminationReason: null,
  };
  private readonly exitPromise: Promise<SupervisedProcessExit>;
  private resolveExit!: (exit: SupervisedProcessExit) => void;
  private readonly closeHandlers = new Set<(exit: SupervisedProcessExit) => void>();
  private readonly resourceHandlers = new Set<() => void>();
  private readonly terminationHandlers = new Set<() => void>();
  private readonly sample: (pid: number) => Promise<WorkerResourceUsage | null>;
  private sampleTimer: ReturnType<typeof setTimeout> | null = null;
  private exitPollTimer: ReturnType<typeof setTimeout> | null = null;
  private sampling = false;
  private stderrTail = "";
  private overRssSamples = 0;
  private closePromise: Promise<void> | null = null;
  private exited = false;

  constructor(private readonly options: ProcessSupervisorOptions) {
    const detached = process.platform !== "win32";
    this.sample = options.sample ?? sampleProcessResources;
    this.exitPromise = new Promise((resolve) => {
      this.resolveExit = resolve;
    });
    const spawnProcess =
      options.spawnProcess ?? ((command, args, spawnOptions) => spawn(command, args, spawnOptions));
    this.child = spawnProcess(options.command, options.args, {
      cwd: options.cwd,
      env: options.env,
      detached,
      stdio: "pipe",
      windowsHide: true,
    });
    this.spawned = IS_PERRY
      ? this.child.pid
        ? Promise.resolve()
        : Promise.reject(new Error(`failed to spawn ${options.command}`))
      : new Promise<void>((resolve, reject) => {
          this.child.once("spawn", resolve);
          this.child.once("error", reject);
        });
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      this.stderrTail = `${this.stderrTail}${chunk}`.slice(-(options.maxStderrBytes ?? 64 * 1_024));
    });
    this.child.once("exit", (code, signal) => this.recordExit({ code, signal }));
    this.child.once("error", (error) => {
      if (!this.exited) {
        this.recordExit({ code: null, signal: null, reason: `spawn error: ${error.message}` });
      }
    });
    if (IS_PERRY) this.scheduleExitPoll();
    if (options.sampleIntervalMs > 0) this.scheduleSample();
  }

  get pid(): number | null {
    return this.child.pid ?? null;
  }

  getStderrTail(): string {
    return this.stderrTail.trimEnd();
  }

  getResourceUsage(): WorkerResourceUsage | null {
    return this.telemetry.resources ? { ...this.telemetry.resources } : null;
  }

  getTerminationReason(): string | undefined {
    return this.telemetry.terminationReason ?? undefined;
  }

  onClose(handler: (exit: SupervisedProcessExit) => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  onResourceSample(handler: () => void): () => void {
    if (this.telemetry.resources) handler();
    if (!this.exited) this.resourceHandlers.add(handler);
    return () => this.resourceHandlers.delete(handler);
  }

  onTermination(handler: () => void): () => void {
    if (this.telemetry.terminationReason) handler();
    if (!this.exited) this.terminationHandlers.add(handler);
    return () => this.terminationHandlers.delete(handler);
  }

  private selectTerminationReason(reason: string | undefined): void {
    if (!reason || this.telemetry.terminationReason) return;
    this.telemetry.terminationReason = reason;
    for (const handler of this.terminationHandlers) handler();
  }

  private scheduleExitPoll(): void {
    if (!IS_PERRY || this.exited || this.exitPollTimer) return;
    this.exitPollTimer = setTimeout(() => {
      this.exitPollTimer = null;
      const pid = this.pid;
      if (!this.exited && pid && !isProcessAlive(pid)) {
        this.recordExit({ code: null, signal: null });
      }
      this.scheduleExitPoll();
    }, 250);
  }

  private scheduleSample(): void {
    if (this.exited || this.options.sampleIntervalMs <= 0 || this.sampleTimer) return;
    this.sampleTimer = setTimeout(
      () => {
        this.sampleTimer = null;
        void this.sampleNow()
          .catch(() => null)
          .finally(() => this.scheduleSample());
      },
      Math.max(250, this.options.sampleIntervalMs),
    );
  }

  private recordExit(exit: SupervisedProcessExit): void {
    if (this.exited) return;
    this.exited = true;
    if (this.sampleTimer) clearTimeout(this.sampleTimer);
    this.sampleTimer = null;
    if (this.exitPollTimer) clearTimeout(this.exitPollTimer);
    this.exitPollTimer = null;
    this.selectTerminationReason(exit.reason);
    const resolvedExit: SupervisedProcessExit = {
      code: exit.code,
      signal: exit.signal,
      reason: this.telemetry.terminationReason ?? exit.reason,
    };
    this.resolveExit(resolvedExit);
    for (const handler of this.closeHandlers) handler(resolvedExit);
    this.closeHandlers.clear();
    this.resourceHandlers.clear();
    this.terminationHandlers.clear();
  }

  async sampleNow(): Promise<WorkerResourceUsage | null> {
    const pid = this.pid;
    if (!pid || this.exited || this.sampling) return this.telemetry.resources;
    this.sampling = true;
    try {
      const usage = await this.sample(pid);
      if (!usage) return this.telemetry.resources;
      this.telemetry.resources = usage;
      for (const handler of this.resourceHandlers) handler();
      const maxRssBytes = this.options.maxRssBytes;
      if (maxRssBytes && usage.rssBytes > maxRssBytes) {
        this.overRssSamples += 1;
        if (this.overRssSamples >= (this.options.maxRssSamples ?? 2)) {
          void this.terminate(
            `worker RSS ${usage.rssBytes} exceeded ${maxRssBytes} bytes for ${this.overRssSamples} samples`,
          );
        }
      } else {
        this.overRssSamples = 0;
      }
      return usage;
    } finally {
      this.sampling = false;
    }
  }

  private async signal(signal: NodeJS.Signals): Promise<void> {
    const pid = this.pid;
    if (!pid || this.exited) return;
    if (IS_PERRY && process.platform !== "win32") {
      await signalNativeProcessGroup(pid, signal);
      return;
    }
    try {
      if (process.platform !== "win32") process.kill(-pid, signal);
      else this.child.kill(signal);
    } catch (error) {
      if (!isMissingProcessError(error)) throw error;
    }
  }

  private async exitedWithin(timeoutMs: number): Promise<boolean> {
    if (this.exited) return true;
    return await Promise.race([
      this.exitPromise.then(() => true),
      wait(timeoutMs).then(() => this.exited),
    ]);
  }

  async terminate(reason = "supervisor shutdown"): Promise<void> {
    if (this.closePromise) return await this.closePromise;
    this.selectTerminationReason(reason);
    this.closePromise = (async () => {
      const pid = this.pid;
      if (IS_PERRY && process.platform !== "win32" && pid) {
        // Perry may emit a synthetic child "exit" after stdin.end() while the
        // OS process tree is still alive. Terminate and verify the process
        // group directly rather than trusting that event.
        await terminateNativeProcessGroup(
          pid,
          this.options.shutdownGraceMs,
          this.options.killGraceMs,
        );
        if (!this.exited) this.recordExit({ code: null, signal: "SIGKILL" });
        return;
      }
      if (this.exited) return;
      this.child.stdin.end();
      if (await this.exitedWithin(this.options.shutdownGraceMs)) return;
      await this.signal("SIGTERM");
      if (await this.exitedWithin(this.options.killGraceMs)) return;
      await this.signal("SIGKILL");
      if (!(await this.exitedWithin(this.options.killGraceMs))) {
        throw new Error(`failed to terminate supervised process ${this.pid ?? "unknown"}`);
      }
    })();
    return await this.closePromise;
  }

  async close(): Promise<void> {
    await this.terminate("supervisor shutdown");
  }

  async waitForExit(): Promise<SupervisedProcessExit> {
    return await this.exitPromise;
  }
}
