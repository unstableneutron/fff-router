// lib/fff-router/adapters/fff-mcp-stdio.ts
import path5 from "node:path";

// lib/fff-router/legacy-mcp-client.ts
import {
  closeSync,
  existsSync as existsSync2,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync as readFileSync2,
  readSync,
  renameSync,
  rmSync as rmSync2,
  statSync,
  writeFileSync
} from "node:fs";
import os2 from "node:os";
import path2 from "node:path";

// lib/fff-router/process-supervisor.ts
import {
  execFile,
  spawn
} from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
var IS_PERRY = typeof process.versions.perry === "string";
function parseCpuTime(value) {
  const dayParts = value.trim().split("-");
  const day = dayParts.length === 2 ? Number(dayParts[0]) : 0;
  const time = dayParts.at(-1)?.split(":").map(Number) ?? [];
  if (time.some((part) => !Number.isFinite(part))) return void 0;
  const [hours = 0, minutes = 0, seconds = 0] = time.length === 3 ? time : time.length === 2 ? [0, ...time] : [0, 0, time[0] ?? 0];
  return (((day * 24 + hours) * 60 + minutes) * 60 + seconds) * 1e3;
}
function stopDetachedProcess(pid) {
  if (!pid) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, "SIGKILL");
  } catch {
  }
}
async function signalNativeProcessGroup(pid, signal) {
  const nonce = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const statusPath = path.join(os.tmpdir(), `.fff-router-signal.${nonce}.status`);
  const shell = 'status_path="$1"; signal_name="$2"; process_group="$3"; kill "-$signal_name" "-$process_group" 2>/dev/null; code=$?; printf "%s\\n" "$code" >"$status_path"';
  const child = spawn(
    "/bin/sh",
    ["-c", shell, "fff-router-signal", statusPath, signal.replace(/^SIG/, ""), String(pid)],
    { detached: false, stdio: "ignore" }
  );
  const deadline = Date.now() + 2e3;
  try {
    while (!existsSync(statusPath)) {
      if (Date.now() >= deadline) {
        try {
          if (child.pid) process.kill(child.pid, "SIGKILL");
        } catch {
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
async function terminateNativeProcessGroup(pid, shutdownGraceMs, killGraceMs) {
  await signalNativeProcessGroup(pid, "SIGTERM");
  const termDeadline = Date.now() + Math.max(0, shutdownGraceMs);
  while (isProcessAlive(pid) && Date.now() < termDeadline) await wait(10);
  await signalNativeProcessGroup(pid, "SIGKILL");
  const killDeadline = Date.now() + Math.max(0, killGraceMs);
  while (isProcessAlive(pid) && Date.now() < killDeadline) await wait(10);
  if (isProcessAlive(pid)) {
    throw new Error(`failed to terminate supervised process group ${pid}`);
  }
}
async function runNativeCommandText(command, args, timeoutMs) {
  const nonce = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const basePath = path.join(os.tmpdir(), `.fff-router-command.${nonce}`);
  const outputPath = `${basePath}.stdout`;
  const stderrPath = `${basePath}.stderr`;
  const statusPath = `${basePath}.status`;
  const shell = 'status_path="$1"; output_path="$2"; stderr_path="$3"; shift 3; "$@" >"$output_path" 2>"$stderr_path"; code=$?; printf "%s\\n" "$code" >"$status_path"';
  const child = spawn(
    "/bin/sh",
    ["-c", shell, "fff-router-command", statusPath, outputPath, stderrPath, command, ...args],
    { detached: process.platform !== "win32", stdio: "ignore" }
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
async function psOutput() {
  const args = ["-axo", "pid=,ppid=,rss=,time="];
  if (IS_PERRY) {
    return await runNativeCommandText("ps", args, 2e3);
  }
  return await new Promise((resolve, reject) => {
    execFile("ps", args, (error2, stdout) => {
      if (error2) reject(error2);
      else resolve(stdout);
    });
  }).catch(() => "");
}
async function sampleWithPs(pid) {
  const processes = /* @__PURE__ */ new Map();
  for (const line of (await psOutput()).split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
    if (!match) continue;
    const processPid = Number(match[1]);
    processes.set(processPid, {
      ppid: Number(match[2]),
      rssKiB: Number(match[3]),
      ...parseCpuTime(match[4] ?? "") !== void 0 ? { cpuTimeMs: parseCpuTime(match[4] ?? "") } : {}
    });
  }
  if (!processes.has(pid)) return null;
  const pending = [pid];
  const visited = /* @__PURE__ */ new Set();
  let rssKiB = 0;
  let cpuTimeMs = 0;
  let measuredCpu = false;
  while (pending.length > 0) {
    const current = pending.pop();
    if (visited.has(current)) continue;
    const details = processes.get(current);
    if (!details) continue;
    visited.add(current);
    rssKiB += details.rssKiB;
    if (details.cpuTimeMs !== void 0) {
      cpuTimeMs += details.cpuTimeMs;
      measuredCpu = true;
    }
    for (const [candidate, candidateDetails] of processes) {
      if (candidateDetails.ppid === current) pending.push(candidate);
    }
  }
  return {
    sampledAt: Date.now(),
    rssBytes: rssKiB * 1024,
    processCount: visited.size,
    ...measuredCpu ? { cpuTimeMs } : {}
  };
}
function parseLinuxProcStatCpuTime(value) {
  const commandEnd = value.lastIndexOf(")");
  if (commandEnd < 0) return void 0;
  const fields = value.slice(commandEnd + 1).trim().split(/\s+/);
  const userTicks = Number(fields[11]);
  const systemTicks = Number(fields[12]);
  if (!Number.isFinite(userTicks) || !Number.isFinite(systemTicks)) return void 0;
  return (userTicks + systemTicks) * 1e3 / 100;
}
async function sampleLinuxProc(pid) {
  const pending = [pid];
  const visited = /* @__PURE__ */ new Set();
  let rssKiB = 0;
  let threads = 0;
  let cpuTimeMs = 0;
  let measuredCpu = false;
  while (pending.length > 0) {
    const current = pending.pop();
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
      if (processCpuTimeMs !== void 0) {
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
    rssBytes: rssKiB * 1024,
    processCount: visited.size,
    ...measuredCpu ? { cpuTimeMs } : {},
    ...threads > 0 ? { threads } : {}
  };
}
async function sampleProcessResources(pid) {
  return process.platform === "linux" ? await sampleLinuxProc(pid) ?? await sampleWithPs(pid) : await sampleWithPs(pid);
}
function isMissingProcessError(error2) {
  return typeof error2 === "object" && error2 !== null && "code" in error2 && error2.code === "ESRCH";
}
function isProcessAlive(pid) {
  if (process.platform === "linux") {
    const statPath = `/proc/${pid}/stat`;
    if (!existsSync(statPath)) return false;
    try {
      const stat = readFileSync(statPath, "utf8");
      const commandEnd = stat.lastIndexOf(")");
      if (commandEnd >= 0 && stat.slice(commandEnd + 1).trimStart().startsWith("Z "))
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
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
var ProcessSupervisor = class {
  constructor(options) {
    this.options = options;
    const detached = process.platform !== "win32";
    this.sample = options.sample ?? sampleProcessResources;
    this.exitPromise = new Promise((resolve) => {
      this.resolveExit = resolve;
    });
    const spawnProcess = options.spawnProcess ?? ((command, args, spawnOptions) => spawn(command, args, spawnOptions));
    this.child = spawnProcess(options.command, options.args, {
      cwd: options.cwd,
      env: options.env,
      detached,
      stdio: "pipe",
      windowsHide: true
    });
    this.spawned = IS_PERRY ? this.child.pid ? Promise.resolve() : Promise.reject(new Error(`failed to spawn ${options.command}`)) : new Promise((resolve, reject) => {
      this.child.once("spawn", resolve);
      this.child.once("error", reject);
    });
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => {
      this.stderrTail = `${this.stderrTail}${chunk}`.slice(-(options.maxStderrBytes ?? 64 * 1024));
    });
    this.child.once("exit", (code, signal) => this.recordExit({ code, signal }));
    this.child.once("error", (error2) => {
      if (!this.exited) {
        this.recordExit({ code: null, signal: null, reason: `spawn error: ${error2.message}` });
      }
    });
    if (IS_PERRY) this.scheduleExitPoll();
    if (options.sampleIntervalMs > 0) this.scheduleSample();
  }
  options;
  child;
  spawned;
  telemetry = {
    resources: null,
    terminationReason: null
  };
  exitPromise;
  resolveExit;
  closeHandlers = /* @__PURE__ */ new Set();
  resourceHandlers = /* @__PURE__ */ new Set();
  terminationHandlers = /* @__PURE__ */ new Set();
  sample;
  sampleTimer = null;
  exitPollTimer = null;
  sampling = false;
  stderrTail = "";
  overRssSamples = 0;
  closePromise = null;
  exited = false;
  get pid() {
    return this.child.pid ?? null;
  }
  getStderrTail() {
    return this.stderrTail.trimEnd();
  }
  getResourceUsage() {
    return this.telemetry.resources ? { ...this.telemetry.resources } : null;
  }
  getTerminationReason() {
    return this.telemetry.terminationReason ?? void 0;
  }
  onClose(handler) {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }
  onResourceSample(handler) {
    if (this.telemetry.resources) handler();
    if (!this.exited) this.resourceHandlers.add(handler);
    return () => this.resourceHandlers.delete(handler);
  }
  onTermination(handler) {
    if (this.telemetry.terminationReason) handler();
    if (!this.exited) this.terminationHandlers.add(handler);
    return () => this.terminationHandlers.delete(handler);
  }
  selectTerminationReason(reason) {
    if (!reason || this.telemetry.terminationReason) return;
    this.telemetry.terminationReason = reason;
    for (const handler of this.terminationHandlers) handler();
  }
  scheduleExitPoll() {
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
  scheduleSample() {
    if (this.exited || this.options.sampleIntervalMs <= 0 || this.sampleTimer) return;
    this.sampleTimer = setTimeout(
      () => {
        this.sampleTimer = null;
        void this.sampleNow().catch(() => null).finally(() => this.scheduleSample());
      },
      Math.max(250, this.options.sampleIntervalMs)
    );
  }
  recordExit(exit) {
    if (this.exited) return;
    this.exited = true;
    if (this.sampleTimer) clearTimeout(this.sampleTimer);
    this.sampleTimer = null;
    if (this.exitPollTimer) clearTimeout(this.exitPollTimer);
    this.exitPollTimer = null;
    this.selectTerminationReason(exit.reason);
    const resolvedExit = {
      code: exit.code,
      signal: exit.signal,
      reason: this.telemetry.terminationReason ?? exit.reason
    };
    this.resolveExit(resolvedExit);
    for (const handler of this.closeHandlers) handler(resolvedExit);
    this.closeHandlers.clear();
    this.resourceHandlers.clear();
    this.terminationHandlers.clear();
  }
  async sampleNow() {
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
            `worker RSS ${usage.rssBytes} exceeded ${maxRssBytes} bytes for ${this.overRssSamples} samples`
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
  async signal(signal) {
    const pid = this.pid;
    if (!pid || this.exited) return;
    if (IS_PERRY && process.platform !== "win32") {
      await signalNativeProcessGroup(pid, signal);
      return;
    }
    try {
      if (process.platform !== "win32") process.kill(-pid, signal);
      else this.child.kill(signal);
    } catch (error2) {
      if (!isMissingProcessError(error2)) throw error2;
    }
  }
  async exitedWithin(timeoutMs) {
    if (this.exited) return true;
    return await Promise.race([
      this.exitPromise.then(() => true),
      wait(timeoutMs).then(() => this.exited)
    ]);
  }
  async terminate(reason = "supervisor shutdown") {
    if (this.closePromise) return await this.closePromise;
    this.selectTerminationReason(reason);
    this.closePromise = (async () => {
      const pid = this.pid;
      if (IS_PERRY && process.platform !== "win32" && pid) {
        await terminateNativeProcessGroup(
          pid,
          this.options.shutdownGraceMs,
          this.options.killGraceMs
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
      if (!await this.exitedWithin(this.options.killGraceMs)) {
        throw new Error(`failed to terminate supervised process ${this.pid ?? "unknown"}`);
      }
    })();
    return await this.closePromise;
  }
  async close() {
    await this.terminate("supervisor shutdown");
  }
  async waitForExit() {
    return await this.exitPromise;
  }
};

// lib/fff-router/legacy-mcp-client.ts
var IS_PERRY2 = typeof process.versions.perry === "string";
var DEFAULT_MAX_MESSAGE_BYTES = 16 * 1024 * 1024;
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function wait2(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
var LegacyMcpClientBase = class {
  constructor(options, supervisor) {
    this.options = options;
    this.supervisor = supervisor;
    this.supervisor.onClose((exit) => {
      const details = this.getRecentStderr();
      const reason = exit.reason ?? this.supervisor.getTerminationReason();
      this.rejectAll(
        new Error(
          `fff-mcp exited${reason ? `: ${reason}` : ""}${details ? `; recent stderr: ${details}` : ""}`
        )
      );
      this.onTransportClosed();
      for (const handler of this.closeHandlers) handler(reason);
      this.closeHandlers.clear();
    });
  }
  options;
  supervisor;
  pending = /* @__PURE__ */ new Map();
  closeHandlers = /* @__PURE__ */ new Set();
  nextId = 0;
  stdoutBuffer = "";
  closed = false;
  get pid() {
    return this.supervisor.pid;
  }
  get supervision() {
    return this.supervisor.telemetry;
  }
  getResourceUsage() {
    return this.supervisor.getResourceUsage();
  }
  getTerminationReason() {
    return this.supervisor.getTerminationReason();
  }
  onClose(handler) {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }
  onResourceSample(handler) {
    return this.supervisor.onResourceSample(handler);
  }
  onTermination(handler) {
    return this.supervisor.onTermination(handler);
  }
  getRecentStderr() {
    return this.supervisor.getStderrTail();
  }
  onTransportClosed() {
  }
  async prepareTransport() {
  }
  closeTransport() {
  }
  rejectAll(error2) {
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(error2);
    }
    this.pending.clear();
  }
  failTransport(message) {
    const error2 = new Error(message);
    this.rejectAll(error2);
    void this.supervisor.terminate(message);
  }
  handleLine(line) {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.failTransport("fff-mcp wrote malformed JSON-RPC to stdout");
      return;
    }
    if (!isRecord(message) || typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (pending.timer) clearTimeout(pending.timer);
    if (isRecord(message.error)) {
      const text = typeof message.error.message === "string" ? message.error.message : "MCP request failed";
      pending.reject(new Error(text));
    } else {
      pending.resolve(message.result);
    }
  }
  handleStdout(chunk) {
    this.stdoutBuffer += chunk;
    if (Buffer.byteLength(this.stdoutBuffer, "utf8") > (this.options.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES)) {
      this.failTransport("fff-mcp stdout message exceeded the supervisor limit");
      return;
    }
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) this.handleLine(line);
  }
  async request(method, params, timeoutMs = 0) {
    const id = ++this.nextId;
    const response = new Promise((resolve, reject) => {
      const pending = { resolve, reject };
      if (timeoutMs > 0) {
        pending.timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`fff-mcp ${method} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
      this.pending.set(id, pending);
    });
    try {
      await this.writeMessage({ jsonrpc: "2.0", id, method, params });
    } catch (caught) {
      const pending = this.pending.get(id);
      this.pending.delete(id);
      if (pending?.timer) clearTimeout(pending.timer);
      pending?.reject(caught instanceof Error ? caught : new Error(String(caught)));
    }
    return await response;
  }
  async connect() {
    await this.supervisor.spawned;
    await this.prepareTransport();
    const initialized = await this.request(
      "initialize",
      {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "fff-router-supervisor", version: "2.0.0" }
      },
      this.options.initializeTimeoutMs ?? 1e4
    );
    if (!isRecord(initialized) || typeof initialized.protocolVersion !== "string") {
      throw new Error("fff-mcp returned an invalid initialize response");
    }
    const notification = this.writeMessage({
      jsonrpc: "2.0",
      method: "notifications/initialized"
    });
    if (!IS_PERRY2) await notification;
  }
  async callTool(name, args) {
    return await this.request("tools/call", { name, arguments: args });
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    const transportClose = this.closeTransport();
    if (!IS_PERRY2) await transportClose;
    await this.supervisor.close();
    this.rejectAll(new Error("fff-mcp client is closed"));
  }
};
var LegacyMcpClient = class extends LegacyMcpClientBase {
  constructor(options) {
    const supervisor = new ProcessSupervisor({ ...options, maxStderrBytes: 64 * 1024 });
    super(options, supervisor);
    this.supervisor.child.stdout.setEncoding("utf8");
    this.supervisor.child.stdout.on("data", (chunk) => this.handleStdout(chunk));
  }
  async writeMessage(message) {
    if (this.closed || this.supervisor.child.stdin.destroyed) {
      throw new Error("fff-mcp client is closed");
    }
    const line = `${JSON.stringify(message)}
`;
    if (this.supervisor.child.stdin.write(line)) return;
    await new Promise((resolve, reject) => {
      const onDrain = () => {
        cleanup();
        resolve();
      };
      const onError = (error2) => {
        cleanup();
        reject(error2);
      };
      const cleanup = () => {
        this.supervisor.child.stdin.off("drain", onDrain);
        this.supervisor.child.stdin.off("error", onError);
      };
      this.supervisor.child.stdin.once("drain", onDrain);
      this.supervisor.child.stdin.once("error", onError);
    });
  }
};
var FileBackedLegacyMcpClient = class extends LegacyMcpClientBase {
  directory;
  readyPath;
  requestPrefix;
  responsePrefix;
  stderrPath;
  requestSequence = 1;
  responseSequence = 1;
  pollTimer = null;
  transportExited = false;
  constructor(options) {
    if (process.platform === "win32") {
      throw new Error("file-backed fff-mcp transport requires a POSIX host");
    }
    const nonce = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    const directory = path2.join(os2.tmpdir(), `.fff-router-mcp.${nonce}`);
    const requestFifoPath = path2.join(directory, "request.fifo");
    const requestPrefix = path2.join(directory, "request");
    const responseFifoPath = path2.join(directory, "response.fifo");
    const responsePrefix = path2.join(directory, "response");
    const stderrPath = path2.join(directory, "stderr.log");
    const readyPath = path2.join(directory, "ready");
    mkdirSync(directory, { mode: 448 });
    const wrapper = [
      'request_fifo="$1"',
      'request_prefix="$2"',
      'response_fifo="$3"',
      'response_prefix="$4"',
      'stderr_path="$5"',
      'ready_path="$6"',
      "shift 6",
      "umask 077",
      'rm -f "$request_fifo" "$response_fifo" "$ready_path"',
      'mkfifo "$request_fifo" "$response_fifo" || exit 111',
      '( exec 3>"$request_fifo"; sequence=1; while :; do request="${request_prefix}.${sequence}.jsonl"; if [ -f "$request" ]; then if cat "$request" >&3; then rm -f "$request"; sequence=$((sequence + 1)); else exit 112; fi; else sleep 0.02; fi; done ) & request_spool_pid=$!',
      '( sequence=0; while IFS= read -r line; do sequence=$((sequence + 1)); temporary="${response_prefix}.${sequence}.tmp"; final="${response_prefix}.${sequence}.jsonl"; if printf "%s\\n" "$line" >"$temporary"; then mv "$temporary" "$final"; fi; done <"$response_fifo" ) & response_spool_pid=$!',
      ': >"$ready_path"',
      '"$@" <"$request_fifo" >"$response_fifo" 2>>"$stderr_path"',
      "code=$?",
      'kill "$request_spool_pid" "$response_spool_pid" 2>/dev/null || true',
      'wait "$request_spool_pid" "$response_spool_pid" 2>/dev/null || true',
      'exit "$code"'
    ].join("; ");
    let supervisor;
    try {
      supervisor = new ProcessSupervisor({
        ...options,
        command: "/bin/sh",
        args: [
          "-c",
          wrapper,
          "fff-router-mcp-transport",
          requestFifoPath,
          requestPrefix,
          responseFifoPath,
          responsePrefix,
          stderrPath,
          readyPath,
          options.command,
          ...options.args
        ],
        maxStderrBytes: 64 * 1024
      });
    } catch (caught) {
      rmSync2(directory, { recursive: true, force: true });
      throw caught;
    }
    super(options, supervisor);
    this.directory = directory;
    this.readyPath = readyPath;
    this.requestPrefix = requestPrefix;
    this.responsePrefix = responsePrefix;
    this.stderrPath = stderrPath;
  }
  getRecentStderr() {
    try {
      const fd = openSync(this.stderrPath, "r");
      try {
        const size = fstatSync(fd).size;
        const length = Math.min(size, 64 * 1024);
        const buffer = Buffer.alloc(length);
        readSync(fd, buffer, 0, length, Math.max(0, size - length));
        return buffer.toString("utf8").trimEnd() || super.getRecentStderr();
      } finally {
        closeSync(fd);
      }
    } catch {
      return super.getRecentStderr();
    }
  }
  cleanup() {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    rmSync2(this.directory, { recursive: true, force: true });
  }
  onTransportClosed() {
    this.transportExited = true;
    this.cleanup();
  }
  capStderr() {
    try {
      const details = statSync(this.stderrPath);
      if (details.size <= 64 * 1024) return;
      const fd = openSync(this.stderrPath, "r");
      let tail;
      try {
        tail = Buffer.alloc(64 * 1024);
        readSync(fd, tail, 0, tail.byteLength, details.size - tail.byteLength);
      } finally {
        closeSync(fd);
      }
      writeFileSync(this.stderrPath, tail, { mode: 384 });
    } catch {
    }
  }
  pollResponse() {
    if (this.closed) return;
    try {
      this.capStderr();
      for (let handled = 0; handled < 256; handled += 1) {
        const responsePath = `${this.responsePrefix}.${this.responseSequence}.jsonl`;
        if (!existsSync2(responsePath)) break;
        const size = statSync(responsePath).size;
        if (size > (this.options.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES)) {
          this.failTransport("fff-mcp stdout message exceeded the supervisor limit");
          return;
        }
        const line = readFileSync2(responsePath, "utf8");
        rmSync2(responsePath, { force: true });
        this.responseSequence += 1;
        this.handleStdout(line);
      }
    } catch (caught) {
      this.failTransport(
        `failed to read fff-mcp response transport: ${caught instanceof Error ? caught.message : String(caught)}`
      );
    }
  }
  scheduleResponsePoll() {
    if (this.closed || this.transportExited || this.pollTimer) return;
    this.pollTimer = setTimeout(
      () => {
        this.pollTimer = null;
        this.pollResponse();
        this.scheduleResponsePoll();
      },
      Math.max(5, this.options.filePollIntervalMs ?? 20)
    );
  }
  async prepareTransport() {
    const deadline = Date.now() + (this.options.initializeTimeoutMs ?? 1e4);
    while (true) {
      try {
        if (existsSync2(this.readyPath) && statSync(this.readyPath).isFile()) break;
      } catch {
      }
      if (this.transportExited) {
        const details = this.supervisor.getStderrTail();
        throw new Error(
          `fff-mcp transport exited before its request spool became ready${details ? `: ${details}` : ""}`
        );
      }
      if (Date.now() >= deadline) {
        const details = this.supervisor.getStderrTail();
        throw new Error(
          `fff-mcp request spool did not become ready${details ? `: ${details}` : ""}`
        );
      }
      await wait2(10);
    }
    this.scheduleResponsePoll();
  }
  writeMessage(message) {
    if (this.closed || this.transportExited) {
      throw new Error("fff-mcp client is closed");
    }
    const line = `${JSON.stringify(message)}
`;
    if (Buffer.byteLength(line, "utf8") > (this.options.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES)) {
      throw new Error("fff-mcp request message exceeded the supervisor limit");
    }
    const requestPath = `${this.requestPrefix}.${this.requestSequence}.jsonl`;
    const temporaryPath = `${requestPath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, line, { encoding: "utf8", mode: 384, flag: "wx" });
    renameSync(temporaryPath, requestPath);
    this.requestSequence += 1;
  }
  closeTransport() {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }
  async close() {
    try {
      await super.close();
    } finally {
      this.cleanup();
    }
  }
};
function createLegacyMcpClient(options) {
  return IS_PERRY2 ? new FileBackedLegacyMcpClient(options) : new LegacyMcpClient(options);
}

// lib/fff-router/adapters/common.ts
import path3 from "node:path";
function normalizeRelativePath(relativePath) {
  return relativePath.replace(/\\/g, "/");
}
function matchesSingleEntry(entry, candidatePath) {
  if (entry.fileRestriction) {
    return candidatePath === entry.fileRestriction;
  }
  return candidatePath === entry.within || candidatePath.startsWith(entry.within + path3.sep);
}
function pathWithinScope(request, candidatePath) {
  if (matchesSingleEntry(
    {
      within: request.within,
      ...request.fileRestriction !== void 0 ? { fileRestriction: request.fileRestriction } : {}
    },
    candidatePath
  )) {
    return true;
  }
  for (const entry of request.additionalWithinEntries ?? []) {
    if (matchesSingleEntry(
      {
        within: entry.resolvedWithin,
        ...entry.fileRestriction !== void 0 ? { fileRestriction: entry.fileRestriction } : {}
      },
      candidatePath
    )) {
      return true;
    }
  }
  return false;
}
function matchesExtension(extensions, relativePath) {
  if (extensions.length === 0) {
    return true;
  }
  return extensions.some(
    (extension) => normalizeRelativePath(relativePath).endsWith(`.${extension}`)
  );
}
function matchesGlob(glob, relativePath) {
  if (!glob) {
    return true;
  }
  return matchGlob(glob, normalizeRelativePath(relativePath));
}
function escapeRegexCharacter(character) {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}
function globSource(glob) {
  let source = "";
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index] ?? "";
    if (character === "*") {
      if (glob[index + 1] === "*") {
        index += 1;
        if (glob[index + 1] === "/") {
          index += 1;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
      continue;
    }
    if (character === "?") {
      source += "[^/]";
      continue;
    }
    if (character === "[") {
      const close = glob.indexOf("]", index + 1);
      if (close > index + 1) {
        let body = glob.slice(index + 1, close);
        if (body.startsWith("!")) body = `^${body.slice(1)}`;
        source += `[${body.replace(/\\/g, "\\\\")}]`;
        index = close;
        continue;
      }
    }
    if (character === "{") {
      const close = glob.indexOf("}", index + 1);
      if (close > index + 1) {
        const alternatives = glob.slice(index + 1, close).split(",");
        if (alternatives.length > 1 && alternatives.every((entry) => !/[{}]/.test(entry))) {
          source += `(?:${alternatives.map(globSource).join("|")})`;
          index = close;
          continue;
        }
      }
    }
    source += escapeRegexCharacter(character);
  }
  return source;
}
function matchGlob(glob, relativePath) {
  const negated = glob.startsWith("!");
  const expression = negated ? glob.slice(1) : glob;
  const basename = !expression.includes("/");
  const candidate = basename ? relativePath.split("/").at(-1) ?? relativePath : relativePath;
  const matches = new RegExp(`^${globSource(expression)}$`, "u").test(candidate);
  return negated ? !matches : matches;
}
function matchesExcludePaths(excludePaths, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return !excludePaths.some((excludePath) => {
    if (/[*?[\]{}!]/.test(excludePath)) {
      return matchGlob(excludePath, normalized);
    }
    return normalized === excludePath || normalized.startsWith(`${excludePath}/`);
  });
}
function filterItems(request, items) {
  return items.filter((item) => pathWithinScope(request, item.path)).filter((item) => matchesGlob(request.glob, item.relativePath)).filter((item) => matchesExtension(request.extensions, item.relativePath)).filter((item) => matchesExcludePaths(request.excludePaths, item.relativePath)).slice(0, request.limit);
}

// lib/fff-router/tool-resolution.ts
import { existsSync as existsSync3, statSync as statSync2 } from "node:fs";
import os3 from "node:os";
import path4 from "node:path";
var TOOL_ENV_VARS = {
  "fff-mcp": "FFF_ROUTER_FFF_MCP_BIN"
};
function managedInstallPath(env) {
  const installDir = env.FFF_MCP_INSTALL_DIR || path4.join(env.HOME || os3.homedir(), ".local", "bin");
  return path4.join(installDir, process.platform === "win32" ? "fff-mcp.exe" : "fff-mcp");
}
function isExecutable(pathValue) {
  try {
    const stats = statSync2(pathValue);
    return stats.isFile() && (process.platform === "win32" || (stats.mode & 73) !== 0);
  } catch {
    return false;
  }
}
function commandExtensions(env) {
  if (process.platform !== "win32") {
    return [""];
  }
  const pathExt = env.PATHEXT?.split(";").filter(Boolean);
  return pathExt && pathExt.length > 0 ? pathExt : [".EXE", ".CMD", ".BAT", ".COM"];
}
function resolveExecutableOnPath(command, env = process.env) {
  const pathValue = env.PATH || process.env.PATH || "";
  const directories = pathValue.split(path4.delimiter).filter(Boolean);
  const extensions = commandExtensions(env);
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidatePath = process.platform === "win32" && extension && !command.toUpperCase().endsWith(extension) ? path4.join(directory, `${command}${extension}`) : path4.join(directory, command);
      if (existsSync3(candidatePath) && isExecutable(candidatePath)) {
        return candidatePath;
      }
    }
  }
  return null;
}
function remediation(tool, envVar) {
  return `Install ${tool} or set ${envVar} to an executable path.`;
}
function resolveToolCommand(tool, deps = {}) {
  const env = deps.env ?? process.env;
  const envVar = TOOL_ENV_VARS[tool];
  const executableCheck = deps.isExecutable ?? isExecutable;
  const override = env[envVar];
  if (override) {
    const executable = executableCheck(override);
    return {
      tool,
      command: override,
      source: "env",
      envVar,
      executable,
      ...!executable ? { remediation: remediation(tool, envVar) } : {}
    };
  }
  const pathCommand = (deps.resolveExecutableOnPath ?? ((command) => resolveExecutableOnPath(command, env)))(tool);
  if (pathCommand) {
    return {
      tool,
      command: pathCommand,
      source: "path",
      envVar,
      executable: executableCheck(pathCommand),
      ...!executableCheck(pathCommand) ? { remediation: remediation(tool, envVar) } : {}
    };
  }
  const managedCommand = managedInstallPath(env);
  if (existsSync3(managedCommand)) {
    const executable = executableCheck(managedCommand);
    return {
      tool,
      command: managedCommand,
      source: "managed",
      envVar,
      executable,
      ...!executable ? { remediation: remediation(tool, envVar) } : {}
    };
  }
  return {
    tool,
    command: null,
    source: "missing",
    envVar,
    executable: false,
    remediation: remediation(tool, envVar)
  };
}

// lib/fff-router/adapters/fff-mcp-stdio.ts
var MAX_FILTERED_CURSOR_PAGES = 20;
function searchFailed(message) {
  return {
    ok: false,
    error: {
      code: "SEARCH_FAILED",
      backendId: "fff-mcp",
      message
    }
  };
}
function discoverFffMcpCommand() {
  const resolution = resolveToolCommand("fff-mcp");
  if (!resolution.command || !resolution.executable) {
    throw new Error(resolution.remediation ?? "fff-mcp is not available");
  }
  return resolution.command;
}
function inheritedStringEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry) => typeof entry[1] === "string"
    )
  );
}
function normalizeRelative(relativePath) {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}
var GLOB_META_PATTERN = /[*?[\]{}!]/;
var UNSAFE_SCOPE_PATH_PATTERN = /[\s,*?[\]{}!]/;
function compileFffMcpGlobConstraint(glob) {
  const normalized = normalizeRelative(glob);
  if (!normalized.includes("/") || normalized.startsWith("**/") || normalized.endsWith("/") || GLOB_META_PATTERN.test(normalized)) {
    return glob;
  }
  return `**/${normalized}`;
}
function formatExcludeConstraint(excludePath) {
  return excludePath.includes(".") || excludePath.endsWith("/") ? `!${excludePath}` : `!${excludePath}/`;
}
function encodeWithinEntryToken(entry, persistenceRoot) {
  if (entry.fileRestriction) {
    const relativeFile = normalizeRelative(path5.relative(persistenceRoot, entry.fileRestriction));
    if (!relativeFile || relativeFile === "." || UNSAFE_SCOPE_PATH_PATTERN.test(relativeFile)) {
      return null;
    }
    return `**/${relativeFile}`;
  }
  const baseRelative = normalizeRelative(path5.relative(persistenceRoot, entry.basePath));
  if (!baseRelative || baseRelative === "." || UNSAFE_SCOPE_PATH_PATTERN.test(baseRelative)) {
    return null;
  }
  const withoutTrailingSlash = baseRelative.replace(/\/+$/, "");
  return `${withoutTrailingSlash}/**`;
}
function compileMultiWithinConstraint(entries, persistenceRoot) {
  const tokens = [];
  for (const entry of entries) {
    const token = encodeWithinEntryToken(entry, persistenceRoot);
    if (token === null) {
      return null;
    }
    tokens.push(token);
  }
  if (tokens.length === 1) {
    return tokens[0] ?? null;
  }
  return `{${tokens.join(",")}}`;
}
function buildConstraintTokens(request) {
  const tokens = [];
  const additional = request.additionalWithinEntries ?? [];
  if (additional.length > 0) {
    const multi = compileMultiWithinConstraint(
      [
        {
          basePath: request.basePath,
          ...request.fileRestriction !== void 0 ? { fileRestriction: request.fileRestriction } : {}
        },
        ...additional
      ],
      request.persistenceRoot
    );
    if (multi !== null) {
      tokens.push(multi);
    }
  } else if (request.fileRestriction) {
    const token = encodeWithinEntryToken(
      {
        basePath: request.basePath,
        fileRestriction: request.fileRestriction
      },
      request.persistenceRoot
    );
    if (token !== null) {
      tokens.push(token);
    }
  } else {
    const token = encodeWithinEntryToken({ basePath: request.basePath }, request.persistenceRoot);
    if (token !== null) {
      tokens.push(token);
    }
  }
  if (request.glob) {
    tokens.push(compileFffMcpGlobConstraint(request.glob));
  }
  for (const extension of request.extensions) {
    tokens.push(`*.${extension}`);
  }
  for (const excludePath of request.excludePaths) {
    tokens.push(formatExcludeConstraint(excludePath));
  }
  return tokens;
}
function compileFindFilesQuery(request) {
  return [request.query, ...buildConstraintTokens(request)].filter(Boolean).join(" ");
}
function compileConstraints(request) {
  return buildConstraintTokens(request).join(" ");
}
function compileGrepQuery(request) {
  const encodedPatterns = request.patterns.map(encodeFffMcpGrepPattern);
  const combinedPattern = encodedPatterns.length === 1 ? encodedPatterns[0] ?? "" : encodedPatterns.map((pattern) => `(?:${pattern})`).join("|");
  return [...buildConstraintTokens(request), combinedPattern].filter(Boolean).join(" ");
}
function encodeFffMcpGrepPattern(pattern) {
  return pattern.replace(/[ \t]/g, "\\s");
}
function stripFindFilesSuffix(line) {
  return line.replace(/\s+-\s+(hot|warm|frequent)(\s+git:[^\s]+)?$/, "").replace(/\s+git:[^\s]+$/, "").trim();
}
function parseNextCursor(line) {
  const cursorLine = line.match(/^cursor:\s*(.+)$/);
  if (cursorLine?.[1]) {
    return cursorLine[1].trim().replace(/^"|"$/g, "");
  }
  const quoted = line.match(/\bcursor="([^"]+)"/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }
  const bare = line.match(/\bcursor=([^\s\]]+)/);
  if (bare?.[1]) {
    return bare[1].trim().replace(/^"|"$/g, "");
  }
  return null;
}
function parseFindFilesOutput(text, persistenceRoot) {
  const items = [];
  const summary = {};
  let nextCursor = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const cursor = parseNextCursor(line);
    if (cursor) {
      nextCursor = cursor;
      continue;
    }
    const readRecommendation = parseReadRecommendation(line);
    if (readRecommendation) {
      summary.readRecommendation = readRecommendation;
      continue;
    }
    const shownSummary = parseShownSummary(line);
    if (shownSummary.shownCount !== void 0 || shownSummary.totalCount !== void 0) {
      Object.assign(summary, shownSummary);
      continue;
    }
    if (!line || line.startsWith("\u2192") || /^0\s+results/.test(line)) {
      continue;
    }
    const relativePath = stripFindFilesSuffix(line);
    if (!relativePath) {
      continue;
    }
    items.push({
      path: path5.join(persistenceRoot, relativePath),
      relativePath
    });
  }
  return { items, summary, nextCursor };
}
function parseReadRecommendation(line) {
  const match = line.match(/^→\s+Read\s+(.+?)(?:\s+\((.+)\))?$/);
  if (!match) {
    return void 0;
  }
  const relativePath = match[1];
  const reason = match[2];
  if (!relativePath) {
    return void 0;
  }
  return {
    relativePath: normalizeRelative(relativePath.trim().replace(/\s+\[def\]$/, "")),
    ...reason ? { reason: reason.trim() } : {}
  };
}
function parseShownSummary(line) {
  const match = line.match(/^(\d+)\/(\d+)\s+matches(?:\s+shown)?$/);
  if (!match) {
    return {};
  }
  return {
    shownCount: Number(match[1]),
    totalCount: Number(match[2])
  };
}
function filterRenderedFindFilesText(text, keep) {
  const out = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const readRecommendation = parseReadRecommendation(line);
    if (readRecommendation) {
      if (keep(readRecommendation.relativePath)) {
        out.push(rawLine);
      }
      continue;
    }
    if (!line || parseNextCursor(line) !== null || /^\d+\/\d+\s+matches(?:\s+shown)?$/.test(line) || /^0\s+results/.test(line)) {
      out.push(rawLine);
      continue;
    }
    const relativePath = stripFindFilesSuffix(line);
    if (relativePath && keep(relativePath)) {
      out.push(rawLine);
    }
  }
  return out.join("\n");
}
function filterRenderedCompactText(text, keep) {
  const out = [];
  let currentAccepted = true;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const readMatch = line.match(/^→\s+Read\s+(.+?)(?:\s+\((.+)\))?$/);
    if (readMatch) {
      const recPath = normalizeRelative((readMatch[1] ?? "").replace(/\s+\[def\]$/, "").trim());
      if (keep(recPath)) {
        out.push(rawLine);
      }
      continue;
    }
    if (!line || line.startsWith("cursor:") || /^\d+\/\d+\s+matches\s+shown$/.test(line) || /^0\s+matches/.test(line) || /^0\s+exact\s+matches/.test(line)) {
      out.push(rawLine);
      continue;
    }
    if (line === "--" || /^\s+\d+[:\-|]/.test(line)) {
      if (currentAccepted) {
        out.push(rawLine);
      }
      continue;
    }
    const headerPath = normalizeRelative(line.replace(/\s+\[[^\]]+\]$/, ""));
    currentAccepted = keep(headerPath);
    if (currentAccepted) {
      out.push(rawLine);
    }
  }
  return out.join("\n");
}
function parseTextMatchOutput(text, persistenceRoot) {
  const items = [];
  const summary = {};
  let nextCursor = null;
  let currentPath = null;
  let currentPathIsDefinition = false;
  let pendingBefore = [];
  let currentMatch = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) {
      continue;
    }
    const cursor = parseNextCursor(line);
    if (cursor) {
      nextCursor = cursor;
      continue;
    }
    const readRecommendation = parseReadRecommendation(line);
    if (readRecommendation) {
      summary.readRecommendation = readRecommendation;
      continue;
    }
    const shownSummary = parseShownSummary(line);
    if (shownSummary.shownCount !== void 0 || shownSummary.totalCount !== void 0) {
      Object.assign(summary, shownSummary);
      continue;
    }
    if (/^0\s+matches/.test(line) || /^0\s+exact\s+matches/.test(line)) {
      continue;
    }
    if (line === "--") {
      currentMatch = null;
      pendingBefore = [];
      continue;
    }
    const numbered = line.match(/^\s+(\d+)([:\-|])\s?(.*)$/);
    if (numbered) {
      const [, lineNumberRaw, kind, contentRaw] = numbered;
      const lineNumber = Number(lineNumberRaw);
      const content = (contentRaw ?? "").trim();
      if (kind === ":") {
        if (!currentPath) {
          continue;
        }
        currentMatch = {
          path: path5.join(persistenceRoot, currentPath),
          relativePath: currentPath,
          line: lineNumber,
          text: content,
          ...pendingBefore.length > 0 ? { contextBefore: [...pendingBefore] } : {},
          ...currentPathIsDefinition ? { isDefinition: true } : {}
        };
        items.push(currentMatch);
        pendingBefore = [];
        continue;
      }
      if (kind === "-") {
        if (currentMatch) {
          currentMatch.contextAfter = [...currentMatch.contextAfter ?? [], content];
        } else {
          pendingBefore.push(content);
        }
        continue;
      }
      if (kind === "|") {
        if (currentMatch) {
          if (currentMatch.isDefinition) {
            currentMatch.definitionBody = [...currentMatch.definitionBody ?? [], content];
          } else {
            currentMatch.contextAfter = [...currentMatch.contextAfter ?? [], content];
          }
        }
        continue;
      }
    }
    currentPathIsDefinition = /\s+\[def\]$/.test(line);
    currentPath = normalizeRelative(line.replace(/\s+\[[^\]]+\]$/, ""));
    currentMatch = null;
    pendingBefore = [];
  }
  return { items, summary, nextCursor };
}
function rewriteRenderedCompactIfNeeded(text, originalItems, filteredItems) {
  const survivingPaths = new Set(filteredItems.map((item) => item.relativePath));
  const somethingDropped = originalItems.some((item) => !survivingPaths.has(item.relativePath));
  const filteredText = somethingDropped ? filterRenderedCompactText(text, (relativePath) => survivingPaths.has(relativePath)) : text;
  const renderedText = somethingDropped || filteredItems.length === 0 ? stripUnsupportedCursorLines(filteredText) : filteredText;
  if (isMetadataOnlyCompactText(renderedText)) {
    return void 0;
  }
  return renderedText;
}
function stripUnsupportedCursorLines(text) {
  let removed = false;
  const lines = text.split(/\r?\n/).filter((rawLine) => {
    const line = rawLine.trimEnd();
    if (line.startsWith("cursor:")) {
      removed = true;
      return false;
    }
    return true;
  });
  return removed ? lines.join("\n").trimEnd() : text;
}
function isMetadataOnlyCompactText(text) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || /^\d+\/\d+\s+matches\s+shown$/.test(line)) {
      continue;
    }
    return false;
  }
  return true;
}
function extractUnsupportedCursor(text) {
  for (const rawLine of text.split(/\r?\n/)) {
    const match = rawLine.trimEnd().match(/^cursor:\s*(\S+)\s*$/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}
function evaluateTextMatchPage(request, text) {
  const parsed = parseTextMatchOutput(text, request.persistenceRoot);
  const filteredItems = filterItems(request, parsed.items).filter(isTextMatchItem);
  return {
    text,
    parsed,
    filteredItems
  };
}
function isTextMatchItem(item) {
  return typeof item.line === "number" && typeof item.text === "string";
}
function renderSyntheticTextMatchCompact(items) {
  if (items.length === 0) {
    return void 0;
  }
  const label = items.length === 1 ? "filtered match" : "filtered matches";
  const lines = [`${items.length} ${label} shown`];
  for (const item of items) {
    lines.push(`${item.relativePath}${item.isDefinition ? " [def]" : ""}`);
    lines.push(` ${item.line}: ${item.text}`);
  }
  return lines.join("\n");
}
function renderDrainedTextMatchCompact(pages, items) {
  if (pages.length <= 1) {
    const page = pages[0];
    if (!page) {
      return void 0;
    }
    return rewriteRenderedCompactIfNeeded(page.text, page.parsed.items, page.filteredItems);
  }
  return renderSyntheticTextMatchCompact(items);
}
function summarizeDrainedTextMatchPages(pages, collectedItems) {
  if (pages.length <= 1) {
    const page = pages[0];
    if (!page) {
      return {};
    }
    return summarizeFilteredTextMatchPage(page.parsed.summary, page.filteredItems);
  }
  if (collectedItems.length === 0) {
    return {};
  }
  return { shownCount: collectedItems.length };
}
function summarizeFilteredTextMatchPage(summary, filteredItems) {
  if (filteredItems.length === 0) {
    return {};
  }
  return narrowSummaryToSurvivingPaths(summary, filteredItems);
}
async function executeTextMatchWithFilteredCursorDrain(runtime, toolName, baseArguments, request) {
  let text = await callToolText(runtime, toolName, baseArguments);
  let page = evaluateTextMatchPage(request, text);
  const pages = [page];
  const collectedItems = [...page.filteredItems];
  const seenItems = new Set(
    collectedItems.map((item) => `${item.relativePath}\0${item.line}\0${item.text}`)
  );
  const seenCursors = /* @__PURE__ */ new Set();
  let repeatedCursor;
  let pageCapHit = false;
  let nextCursor = page.parsed.nextCursor ?? extractUnsupportedCursor(text);
  const shouldDrainFilteredPages = request.cursor === null || request.cursor === void 0;
  while (shouldDrainFilteredPages && collectedItems.length < request.limit) {
    if (nextCursor === null) {
      break;
    }
    if (seenCursors.has(nextCursor)) {
      repeatedCursor = nextCursor;
      break;
    }
    if (pages.length >= MAX_FILTERED_CURSOR_PAGES) {
      pageCapHit = true;
      break;
    }
    seenCursors.add(nextCursor);
    text = await callToolText(runtime, toolName, {
      ...baseArguments,
      maxResults: Math.max(1, request.limit - collectedItems.length),
      cursor: nextCursor
    });
    page = evaluateTextMatchPage(request, text);
    pages.push(page);
    for (const item of page.filteredItems) {
      const key = `${item.relativePath}\0${item.line}\0${item.text}`;
      if (!seenItems.has(key)) {
        seenItems.add(key);
        collectedItems.push(item);
      }
    }
    nextCursor = page.parsed.nextCursor ?? extractUnsupportedCursor(text);
  }
  const items = collectedItems.slice(0, request.limit);
  const filteredOutCount = pages.reduce(
    (count, drainedPage) => count + Math.max(0, drainedPage.parsed.items.length - drainedPage.filteredItems.length),
    0
  );
  return {
    items,
    nextCursor,
    renderedCompact: renderDrainedTextMatchCompact(pages, items),
    summary: summarizeDrainedTextMatchPages(pages, items),
    diagnostics: {
      cursorDrain: {
        pagesFetched: pages.length,
        filteredOutCount,
        ...repeatedCursor ? { repeatedCursor } : {},
        pageCapHit
      }
    }
  };
}
function rewriteRenderedFindFilesIfNeeded(text, originalItems, filteredItems) {
  const survivingPaths = new Set(filteredItems.map((item) => item.relativePath));
  const somethingDropped = originalItems.some((item) => !survivingPaths.has(item.relativePath));
  if (!somethingDropped) {
    return text;
  }
  const filtered = filterRenderedFindFilesText(
    text,
    (relativePath) => survivingPaths.has(relativePath)
  );
  const body = filtered.split(/\r?\n/).filter((line) => {
    const trimmed = line.trimEnd();
    return trimmed.length > 0 && parseNextCursor(trimmed) === null && !/^\d+\/\d+\s+matches(?:\s+shown)?$/.test(trimmed) && !/^0\s+results/.test(trimmed);
  });
  const label = filteredItems.length === 1 ? "filtered match" : "filtered matches";
  return [`${filteredItems.length} ${label} shown`, ...body].join("\n");
}
function evaluateFindFilesPage(request, text) {
  const parsed = parseFindFilesOutput(text, request.persistenceRoot);
  const filteredItems = filterItems(request, parsed.items).filter(isFindFileItem);
  return { text, parsed, filteredItems };
}
function isFindFileItem(item) {
  return !("line" in item);
}
function renderSyntheticFindFilesCompact(items) {
  const label = items.length === 1 ? "filtered match" : "filtered matches";
  return [`${items.length} ${label} shown`, ...items.map((item) => item.relativePath)].join("\n");
}
function renderDrainedFindFilesCompact(pages, items) {
  const page = pages[0];
  if (pages.length === 1 && page) {
    return rewriteRenderedFindFilesIfNeeded(page.text, page.parsed.items, page.filteredItems);
  }
  return renderSyntheticFindFilesCompact(items);
}
function summarizeDrainedFindFilesPages(pages, items) {
  const page = pages[0];
  if (pages.length === 1 && page) {
    return narrowSummaryToSurvivingPaths(page.parsed.summary, page.filteredItems);
  }
  return items.length > 0 ? { shownCount: items.length } : {};
}
async function executeFindFilesWithFilteredCursorDrain(runtime, request) {
  const query = compileFindFilesQuery(request);
  let text = await callToolText(runtime, "find_files", {
    query,
    maxResults: request.limit,
    ...request.cursor !== null && request.cursor !== void 0 ? { cursor: request.cursor } : {}
  });
  let page = evaluateFindFilesPage(request, text);
  const pages = [page];
  const collectedItems = [...page.filteredItems];
  const seenItems = new Set(collectedItems.map((item) => item.relativePath));
  const seenCursors = /* @__PURE__ */ new Set();
  let repeatedCursor;
  let pageCapHit = false;
  let nextCursor = page.parsed.nextCursor ?? extractUnsupportedCursor(text);
  const shouldDrainFilteredPages = request.cursor === null || request.cursor === void 0;
  while (shouldDrainFilteredPages && collectedItems.length < request.limit) {
    if (nextCursor === null) {
      break;
    }
    if (seenCursors.has(nextCursor)) {
      repeatedCursor = nextCursor;
      break;
    }
    if (pages.length >= MAX_FILTERED_CURSOR_PAGES) {
      pageCapHit = true;
      break;
    }
    seenCursors.add(nextCursor);
    text = await callToolText(runtime, "find_files", {
      query,
      maxResults: Math.max(1, request.limit - collectedItems.length),
      cursor: nextCursor
    });
    page = evaluateFindFilesPage(request, text);
    pages.push(page);
    for (const item of page.filteredItems) {
      if (!seenItems.has(item.relativePath)) {
        seenItems.add(item.relativePath);
        collectedItems.push(item);
      }
    }
    nextCursor = page.parsed.nextCursor ?? extractUnsupportedCursor(text);
  }
  const items = collectedItems.slice(0, request.limit);
  const filteredOutCount = pages.reduce(
    (count, drainedPage) => count + Math.max(0, drainedPage.parsed.items.length - drainedPage.filteredItems.length),
    0
  );
  return {
    items,
    nextCursor,
    renderedCompact: renderDrainedFindFilesCompact(pages, items),
    summary: summarizeDrainedFindFilesPages(pages, items),
    diagnostics: {
      cursorDrain: {
        pagesFetched: pages.length,
        filteredOutCount,
        ...repeatedCursor ? { repeatedCursor } : {},
        pageCapHit
      }
    }
  };
}
function narrowSummaryToSurvivingPaths(summary, filteredItems) {
  if (!summary.readRecommendation) {
    return summary;
  }
  const survivingPaths = new Set(filteredItems.map((item) => item.relativePath));
  if (survivingPaths.has(summary.readRecommendation.relativePath)) {
    return summary;
  }
  const { readRecommendation: _dropped, ...rest } = summary;
  return rest;
}
async function callToolText(runtime, name, args) {
  return await runtime.callTool(name, args);
}
var DEFAULT_FFF_MCP_READY_TIMEOUT_MS = 3e4;
function readEnvReadyTimeoutMs() {
  const raw = process.env.FFF_ROUTER_FFF_MCP_READY_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_FFF_MCP_READY_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_FFF_MCP_READY_TIMEOUT_MS;
  }
  return parsed;
}
async function waitForFffMcpReady(callTool, options = {}) {
  const deadlineMs = options.deadlineMs ?? readEnvReadyTimeoutMs();
  let timeout;
  try {
    return await Promise.race([
      callTool("find_files", { query: "a", maxResults: 1 }),
      new Promise((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(
            new Error(
              `fff-mcp readiness probe exceeded ${deadlineMs}ms. Raise FFF_ROUTER_FFF_MCP_READY_TIMEOUT_MS if this repository is large.`
            )
          ),
          deadlineMs
        );
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
function createFffMcpStdioAdapter(options = {}) {
  return {
    backendId: "fff-mcp",
    async startRuntime(args) {
      const clientOptions = {
        command: (options.resolveCommand ?? discoverFffMcpCommand)(),
        args: [
          args.persistenceRoot,
          "--idle-timeout-secs",
          String(Math.ceil((args.supervision?.orphanIdleTimeoutMs ?? 30 * 60 * 1e3) / 1e3)),
          "--no-update-check"
        ],
        cwd: args.persistenceRoot,
        env: inheritedStringEnv(),
        sampleIntervalMs: args.supervision?.sampleIntervalMs ?? 5e3,
        ...args.supervision?.maxRssBytes ? { maxRssBytes: args.supervision.maxRssBytes } : {},
        shutdownGraceMs: args.supervision?.shutdownGraceMs ?? 500,
        killGraceMs: args.supervision?.killGraceMs ?? 1e3
      };
      const client = options.createClient?.(clientOptions) ?? createLegacyMcpClient(clientOptions);
      try {
        await client.connect();
      } catch (error2) {
        await Promise.resolve(client.close()).catch(() => {
        });
        throw error2;
      }
      const runtime = {
        id: `fff-mcp::${args.persistenceRoot}`,
        get pid() {
          return client.pid;
        },
        supervision: client.supervision,
        onClose: (handler) => client.onClose(handler),
        onResourceSample: (handler) => client.onResourceSample(handler),
        onTermination: (handler) => client.onTermination(handler),
        getResourceUsage: () => client.getResourceUsage(),
        getTerminationReason: () => client.getTerminationReason(),
        async close() {
          await client.close();
        },
        async callTool(name, args2) {
          const response = await client.callTool(name, args2);
          const text = response.content?.find((entry) => entry.type === "text")?.text;
          if (response.isError || typeof text !== "string") {
            throw new Error(text || `fff-mcp ${name} call failed`);
          }
          return text;
        }
      };
      try {
        await (options.waitForReady ?? waitForFffMcpReady)(runtime.callTool.bind(runtime));
      } catch (error2) {
        await Promise.resolve(runtime.close()).catch(() => {
        });
        throw error2;
      }
      return runtime;
    },
    async execute(args) {
      try {
        switch (args.request.queryKind) {
          case "find_files": {
            const value = await executeFindFilesWithFilteredCursorDrain(args.runtime, args.request);
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "find_files",
                ...value
              }
            };
          }
          case "grep": {
            const toolName = args.request.literal ? "multi_grep" : "grep";
            const toolArguments = args.request.literal ? {
              patterns: args.request.patterns,
              constraints: compileConstraints(args.request),
              maxResults: args.request.limit,
              context: args.request.contextLines,
              ...args.request.cursor !== null && args.request.cursor !== void 0 ? { cursor: args.request.cursor } : {}
            } : {
              query: compileGrepQuery(args.request),
              maxResults: args.request.limit,
              ...args.request.cursor !== null && args.request.cursor !== void 0 ? { cursor: args.request.cursor } : {}
            };
            const value = await executeTextMatchWithFilteredCursorDrain(
              args.runtime,
              toolName,
              toolArguments,
              args.request
            );
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "grep",
                ...value
              }
            };
          }
        }
      } catch (error2) {
        return searchFailed(error2 instanceof Error ? error2.message : String(error2));
      }
    }
  };
}

// lib/fff-router/coordinator.ts
import path10 from "node:path";

// lib/fff-router/cursor.ts
import { createHash } from "node:crypto";
function digest(value) {
  return createHash("sha256").update(value).digest("base64url").slice(0, 16);
}
function requestFingerprint(request) {
  const base = {
    tool: request.tool,
    within: request.within,
    glob: request.glob ?? null,
    extensions: request.extensions,
    excludePaths: request.excludePaths,
    limit: request.limit
  };
  const value = request.tool === "find_files" ? { ...base, query: request.query } : {
    ...base,
    patterns: request.patterns,
    literal: request.literal,
    contextLines: request.contextLines
  };
  return digest(JSON.stringify(value));
}
function encodeCursor(args) {
  const envelope = {
    v: 1,
    r: digest(args.root),
    q: requestFingerprint(args.request),
    g: args.generation,
    c: args.upstreamCursor
  };
  return Buffer.from(JSON.stringify(envelope)).toString("base64url");
}
function decodeCursor(args) {
  let value;
  try {
    value = JSON.parse(Buffer.from(args.cursor, "base64url").toString("utf8"));
  } catch {
    return {
      ok: false,
      error: { code: "CURSOR_INVALID", message: "cursor is not a valid fff-router cursor" }
    };
  }
  if (!value || typeof value !== "object" || value.v !== 1 || typeof value.r !== "string" || typeof value.q !== "string" || typeof value.g !== "number" || typeof value.c !== "string") {
    return {
      ok: false,
      error: { code: "CURSOR_INVALID", message: "cursor payload is invalid" }
    };
  }
  const envelope = value;
  if (envelope.r !== digest(args.root) || envelope.q !== requestFingerprint(args.request)) {
    return {
      ok: false,
      error: {
        code: "CURSOR_INVALID",
        message: "cursor belongs to a different search or repository"
      }
    };
  }
  if (envelope.g !== args.generation) {
    return {
      ok: false,
      error: {
        code: "CURSOR_EXPIRED",
        message: "cursor expired because its fff-mcp worker was restarted",
        retryable: false
      }
    };
  }
  return { ok: true, value: envelope.c };
}

// lib/fff-router/resolve-path.ts
import { existsSync as existsSync4, realpathSync, statSync as statSync3 } from "node:fs";
import path6 from "node:path";
function searchPathError(code, message) {
  return { ok: false, error: { code, message } };
}
function pathExists(candidatePath) {
  return existsSync4(candidatePath);
}
async function discoverGitRoot(realPath, statType) {
  let current = statType === "directory" ? realPath : path6.dirname(realPath);
  while (true) {
    if (pathExists(path6.join(current, ".git"))) {
      return current;
    }
    const parent = path6.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
function resolveStatType(stats) {
  if (stats.isDirectory()) {
    return { ok: true, value: "directory" };
  }
  if (stats.isFile()) {
    return { ok: true, value: "file" };
  }
  return searchPathError(
    "INVALID_REQUEST",
    "search_path must point to a regular file or directory"
  );
}
async function resolveSearchPath(searchPath) {
  if (!pathExists(searchPath)) {
    return searchPathError("SEARCH_PATH_NOT_FOUND", `search_path '${searchPath}' does not exist`);
  }
  let realPath;
  try {
    realPath = realpathSync(searchPath);
  } catch (error2) {
    const code = error2.code;
    if (code === "ENOENT") {
      return searchPathError("SEARCH_PATH_NOT_FOUND", `search_path '${searchPath}' does not exist`);
    }
    return searchPathError("SEARCH_PATH_REALPATH_FAILED", `failed to canonicalize '${searchPath}'`);
  }
  let stats;
  try {
    stats = statSync3(realPath);
  } catch {
    return searchPathError(
      "SEARCH_PATH_REALPATH_FAILED",
      `failed to stat '${realPath}' after canonicalization`
    );
  }
  const statType = resolveStatType(stats);
  if (!statType.ok) {
    return statType;
  }
  return {
    ok: true,
    value: {
      realPath,
      statType: statType.value,
      gitRoot: await discoverGitRoot(realPath, statType.value)
    }
  };
}

// lib/fff-router/resolve-within.ts
import { realpathSync as realpathSync2, statSync as statSync4 } from "node:fs";
import path8 from "node:path";

// lib/fff-router/home-path.ts
import path7 from "node:path";
function invalid(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function joinHome(home, suffix) {
  return suffix ? path7.join(home, suffix) : home;
}
function expandHomePath(candidate, env = process.env) {
  const trimmed = candidate.trim();
  const home = env.HOME?.trim();
  if (trimmed === "~" || trimmed.startsWith("~/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path7.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice(2)) };
  }
  if (trimmed === "$HOME" || trimmed.startsWith("$HOME/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path7.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice("$HOME/".length)) };
  }
  if (trimmed === "${HOME}" || trimmed.startsWith("${HOME}/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path7.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice("${HOME}/".length)) };
  }
  return { ok: true, value: trimmed };
}

// lib/fff-router/resolve-within.ts
function invalid2(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function withinNotFound(within) {
  return {
    ok: false,
    error: {
      code: "WITHIN_NOT_FOUND",
      message: `within '${within}' does not exist`
    }
  };
}
function internalError(message) {
  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message
    }
  };
}
function validateAbsolutePath(candidate, field) {
  const trimmed = candidate.trim();
  if (trimmed === "") {
    return invalid2(`${field} must be a non-empty path`);
  }
  if (!path8.isAbsolute(trimmed)) {
    return invalid2(`${field} must be absolute`);
  }
  return { ok: true, value: trimmed };
}
function resolveStatType2(stats) {
  if (stats.isDirectory()) {
    return { ok: true, value: "directory" };
  }
  if (stats.isFile()) {
    return { ok: true, value: "file" };
  }
  return invalid2("within must point to a regular file or directory");
}
async function validateResolvedWithinEntry(candidate) {
  const within = validateAbsolutePath(candidate, "within");
  if (!within.ok) {
    return within;
  }
  let resolvedWithin;
  try {
    resolvedWithin = realpathSync2(within.value);
  } catch (error2) {
    const code = error2.code;
    if (code === "ENOENT") {
      return withinNotFound(within.value);
    }
    return internalError(`failed to canonicalize within '${within.value}'`);
  }
  let stats;
  try {
    stats = statSync4(resolvedWithin);
  } catch {
    return internalError(`failed to stat resolved within '${resolvedWithin}'`);
  }
  const statType = resolveStatType2(stats);
  if (!statType.ok) {
    return statType;
  }
  if (statType.value === "directory") {
    return {
      ok: true,
      value: {
        resolvedWithin,
        basePath: resolvedWithin
      }
    };
  }
  return {
    ok: true,
    value: {
      resolvedWithin,
      basePath: path8.dirname(resolvedWithin),
      fileRestriction: resolvedWithin
    }
  };
}
async function validateResolvedWithinPaths(args) {
  if (args.withinPaths.length === 0) {
    return invalid2("withinPaths must contain at least one entry");
  }
  const entries = [];
  for (const candidate of args.withinPaths) {
    const entry = await validateResolvedWithinEntry(candidate);
    if (!entry.ok) {
      return entry;
    }
    entries.push(entry.value);
  }
  const [primary, ...rest] = entries;
  return {
    ok: true,
    value: {
      resolvedWithin: primary.resolvedWithin,
      basePath: primary.basePath,
      ...primary.fileRestriction !== void 0 ? { fileRestriction: primary.fileRestriction } : {},
      ...rest.length > 0 ? { additionalEntries: rest } : {}
    }
  };
}

// lib/fff-router/routing.ts
import path9 from "node:path";
function invalidConfig(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function outsideAllowedScope(realPath) {
  return {
    ok: false,
    error: {
      code: "OUTSIDE_ALLOWED_SCOPE",
      message: `search_path '${realPath}' is outside a git repo and not under an allowlisted non-git prefix`
    }
  };
}
function normalizeAllowlistedPrefixes(config) {
  const normalized = /* @__PURE__ */ new Set();
  for (const entry of config.allowlistedNonGitPrefixes) {
    if (!path9.isAbsolute(entry.prefix)) {
      return invalidConfig("allowlisted non-git prefixes must be absolute paths");
    }
    normalized.add(path9.normalize(entry.prefix));
  }
  return {
    ok: true,
    value: [...normalized].sort((a, b) => b.length - a.length)
  };
}
function longestMatchingPrefix(realPath, prefixes) {
  for (const prefix of prefixes) {
    if (realPath === prefix || realPath.startsWith(prefix + path9.sep)) {
      return prefix;
    }
  }
  return null;
}
function deriveFirstChildRoot(prefix, realPath) {
  const relative = path9.relative(prefix, realPath);
  if (!relative || relative.startsWith("..") || path9.isAbsolute(relative)) {
    return null;
  }
  const firstSegment = relative.split(path9.sep)[0];
  if (!firstSegment) {
    return null;
  }
  return path9.join(prefix, firstSegment);
}
function deriveRoutingTarget(args) {
  if (args.gitRoot) {
    return {
      ok: true,
      value: {
        rootType: "git",
        persistenceRoot: path9.normalize(args.gitRoot),
        searchScope: args.realPath,
        ttlMs: args.config.ttl.gitMs
      }
    };
  }
  const prefixes = normalizeAllowlistedPrefixes(args.config);
  if (!prefixes.ok) {
    return prefixes;
  }
  const matchedPrefix = longestMatchingPrefix(args.realPath, prefixes.value);
  if (!matchedPrefix) {
    return outsideAllowedScope(args.realPath);
  }
  const persistenceRoot = deriveFirstChildRoot(matchedPrefix, args.realPath);
  if (!persistenceRoot) {
    return outsideAllowedScope(args.realPath);
  }
  return {
    ok: true,
    value: {
      rootType: "non-git",
      persistenceRoot,
      searchScope: args.realPath,
      ttlMs: args.config.ttl.nonGitMs
    }
  };
}

// lib/fff-router/coordinator.ts
var WorkerCallTimeoutError = class extends Error {
  constructor(timeoutMs) {
    super(`fff-mcp call timed out after ${timeoutMs}ms`);
    this.timeoutMs = timeoutMs;
  }
  timeoutMs;
};
function error(code, message, retryable) {
  return {
    ok: false,
    error: { code, message, ...retryable !== void 0 ? { retryable } : {} }
  };
}
function daemonRssBytes() {
  try {
    return process.memoryUsage().rss;
  } catch {
    return 0;
  }
}
function isStaleWorkerMessage(message) {
  return /\b(Not connected|EPIPE|ECONNRESET|EOF)\b/i.test(message) || /\b(transport|stdio|stream)\b.*\b(closed|ended|destroyed|disconnected)\b/i.test(message);
}
async function withTimeout(promise, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return await promise;
  }
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new WorkerCallTimeoutError(timeoutMs)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
function translateExcludePaths(validatedWithin, persistenceRoot, excludePaths) {
  const baseRelative = normalizeRelativePath(
    path10.relative(persistenceRoot, validatedWithin.basePath)
  );
  if (!baseRelative || baseRelative === ".") {
    return excludePaths;
  }
  return excludePaths.map(
    (excludePath) => normalizeRelativePath(path10.join(baseRelative, excludePath))
  );
}
function buildBackendRequest(args) {
  const base = {
    persistenceRoot: args.target.persistenceRoot,
    within: args.validatedWithin.resolvedWithin,
    basePath: args.validatedWithin.basePath,
    fileRestriction: args.validatedWithin.fileRestriction,
    additionalWithinEntries: args.validatedWithin.additionalEntries ?? [],
    ...args.request.glob ? { glob: args.request.glob } : {},
    extensions: args.request.extensions,
    excludePaths: translateExcludePaths(
      args.validatedWithin,
      args.target.persistenceRoot,
      args.request.excludePaths
    ),
    limit: args.request.limit,
    cursor: args.upstreamCursor
  };
  return args.request.tool === "find_files" ? { ...base, queryKind: "find_files", query: args.request.query } : {
    ...base,
    queryKind: "grep",
    patterns: args.request.patterns,
    literal: args.request.literal,
    contextLines: args.request.contextLines
  };
}
function toPublicResult(args) {
  const nextCursor = args.result.nextCursor ? encodeCursor({
    root: args.target.persistenceRoot,
    generation: args.lease.generation,
    request: args.request,
    upstreamCursor: args.result.nextCursor
  }) : null;
  const recommendation = args.result.summary?.readRecommendation;
  const readRecommendation = recommendation ? {
    path: recommendation.relativePath,
    absolutePath: path10.join(args.target.persistenceRoot, recommendation.relativePath),
    ...recommendation.reason ? { reason: recommendation.reason } : {}
  } : void 0;
  const displayText = args.result.renderedCompact ? args.result.renderedCompact.split(/\r?\n/).filter((line) => !/^cursor:\s*/.test(line.trim())).concat(nextCursor ? [`cursor: ${nextCursor}`] : []).join("\n") : void 0;
  const common = {
    root: args.target.persistenceRoot,
    backend: "fff-mcp",
    nextCursor,
    stats: {
      resultCount: args.result.items.length,
      ...args.result.summary?.shownCount !== void 0 ? { upstreamShownCount: args.result.summary.shownCount } : {},
      ...args.result.summary?.totalCount !== void 0 ? { upstreamTotalCount: args.result.summary.totalCount } : {},
      coldStart: args.lease.coldStart,
      workerId: args.lease.runtime.id,
      workerGeneration: args.lease.generation
    },
    ...readRecommendation ? { readRecommendation } : {},
    ...displayText ? { displayText } : {}
  };
  if (args.request.tool === "find_files") {
    return {
      tool: "find_files",
      ...common,
      items: args.result.items.map((item) => ({
        path: normalizeRelativePath(path10.relative(args.target.persistenceRoot, item.path)),
        absolutePath: item.path
      }))
    };
  }
  return {
    tool: "grep",
    ...common,
    items: args.result.items.map((item) => {
      if (!("line" in item)) {
        throw new Error("fff-mcp returned a file item for grep");
      }
      return {
        path: normalizeRelativePath(path10.relative(args.target.persistenceRoot, item.path)),
        absolutePath: item.path,
        line: item.line,
        text: item.text,
        ...item.column !== void 0 ? { column: item.column } : {},
        ...item.contextBefore ? { contextBefore: item.contextBefore } : {},
        ...item.contextAfter ? { contextAfter: item.contextAfter } : {},
        ...item.isDefinition ? { isDefinition: true } : {},
        ...item.definitionBody ? { definitionBody: item.definitionBody } : {}
      };
    })
  };
}
var RouterServiceImpl = class {
  constructor(deps) {
    this.deps = deps;
    this.validateWithin = deps.validateWithin ?? validateResolvedWithinPaths;
    this.resolvePath = deps.resolvePath ?? resolveSearchPath;
    this.writeDiagnostic = deps.writeDiagnostic ?? ((event) => console.error(JSON.stringify({ event: "fff-router.diagnostic", ...event })));
  }
  deps;
  validateWithin;
  resolvePath;
  writeDiagnostic;
  async resolveTarget(within) {
    const validatedWithin = await this.validateWithin({ withinPaths: within });
    if (!validatedWithin.ok) {
      return validatedWithin;
    }
    const entries = [
      {
        resolvedWithin: validatedWithin.value.resolvedWithin,
        basePath: validatedWithin.value.basePath,
        ...validatedWithin.value.fileRestriction ? { fileRestriction: validatedWithin.value.fileRestriction } : {}
      },
      ...validatedWithin.value.additionalEntries ?? []
    ];
    let target;
    for (const entry of entries) {
      const resolved = await this.resolvePath(entry.resolvedWithin);
      if (!resolved.ok) {
        const code = resolved.error.code === "SEARCH_PATH_NOT_FOUND" ? "WITHIN_NOT_FOUND" : resolved.error.code === "OUTSIDE_ALLOWED_SCOPE" ? "OUTSIDE_ALLOWED_SCOPE" : resolved.error.code === "INVALID_REQUEST" ? "INVALID_REQUEST" : "INTERNAL_ERROR";
        return error(code, resolved.error.message);
      }
      const routed = deriveRoutingTarget({
        realPath: resolved.value.realPath,
        statType: resolved.value.statType,
        gitRoot: resolved.value.gitRoot,
        config: this.deps.configRef.current
      });
      if (!routed.ok) {
        return routed;
      }
      if (target && routed.value.persistenceRoot !== target.persistenceRoot) {
        return error(
          "INVALID_REQUEST",
          `within paths must share one routing root; '${entry.resolvedWithin}' routes to '${routed.value.persistenceRoot}', not '${target.persistenceRoot}'`
        );
      }
      target ??= routed.value;
    }
    return {
      ok: true,
      value: { validatedWithin: validatedWithin.value, target }
    };
  }
  acquire(target) {
    return this.deps.workerPool.acquire({
      root: target.persistenceRoot,
      rootType: target.rootType,
      ttlMs: target.ttlMs,
      start: async () => await this.deps.adapter.startRuntime({
        persistenceRoot: target.persistenceRoot,
        supervision: {
          sampleIntervalMs: this.deps.configRef.current.runtime.processSampleIntervalMs,
          maxRssBytes: this.deps.configRef.current.limits.maxWorkerRssBytes,
          shutdownGraceMs: this.deps.configRef.current.runtime.processShutdownGraceMs,
          killGraceMs: this.deps.configRef.current.runtime.processKillGraceMs,
          orphanIdleTimeoutMs: this.deps.configRef.current.runtime.workerOrphanIdleTimeoutMs
        }
      })
    });
  }
  async executeAttempt(request, validatedWithin, target) {
    const acquired = await this.acquire(target);
    if (!acquired.ok) {
      return { kind: "error", error: acquired.error };
    }
    const lease = acquired.value;
    let invalidateReason;
    try {
      let upstreamCursor = null;
      if (request.cursor) {
        const decoded = decodeCursor({
          cursor: request.cursor,
          root: target.persistenceRoot,
          generation: lease.generation,
          request
        });
        if (!decoded.ok) {
          return { kind: "error", error: decoded.error };
        }
        upstreamCursor = decoded.value;
      }
      const backendRequest = buildBackendRequest({
        request,
        validatedWithin,
        target,
        upstreamCursor
      });
      lease.recordCallStart();
      let backendResult;
      try {
        backendResult = await withTimeout(
          this.deps.adapter.execute({ request: backendRequest, runtime: lease.runtime }),
          this.deps.configRef.current.runtime.toolTimeoutMs
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        lease.recordCallError(message);
        invalidateReason = message;
        if (caught instanceof WorkerCallTimeoutError) {
          return request.cursor ? {
            kind: "error",
            error: {
              code: "CURSOR_EXPIRED",
              message: "cursor expired because its worker timed out"
            }
          } : { kind: "retry", message };
        }
        return request.cursor ? {
          kind: "error",
          error: {
            code: "CURSOR_EXPIRED",
            message: "cursor expired because its worker failed"
          }
        } : { kind: "retry", message };
      }
      if (!backendResult.ok) {
        lease.recordCallError(backendResult.error.message);
        if (isStaleWorkerMessage(backendResult.error.message)) {
          invalidateReason = backendResult.error.message;
          return request.cursor ? {
            kind: "error",
            error: {
              code: "CURSOR_EXPIRED",
              message: "cursor expired because its worker restarted"
            }
          } : { kind: "retry", message: backendResult.error.message };
        }
        return {
          kind: "error",
          error: {
            code: backendResult.error.code === "WORKER_UNAVAILABLE" ? "WORKER_UNAVAILABLE" : "SEARCH_FAILED",
            message: backendResult.error.message,
            retryable: backendResult.error.code === "WORKER_UNAVAILABLE"
          }
        };
      }
      lease.recordCallSuccess();
      if (backendResult.value.diagnostics) {
        try {
          this.writeDiagnostic({
            root: target.persistenceRoot,
            tool: request.tool,
            diagnostics: backendResult.value.diagnostics
          });
        } catch {
        }
      }
      return {
        kind: "success",
        value: toPublicResult({
          request,
          target,
          lease,
          result: backendResult.value
        })
      };
    } finally {
      if (invalidateReason) {
        await this.deps.workerPool.invalidate(
          target.persistenceRoot,
          lease.generation,
          invalidateReason
        );
      }
      await lease.release();
    }
  }
  async execute(request) {
    const routed = await this.resolveTarget(request.within);
    if (!routed.ok) {
      return routed;
    }
    const first = await this.executeAttempt(
      request,
      routed.value.validatedWithin,
      routed.value.target
    );
    if (first.kind === "success") {
      return { ok: true, value: first.value };
    }
    if (first.kind === "error") {
      return { ok: false, error: first.error };
    }
    const second = await this.executeAttempt(
      request,
      routed.value.validatedWithin,
      routed.value.target
    );
    if (second.kind === "success") {
      return { ok: true, value: second.value };
    }
    return {
      ok: false,
      error: second.kind === "error" ? second.error : {
        code: "WORKER_UNAVAILABLE",
        message: `fff-mcp worker failed twice: ${second.message}`,
        retryable: true
      }
    };
  }
  async warm(within) {
    const diagnostics = [];
    const seen = /* @__PURE__ */ new Set();
    for (const candidate of within) {
      const routed = await this.resolveTarget([candidate]);
      if (!routed.ok) {
        return routed;
      }
      if (seen.has(routed.value.target.persistenceRoot)) {
        continue;
      }
      seen.add(routed.value.target.persistenceRoot);
      const acquired = await this.acquire(routed.value.target);
      if (!acquired.ok) {
        return acquired;
      }
      await acquired.value.release();
      const diagnostic = this.deps.workerPool.getDiagnostics().find(
        (entry) => entry.root === routed.value.target.persistenceRoot && entry.state !== "dead"
      );
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    }
    return { ok: true, value: diagnostics };
  }
  async evict(within) {
    const evicted = [];
    const seen = /* @__PURE__ */ new Set();
    for (const candidate of within) {
      const routed = await this.resolveTarget([candidate]);
      if (!routed.ok) {
        return routed;
      }
      const root = routed.value.target.persistenceRoot;
      if (seen.has(root)) {
        continue;
      }
      seen.add(root);
      if (await this.deps.workerPool.evict(root)) {
        evicted.push(root);
      }
    }
    return { ok: true, value: { evicted } };
  }
  status() {
    const workerResources = this.deps.workerPool.getResourceSummary();
    const daemonRss = daemonRssBytes();
    return {
      workers: this.deps.workerPool.getDiagnostics(),
      limits: this.deps.configRef.current.limits,
      resources: {
        ...workerResources,
        daemonRssBytes: daemonRss,
        totalRssBytes: daemonRss + workerResources.workerRssBytes
      }
    };
  }
  async close() {
    await this.deps.workerPool.closeAll();
  }
};
function createRouterService(deps) {
  return new RouterServiceImpl(deps);
}

// lib/fff-router/daemon-config.ts
import { createHash as createHash2 } from "node:crypto";
import { existsSync as existsSync5, mkdirSync as mkdirSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "node:fs";
import os4 from "node:os";
import { isIP } from "node:net";
import path11 from "node:path";
import { fileURLToPath } from "node:url";
var DEFAULT_DAEMON_HOST = "127.0.0.1";
var DAEMON_PROTOCOL_VERSION = "fff-router-v2";
var DEFAULT_DAEMON_PORT = 4319;
var DEFAULT_DAEMON_MCP_PATH = "/mcp";
var DEFAULT_BACKEND_TOOL_TIMEOUT_MS = 3e4;
var DEFAULT_SWEEP_INTERVAL_MS = 3e4;
var DEFAULT_RESTART_BACKOFF_MS = 1e3;
var DEFAULT_RESTART_BACKOFF_MAX_MS = 6e4;
var DEFAULT_PROCESS_SAMPLE_INTERVAL_MS = 5e3;
var DEFAULT_PROCESS_SHUTDOWN_GRACE_MS = 500;
var DEFAULT_PROCESS_KILL_GRACE_MS = 1e3;
var DEFAULT_WORKER_ORPHAN_IDLE_TIMEOUT_MS = 30 * 60 * 1e3;
var DEFAULT_DAEMON_IDLE_TIMEOUT_MS = 30 * 60 * 1e3;
var DEFAULT_MAX_WORKER_RSS_BYTES = 768 * 1024 * 1024;
var DEFAULT_MAX_TOTAL_WORKER_RSS_BYTES = 2 * 1024 * 1024 * 1024;
var moduleDir = path11.dirname(fileURLToPath(import.meta.url));
var PACKAGE_VERSION = "2.0.0";
var PACKAGE_MANAGER = "pnpm@11.19.0";
function hashFingerprint(value) {
  return createHash2("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
function packagedDaemonEntrypointPath() {
  const primaryCandidatePath = path11.resolve(moduleDir, "../../dist/bin/fff-routerd.js");
  const candidatePaths = [
    primaryCandidatePath,
    path11.resolve(moduleDir, "../../bin/fff-routerd.js")
  ];
  for (const candidatePath of candidatePaths) {
    if (existsSync5(candidatePath)) {
      return candidatePath;
    }
  }
  return primaryCandidatePath;
}
function contentFingerprint(pathValue) {
  try {
    return createHash2("sha256").update(readFileSync3(pathValue)).digest("hex");
  } catch {
    return "missing";
  }
}
function getDaemonSourceFingerprint(args = {}) {
  const env = args.env ?? process.env;
  if (env.FFF_ROUTER_DAEMON_SOURCE_FINGERPRINT) {
    return env.FFF_ROUTER_DAEMON_SOURCE_FINGERPRINT;
  }
  const daemonEntrypointPath = args.daemonEntrypointPath ?? env.FFF_ROUTER_DAEMON_BIN ?? env.FFF_ROUTER_DAEMON_ENTRYPOINT ?? (process.versions.perry ? process.execPath : packagedDaemonEntrypointPath());
  return hashFingerprint({
    packageVersion: PACKAGE_VERSION,
    daemonEntrypointPath,
    content: contentFingerprint(daemonEntrypointPath)
  });
}
function userHome(env) {
  return env.HOME || os4.homedir();
}
function configHome(env) {
  return env.XDG_CONFIG_HOME || path11.join(userHome(env), ".config");
}
function stateHome(env) {
  return env.XDG_STATE_HOME || path11.join(userHome(env), ".local", "state");
}
function getDefaultDaemonConfig() {
  return {
    host: DEFAULT_DAEMON_HOST,
    port: DEFAULT_DAEMON_PORT,
    mcpPath: DEFAULT_DAEMON_MCP_PATH
  };
}
function getDefaultRouterConfig() {
  return {
    allowlistedNonGitPrefixes: [],
    warmRoots: [],
    ttl: {
      gitMs: 60 * 60 * 1e3,
      nonGitMs: 15 * 60 * 1e3
    },
    limits: {
      maxWorkers: 12,
      maxNonGitWorkers: 4,
      maxWorkerRssBytes: DEFAULT_MAX_WORKER_RSS_BYTES,
      maxTotalWorkerRssBytes: DEFAULT_MAX_TOTAL_WORKER_RSS_BYTES
    },
    runtime: {
      toolTimeoutMs: DEFAULT_BACKEND_TOOL_TIMEOUT_MS,
      sweepIntervalMs: DEFAULT_SWEEP_INTERVAL_MS,
      restartBackoffMs: DEFAULT_RESTART_BACKOFF_MS,
      restartBackoffMaxMs: DEFAULT_RESTART_BACKOFF_MAX_MS,
      processSampleIntervalMs: DEFAULT_PROCESS_SAMPLE_INTERVAL_MS,
      processShutdownGraceMs: DEFAULT_PROCESS_SHUTDOWN_GRACE_MS,
      processKillGraceMs: DEFAULT_PROCESS_KILL_GRACE_MS,
      workerOrphanIdleTimeoutMs: DEFAULT_WORKER_ORPHAN_IDLE_TIMEOUT_MS,
      daemonIdleTimeoutMs: DEFAULT_DAEMON_IDLE_TIMEOUT_MS
    }
  };
}
function getDefaultDaemonReloadConfig() {
  return {
    router: getDefaultRouterConfig()
  };
}
function getDefaultDaemonFileConfig() {
  const daemon = getDefaultDaemonConfig();
  const reload = getDefaultDaemonReloadConfig();
  return {
    host: daemon.host,
    port: daemon.port,
    mcpPath: daemon.mcpPath,
    allowlist: [],
    warmRoots: [],
    ttl: { ...reload.router.ttl },
    limits: {
      maxWorkers: reload.router.limits.maxWorkers,
      maxNonGitWorkers: reload.router.limits.maxNonGitWorkers,
      maxWorkerRssBytes: reload.router.limits.maxWorkerRssBytes ?? DEFAULT_MAX_WORKER_RSS_BYTES,
      maxTotalWorkerRssBytes: reload.router.limits.maxTotalWorkerRssBytes ?? DEFAULT_MAX_TOTAL_WORKER_RSS_BYTES
    },
    runtime: {
      toolTimeoutMs: reload.router.runtime.toolTimeoutMs,
      sweepIntervalMs: reload.router.runtime.sweepIntervalMs,
      restartBackoffMs: reload.router.runtime.restartBackoffMs,
      restartBackoffMaxMs: reload.router.runtime.restartBackoffMaxMs ?? DEFAULT_RESTART_BACKOFF_MAX_MS,
      processSampleIntervalMs: reload.router.runtime.processSampleIntervalMs ?? DEFAULT_PROCESS_SAMPLE_INTERVAL_MS,
      processShutdownGraceMs: reload.router.runtime.processShutdownGraceMs ?? DEFAULT_PROCESS_SHUTDOWN_GRACE_MS,
      processKillGraceMs: reload.router.runtime.processKillGraceMs ?? DEFAULT_PROCESS_KILL_GRACE_MS,
      workerOrphanIdleTimeoutMs: reload.router.runtime.workerOrphanIdleTimeoutMs ?? DEFAULT_WORKER_ORPHAN_IDLE_TIMEOUT_MS,
      daemonIdleTimeoutMs: reload.router.runtime.daemonIdleTimeoutMs ?? DEFAULT_DAEMON_IDLE_TIMEOUT_MS
    }
  };
}
function serializeDefaultDaemonFileConfig() {
  return `${JSON.stringify(getDefaultDaemonFileConfig(), null, 2)}
`;
}
function getDaemonPolicyConfigPaths(args = {}) {
  const env = args.env ?? process.env;
  const dir = path11.join(configHome(env), "fff-routerd");
  return {
    dir,
    jsonPath: path11.join(dir, "config.json"),
    jsoncPath: path11.join(dir, "config.jsonc")
  };
}
function ensureDefaultConfigFile(paths) {
  mkdirSync2(paths.dir, { recursive: true });
  const text = serializeDefaultDaemonFileConfig();
  writeFileSync2(paths.jsonPath, text);
  return {
    path: paths.jsonPath,
    text
  };
}
function readPreferredDaemonPolicyFile(args = {}) {
  const paths = getDaemonPolicyConfigPaths(args);
  if (existsSync5(paths.jsonPath)) {
    return {
      path: paths.jsonPath,
      text: readFileSync3(paths.jsonPath, "utf8")
    };
  }
  if (existsSync5(paths.jsoncPath)) {
    return {
      path: paths.jsoncPath,
      text: readFileSync3(paths.jsoncPath, "utf8")
    };
  }
  return ensureDefaultConfigFile(paths);
}
function expectObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value;
}
function rejectUnknownKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(
      `${label} contains unknown field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`
    );
  }
}
function readOptionalNumber(value, label) {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}
function readOptionalNonNegativeInteger(value, label) {
  const parsed = readOptionalNumber(value, label);
  if (parsed == null) {
    return void 0;
  }
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}
function readOptionalPositiveInteger(value, label) {
  const parsed = readOptionalNonNegativeInteger(value, label);
  if (parsed === 0) {
    throw new Error(`${label} must be greater than zero`);
  }
  return parsed;
}
function readOptionalPort(value) {
  const parsed = readOptionalNumber(value, "port");
  if (parsed == null) {
    return void 0;
  }
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("port must be an integer between 1 and 65535");
  }
  return parsed;
}
function readOptionalMcpPath(value) {
  const parsed = readOptionalString(value, "mcpPath");
  if (parsed == null) {
    return void 0;
  }
  if (!parsed.startsWith("/")) {
    throw new Error("mcpPath must start with '/'");
  }
  if (parsed.includes("?") || parsed.includes("#")) {
    throw new Error("mcpPath must be a pathname without query or hash");
  }
  if (parsed === "/health" || parsed === "/control") {
    throw new Error(`mcpPath '${parsed}' is reserved`);
  }
  return parsed;
}
function readOptionalHost(value) {
  const host = readOptionalString(value, "host");
  if (host == null) {
    return void 0;
  }
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized !== "localhost" && normalized !== "::1" && !(isIP(normalized) === 4 && normalized.startsWith("127."))) {
    throw new Error("fff-routerd is machine-local; host must be localhost, 127.0.0.0/8, or ::1");
  }
  return host;
}
function readOptionalString(value, label) {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}
function readOptionalStringArray(value, label) {
  if (value == null) {
    return void 0;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value;
}
function expandPathEntries(entries, env) {
  return entries.map((prefix) => expandHomePath(prefix, env)).map((result) => {
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    return result.value;
  }).filter(Boolean).map((entry) => {
    if (!path11.isAbsolute(entry)) {
      throw new Error(`configured paths must be absolute or home-relative: '${entry}'`);
    }
    return path11.normalize(entry);
  });
}
function expandAllowlistEntries(entries, env) {
  return expandPathEntries(entries, env).map((prefix) => ({
    prefix,
    mode: "first-child-root"
  }));
}
function parseJsonWithComments(text) {
  let withoutComments = "";
  let index = 0;
  let inString = false;
  let stringQuote = '"';
  let escaped = false;
  while (index < text.length) {
    const current = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (inString) {
      withoutComments += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === stringQuote) {
        inString = false;
      }
      index += 1;
      continue;
    }
    if (current === '"' || current === "'") {
      inString = true;
      stringQuote = current;
      withoutComments += current;
      index += 1;
      continue;
    }
    if (current === "/" && next === "/") {
      index += 2;
      while (index < text.length && text[index] !== "\n") {
        index += 1;
      }
      continue;
    }
    if (current === "/" && next === "*") {
      index += 2;
      while (index < text.length) {
        if (text[index] === "*" && text[index + 1] === "/") {
          index += 2;
          break;
        }
        index += 1;
      }
      continue;
    }
    withoutComments += current;
    index += 1;
  }
  let normalized = "";
  index = 0;
  inString = false;
  escaped = false;
  while (index < withoutComments.length) {
    const current = withoutComments[index] ?? "";
    if (inString) {
      normalized += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === stringQuote) {
        inString = false;
      }
      index += 1;
      continue;
    }
    if (current === '"' || current === "'") {
      inString = true;
      stringQuote = current;
      normalized += current;
      index += 1;
      continue;
    }
    if (current === ",") {
      let lookahead = index + 1;
      while (lookahead < withoutComments.length && /\s/.test(withoutComments[lookahead] ?? "")) {
        lookahead += 1;
      }
      const nextNonWhitespace = withoutComments[lookahead] ?? "";
      if (nextNonWhitespace === "}" || nextNonWhitespace === "]") {
        index += 1;
        continue;
      }
    }
    normalized += current;
    index += 1;
  }
  return JSON.parse(normalized);
}
function normalizeDaemonFileConfig(raw, env) {
  const defaults = getDefaultDaemonFileConfig();
  const fileConfig = expectObject(raw, "fff-routerd config");
  rejectUnknownKeys(
    fileConfig,
    ["host", "port", "mcpPath", "allowlist", "warmRoots", "ttl", "limits", "runtime"],
    "fff-routerd config"
  );
  const ttl = fileConfig.ttl == null ? null : expectObject(fileConfig.ttl, "ttl");
  const limits = fileConfig.limits == null ? null : expectObject(fileConfig.limits, "limits");
  const runtime = fileConfig.runtime == null ? null : expectObject(fileConfig.runtime, "runtime");
  if (ttl) rejectUnknownKeys(ttl, ["gitMs", "nonGitMs"], "ttl");
  if (limits) {
    rejectUnknownKeys(
      limits,
      ["maxWorkers", "maxNonGitWorkers", "maxWorkerRssBytes", "maxTotalWorkerRssBytes"],
      "limits"
    );
  }
  if (runtime) {
    rejectUnknownKeys(
      runtime,
      [
        "toolTimeoutMs",
        "sweepIntervalMs",
        "restartBackoffMs",
        "restartBackoffMaxMs",
        "processSampleIntervalMs",
        "processShutdownGraceMs",
        "processKillGraceMs",
        "workerOrphanIdleTimeoutMs",
        "daemonIdleTimeoutMs"
      ],
      "runtime"
    );
  }
  const normalizedEnv = { ...env, HOME: userHome(env) };
  const allowlist = readOptionalStringArray(fileConfig.allowlist, "allowlist") ?? defaults.allowlist;
  const warmRoots = readOptionalStringArray(fileConfig.warmRoots, "warmRoots") ?? defaults.warmRoots;
  const host = readOptionalHost(fileConfig.host) ?? defaults.host;
  const port = readOptionalPort(fileConfig.port) ?? defaults.port;
  const mcpPath = readOptionalMcpPath(fileConfig.mcpPath) ?? defaults.mcpPath;
  const ttlGitMs = readOptionalNonNegativeInteger(ttl?.gitMs, "ttl.gitMs") ?? defaults.ttl.gitMs;
  const ttlNonGitMs = readOptionalNonNegativeInteger(ttl?.nonGitMs, "ttl.nonGitMs") ?? defaults.ttl.nonGitMs;
  const maxWorkers = readOptionalPositiveInteger(limits?.maxWorkers, "limits.maxWorkers") ?? defaults.limits.maxWorkers;
  const maxNonGitWorkers = readOptionalNonNegativeInteger(limits?.maxNonGitWorkers, "limits.maxNonGitWorkers") ?? defaults.limits.maxNonGitWorkers;
  if (maxNonGitWorkers > maxWorkers) {
    throw new Error("limits.maxNonGitWorkers must not exceed limits.maxWorkers");
  }
  const maxWorkerRssBytes = readOptionalPositiveInteger(limits?.maxWorkerRssBytes, "limits.maxWorkerRssBytes") ?? defaults.limits.maxWorkerRssBytes;
  const maxTotalWorkerRssBytes = readOptionalPositiveInteger(limits?.maxTotalWorkerRssBytes, "limits.maxTotalWorkerRssBytes") ?? defaults.limits.maxTotalWorkerRssBytes;
  if (maxTotalWorkerRssBytes < maxWorkerRssBytes) {
    throw new Error("limits.maxTotalWorkerRssBytes must be at least limits.maxWorkerRssBytes");
  }
  const toolTimeoutMs = readOptionalNonNegativeInteger(runtime?.toolTimeoutMs, "runtime.toolTimeoutMs") ?? defaults.runtime.toolTimeoutMs;
  const sweepIntervalMs = readOptionalNonNegativeInteger(runtime?.sweepIntervalMs, "runtime.sweepIntervalMs") ?? defaults.runtime.sweepIntervalMs;
  const restartBackoffMs = readOptionalNonNegativeInteger(runtime?.restartBackoffMs, "runtime.restartBackoffMs") ?? defaults.runtime.restartBackoffMs;
  const restartBackoffMaxMs = readOptionalNonNegativeInteger(runtime?.restartBackoffMaxMs, "runtime.restartBackoffMaxMs") ?? defaults.runtime.restartBackoffMaxMs;
  if (restartBackoffMaxMs < restartBackoffMs) {
    throw new Error("runtime.restartBackoffMaxMs must be at least runtime.restartBackoffMs");
  }
  const processSampleIntervalMs = readOptionalNonNegativeInteger(
    runtime?.processSampleIntervalMs,
    "runtime.processSampleIntervalMs"
  ) ?? defaults.runtime.processSampleIntervalMs;
  const processShutdownGraceMs = readOptionalNonNegativeInteger(
    runtime?.processShutdownGraceMs,
    "runtime.processShutdownGraceMs"
  ) ?? defaults.runtime.processShutdownGraceMs;
  const processKillGraceMs = readOptionalNonNegativeInteger(runtime?.processKillGraceMs, "runtime.processKillGraceMs") ?? defaults.runtime.processKillGraceMs;
  const workerOrphanIdleTimeoutMs = readOptionalNonNegativeInteger(
    runtime?.workerOrphanIdleTimeoutMs,
    "runtime.workerOrphanIdleTimeoutMs"
  ) ?? defaults.runtime.workerOrphanIdleTimeoutMs;
  const daemonIdleTimeoutMs = readOptionalNonNegativeInteger(runtime?.daemonIdleTimeoutMs, "runtime.daemonIdleTimeoutMs") ?? defaults.runtime.daemonIdleTimeoutMs;
  return {
    daemon: {
      host,
      port,
      mcpPath
    },
    reload: {
      router: {
        allowlistedNonGitPrefixes: expandAllowlistEntries(allowlist, normalizedEnv),
        warmRoots: expandPathEntries(warmRoots, normalizedEnv),
        ttl: {
          gitMs: ttlGitMs,
          nonGitMs: ttlNonGitMs
        },
        limits: {
          maxWorkers,
          maxNonGitWorkers,
          maxWorkerRssBytes,
          maxTotalWorkerRssBytes
        },
        runtime: {
          toolTimeoutMs,
          sweepIntervalMs,
          restartBackoffMs,
          restartBackoffMaxMs,
          processSampleIntervalMs,
          processShutdownGraceMs,
          processKillGraceMs,
          workerOrphanIdleTimeoutMs,
          daemonIdleTimeoutMs
        }
      }
    }
  };
}
function readDaemonConfigFromMetadata(args = {}) {
  const paths = getDaemonPaths(args);
  if (!existsSync5(paths.metadataPath)) {
    return null;
  }
  try {
    const metadata = JSON.parse(readFileSync3(paths.metadataPath, "utf8"));
    if (typeof metadata.host !== "string" || typeof metadata.port !== "number" || typeof metadata.mcpPath !== "string") {
      return null;
    }
    return {
      host: metadata.host,
      port: metadata.port,
      mcpPath: metadata.mcpPath
    };
  } catch {
    return null;
  }
}
function loadNormalizedDaemonFileConfig(args = {}) {
  const env = args.env ?? process.env;
  const configFile = readPreferredDaemonPolicyFile({ env });
  return normalizeDaemonFileConfig(parseJsonWithComments(configFile.text), env);
}
function getDaemonConfig(args = {}) {
  try {
    return loadNormalizedDaemonFileConfig(args).daemon;
  } catch (error2) {
    const fallback = readDaemonConfigFromMetadata(args);
    if (fallback) {
      return fallback;
    }
    throw error2;
  }
}
function formatDaemonUrlHost(host) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}
function getDaemonOriginFromConfig(config) {
  return `http://${formatDaemonUrlHost(config.host)}:${config.port}`;
}
function getDaemonEndpoint(args = {}) {
  const config = getDaemonConfig(args);
  return `${getDaemonOriginFromConfig(config)}${config.mcpPath}`;
}
function loadDaemonReloadConfig(args = {}) {
  return loadNormalizedDaemonFileConfig(args).reload;
}
function getDaemonServerFingerprint(args = {}) {
  const daemon = getDaemonConfig({ env: args.env });
  return hashFingerprint({
    daemon: {
      ...daemon,
      ...args.daemonConfig
    },
    protocolVersion: DAEMON_PROTOCOL_VERSION,
    daemonSourceFingerprint: getDaemonSourceFingerprint({ env: args.env })
  });
}
function getDaemonReloadFingerprintForConfig(config) {
  return hashFingerprint(config);
}
function getDaemonReloadFingerprint(args = {}) {
  return getDaemonReloadFingerprintForConfig(loadDaemonReloadConfig(args));
}
function getDaemonConfigFingerprint(args = {}) {
  return hashFingerprint({
    serverFingerprint: getDaemonServerFingerprint(args),
    reloadFingerprint: getDaemonReloadFingerprint(args)
  });
}
function getDaemonPaths(args = {}) {
  const env = args.env ?? process.env;
  const dir = path11.join(stateHome(env), "fff-routerd");
  return {
    dir,
    authTokenPath: path11.join(dir, "auth-token"),
    metadataPath: path11.join(dir, "daemon.json"),
    lockPath: path11.join(dir, "startup.lock"),
    stdoutLogPath: path11.join(dir, "daemon.stdout.log"),
    stderrLogPath: path11.join(dir, "daemon.stderr.log")
  };
}

// lib/fff-router/http-daemon.ts
import { createServer } from "node:http";
import { isIP as isIP2 } from "node:net";
import {
  existsSync as existsSync7,
  mkdirSync as mkdirSync4,
  readFileSync as readFileSync5,
  renameSync as renameSync2,
  rmSync as rmSync3,
  statSync as statSync5,
  writeFileSync as writeFileSync4
} from "node:fs";

// lib/fff-router/mcp-tools.ts
import path13 from "node:path";

// lib/fff-router/public-api.ts
import path12 from "node:path";
var MAX_RESULTS = 50;
var MAX_CONTEXT_LINES = 5;
var MAX_PATTERNS = 20;
var MAX_FILTERS = 30;
var MAX_WITHIN_PATHS = 10;
var MAX_QUERY_LENGTH = 1024;
var ProtocolValidationError = class extends Error {
  constructor(issues) {
    super(issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`).join("; "));
    this.issues = issues;
  }
  issues;
};
function runtimeSchema(jsonSchema, validate) {
  const schema = { ...jsonSchema };
  Object.defineProperties(schema, {
    // Runtime helpers must not leak into tools/list JSON Schema or create a
    // self-reference when the response is serialized.
    jsonSchema: { value: schema, enumerable: false },
    safeParse: { value: validate, enumerable: false },
    parse: {
      enumerable: false,
      value(value) {
        const result = validate(value);
        if (!result.success) {
          throw new ProtocolValidationError(result.error.issues);
        }
        return result.data;
      }
    }
  });
  return schema;
}
function valid(data) {
  return { success: true, data };
}
function invalidValue(pathValue, message) {
  return { success: false, error: { issues: [{ path: pathValue, message }] } };
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function rejectUnknownFields(value, allowed) {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  return unknown ? invalidValue([unknown], "unknown field") : valid(void 0);
}
function readBoundedString(value, field, options) {
  if (typeof value !== "string") {
    return invalidValue([field], "must be a string");
  }
  const normalized = options.trim ? value.trim() : value;
  if (!options.allowBlank && normalized.length === 0) {
    return invalidValue([field], "must not be blank");
  }
  if (normalized.length > options.max) {
    return invalidValue([field], `must contain at most ${options.max} characters`);
  }
  return valid(normalized);
}
function readStringArray(value, field, options) {
  if (!Array.isArray(value)) {
    return invalidValue([field], "must be an array");
  }
  if (value.length < (options.minItems ?? 0)) {
    return invalidValue([field], `must contain at least ${options.minItems ?? 0} item(s)`);
  }
  if (value.length > options.maxItems) {
    return invalidValue([field], `must contain at most ${options.maxItems} item(s)`);
  }
  const output = [];
  for (let index = 0; index < value.length; index += 1) {
    const parsed = readBoundedString(value[index], `${field}.${index}`, {
      max: options.maxLength,
      trim: true
    });
    if (!parsed.success) {
      return parsed;
    }
    output.push(parsed.data);
  }
  return valid(output);
}
function readWithinInput(value) {
  if (typeof value === "string") {
    return readBoundedString(value, "within", { max: 4096, trim: true });
  }
  return readStringArray(value, "within", {
    minItems: 1,
    maxItems: MAX_WITHIN_PATHS,
    maxLength: 4096
  });
}
function normalizeRelativeFilter(value, field) {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (path12.posix.isAbsolute(normalized)) {
    return invalidValue([field], "path filters must be relative");
  }
  if (normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    return invalidValue(
      [field],
      "path filters must not contain empty, current-directory, or parent-directory segments"
    );
  }
  return valid(normalized);
}
function readRelativeFilters(value, field) {
  if (value === void 0) {
    return valid([]);
  }
  const values = readStringArray(value, field, { maxItems: MAX_FILTERS, maxLength: 512 });
  if (!values.success) {
    return values;
  }
  const normalized = [];
  for (let index = 0; index < values.data.length; index += 1) {
    const parsed = normalizeRelativeFilter(values.data[index], `${field}.${index}`);
    if (!parsed.success) {
      return parsed;
    }
    normalized.push(parsed.data);
  }
  return valid([...new Set(normalized)]);
}
function readExtensions(value) {
  if (value === void 0) {
    return valid([]);
  }
  const values = readStringArray(value, "extensions", {
    maxItems: MAX_FILTERS,
    maxLength: 64
  });
  if (!values.success) {
    return values;
  }
  const normalized = [];
  for (let index = 0; index < values.data.length; index += 1) {
    const extension = values.data[index].replace(/^\./, "");
    if (!/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(extension)) {
      return invalidValue(
        ["extensions", index],
        "extensions must be literal suffixes without path or glob syntax"
      );
    }
    normalized.push(extension);
  }
  return valid([...new Set(normalized)]);
}
function readInteger(value, field, options) {
  if (value === void 0) {
    return valid(options.fallback);
  }
  if (!Number.isInteger(value) || value < options.min || value > options.max) {
    return invalidValue([field], `must be an integer between ${options.min} and ${options.max}`);
  }
  return valid(value);
}
function readCursor(value) {
  if (value === void 0 || value === null) {
    return valid(null);
  }
  return readBoundedString(value, "cursor", { max: 4096, trim: false });
}
var JSON_SCHEMA_2020_12 = "https://json-schema.org/draft/2020-12/schema";
var withinJsonSchema = {
  oneOf: [
    { type: "string", minLength: 1, maxLength: 4096 },
    {
      type: "array",
      minItems: 1,
      maxItems: MAX_WITHIN_PATHS,
      items: { type: "string", minLength: 1, maxLength: 4096 }
    }
  ]
};
var commonJsonSchemaProperties = {
  within: withinJsonSchema,
  glob: { type: "string", minLength: 1, maxLength: 512 },
  extensions: {
    type: "array",
    maxItems: MAX_FILTERS,
    items: { type: "string", minLength: 1, maxLength: 64 },
    default: []
  },
  excludePaths: {
    type: "array",
    maxItems: MAX_FILTERS,
    items: { type: "string", minLength: 1, maxLength: 512 },
    default: []
  },
  limit: { type: "integer", minimum: 1, maximum: MAX_RESULTS, default: 20 },
  cursor: { type: ["string", "null"], minLength: 1, maxLength: 4096, default: null }
};
function parseCommonInput(record) {
  const within = readWithinInput(record.within);
  if (!within.success) return within;
  const extensions = readExtensions(record.extensions);
  if (!extensions.success) return extensions;
  const excludePaths = readRelativeFilters(record.excludePaths, "excludePaths");
  if (!excludePaths.success) return excludePaths;
  const limit = readInteger(record.limit, "limit", { min: 1, max: MAX_RESULTS, fallback: 20 });
  if (!limit.success) return limit;
  const cursor = readCursor(record.cursor);
  if (!cursor.success) return cursor;
  let globValue;
  if (record.glob !== void 0) {
    const globString = readBoundedString(record.glob, "glob", { max: 512, trim: true });
    if (!globString.success) return globString;
    const glob = normalizeRelativeFilter(globString.data, "glob");
    if (!glob.success) return glob;
    if (glob.data.startsWith("!")) {
      return invalidValue(["glob"], "glob is an include filter; use excludePaths for exclusions");
    }
    globValue = glob.data;
  }
  return valid({
    within: within.data,
    ...globValue ? { glob: globValue } : {},
    extensions: extensions.data,
    excludePaths: excludePaths.data,
    limit: limit.data,
    cursor: cursor.data
  });
}
function parseFindFilesInput(value) {
  if (!isRecord2(value)) return invalidValue([], "request must be an object");
  const known = rejectUnknownFields(value, [
    "query",
    "within",
    "glob",
    "extensions",
    "excludePaths",
    "limit",
    "cursor"
  ]);
  if (!known.success) return known;
  const query = readBoundedString(value.query, "query", { max: MAX_QUERY_LENGTH, trim: true });
  if (!query.success) return query;
  const common = parseCommonInput(value);
  return common.success ? valid({ query: query.data, ...common.data }) : common;
}
function parseGrepInput(value) {
  if (!isRecord2(value)) return invalidValue([], "request must be an object");
  const known = rejectUnknownFields(value, [
    "patterns",
    "literal",
    "contextLines",
    "within",
    "glob",
    "extensions",
    "excludePaths",
    "limit",
    "cursor"
  ]);
  if (!known.success) return known;
  const patterns = readStringArray(value.patterns, "patterns", {
    minItems: 1,
    maxItems: MAX_PATTERNS,
    maxLength: MAX_QUERY_LENGTH
  });
  if (!patterns.success) return patterns;
  if (value.literal !== void 0 && typeof value.literal !== "boolean") {
    return invalidValue(["literal"], "must be a boolean");
  }
  const contextLines = readInteger(value.contextLines, "contextLines", {
    min: 0,
    max: MAX_CONTEXT_LINES,
    fallback: 0
  });
  if (!contextLines.success) return contextLines;
  const common = parseCommonInput(value);
  if (!common.success) return common;
  return valid({
    patterns: patterns.data,
    literal: value.literal === void 0 ? true : value.literal,
    contextLines: contextLines.data,
    ...common.data
  });
}
var findFilesInputSchema = runtimeSchema(
  {
    $schema: JSON_SCHEMA_2020_12,
    type: "object",
    additionalProperties: false,
    required: ["query", "within"],
    properties: {
      query: { type: "string", minLength: 1, maxLength: MAX_QUERY_LENGTH },
      ...commonJsonSchemaProperties
    }
  },
  parseFindFilesInput
);
var grepInputSchema = runtimeSchema(
  {
    $schema: JSON_SCHEMA_2020_12,
    type: "object",
    additionalProperties: false,
    required: ["patterns", "within"],
    properties: {
      patterns: {
        type: "array",
        minItems: 1,
        maxItems: MAX_PATTERNS,
        items: { type: "string", minLength: 1, maxLength: MAX_QUERY_LENGTH }
      },
      literal: { type: "boolean", default: true },
      contextLines: {
        type: "integer",
        minimum: 0,
        maximum: MAX_CONTEXT_LINES,
        default: 0
      },
      ...commonJsonSchemaProperties
    }
  },
  parseGrepInput
);
var fileHitJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["path", "absolutePath"],
  properties: { path: { type: "string" }, absolutePath: { type: "string" } }
};
var textHitJsonSchema = {
  type: "object",
  required: ["path", "absolutePath", "line", "text"],
  properties: {
    ...fileHitJsonSchema.properties,
    line: { type: "integer", minimum: 1 },
    text: { type: "string" },
    column: { type: "integer", minimum: 0 },
    contextBefore: { type: "array", items: { type: "string" } },
    contextAfter: { type: "array", items: { type: "string" } },
    isDefinition: { type: "boolean" },
    definitionBody: { type: "array", items: { type: "string" } }
  }
};
var searchResultStatsJsonSchema = {
  type: "object",
  required: ["resultCount", "coldStart", "workerId", "workerGeneration"],
  properties: {
    resultCount: { type: "integer", minimum: 0 },
    upstreamShownCount: { type: "integer", minimum: 0 },
    upstreamTotalCount: { type: "integer", minimum: 0 },
    coldStart: { type: "boolean" },
    workerId: { type: "string", minLength: 1 },
    workerGeneration: { type: "integer", minimum: 1 }
  }
};
function validateFileHit(value, pathPrefix) {
  if (!isRecord2(value)) return invalidValue(pathPrefix, "must be an object");
  if (typeof value.path !== "string")
    return invalidValue([...pathPrefix, "path"], "must be a string");
  if (typeof value.absolutePath !== "string") {
    return invalidValue([...pathPrefix, "absolutePath"], "must be a string");
  }
  return valid(void 0);
}
function validateStats(value) {
  if (!isRecord2(value)) return invalidValue(["stats"], "must be an object");
  if (!Number.isInteger(value.resultCount) || value.resultCount < 0) {
    return invalidValue(["stats", "resultCount"], "must be a non-negative integer");
  }
  if (typeof value.coldStart !== "boolean")
    return invalidValue(["stats", "coldStart"], "must be a boolean");
  if (typeof value.workerId !== "string" || value.workerId.length === 0) {
    return invalidValue(["stats", "workerId"], "must be a non-empty string");
  }
  if (!Number.isInteger(value.workerGeneration) || value.workerGeneration < 1) {
    return invalidValue(["stats", "workerGeneration"], "must be a positive integer");
  }
  return valid(void 0);
}
function validateSearchResultBase(value, expectedTool) {
  if (!isRecord2(value)) return invalidValue([], "result must be an object");
  if (value.tool !== expectedTool) return invalidValue(["tool"], `must equal '${expectedTool}'`);
  if (typeof value.root !== "string") return invalidValue(["root"], "must be a string");
  if (value.backend !== "fff-mcp") return invalidValue(["backend"], "must equal 'fff-mcp'");
  if (value.nextCursor !== null && typeof value.nextCursor !== "string") {
    return invalidValue(["nextCursor"], "must be a string or null");
  }
  const stats = validateStats(value.stats);
  if (!stats.success) return stats;
  if (!Array.isArray(value.items)) return invalidValue(["items"], "must be an array");
  return valid(value);
}
var findFilesResultJsonSchema = {
  $schema: JSON_SCHEMA_2020_12,
  type: "object",
  required: ["tool", "root", "backend", "items", "nextCursor", "stats"],
  properties: {
    tool: { const: "find_files" },
    root: { type: "string" },
    backend: { const: "fff-mcp" },
    items: { type: "array", items: fileHitJsonSchema },
    nextCursor: { type: ["string", "null"] },
    stats: searchResultStatsJsonSchema
  }
};
var grepResultJsonSchema = {
  $schema: JSON_SCHEMA_2020_12,
  type: "object",
  required: ["tool", "root", "backend", "items", "nextCursor", "stats"],
  properties: {
    tool: { const: "grep" },
    root: { type: "string" },
    backend: { const: "fff-mcp" },
    items: { type: "array", items: textHitJsonSchema },
    nextCursor: { type: ["string", "null"] },
    stats: searchResultStatsJsonSchema
  }
};
var findFilesResultSchema = runtimeSchema(
  findFilesResultJsonSchema,
  (value) => {
    const base = validateSearchResultBase(value, "find_files");
    if (!base.success) return base;
    const items = base.data.items;
    for (let index = 0; index < items.length; index += 1) {
      const item = validateFileHit(items[index], ["items", index]);
      if (!item.success) return item;
    }
    return valid(value);
  }
);
var grepResultSchema = runtimeSchema(grepResultJsonSchema, (value) => {
  const base = validateSearchResultBase(value, "grep");
  if (!base.success) return base;
  const items = base.data.items;
  for (let index = 0; index < items.length; index += 1) {
    const item = validateFileHit(items[index], ["items", index]);
    if (!item.success) return item;
    const record = items[index];
    if (!Number.isInteger(record.line) || record.line < 1) {
      return invalidValue(["items", index, "line"], "must be a positive integer");
    }
    if (typeof record.text !== "string") {
      return invalidValue(["items", index, "text"], "must be a string");
    }
  }
  return valid(value);
});
var publicToolResultSchema = runtimeSchema(
  { oneOf: [findFilesResultJsonSchema, grepResultJsonSchema] },
  (value) => isRecord2(value) && value.tool === "find_files" ? findFilesResultSchema.safeParse(value) : grepResultSchema.safeParse(value)
);
function validateWorkerDiagnostic(value, index) {
  if (!isRecord2(value)) return invalidValue(["workers", index], "must be an object");
  if (typeof value.root !== "string")
    return invalidValue(["workers", index, "root"], "must be a string");
  if (value.rootType !== "git" && value.rootType !== "non-git") {
    return invalidValue(["workers", index, "rootType"], "must be 'git' or 'non-git'");
  }
  if (!["starting", "ready", "draining", "dead"].includes(String(value.state))) {
    return invalidValue(["workers", index, "state"], "invalid worker state");
  }
  if (!Number.isInteger(value.generation) || value.generation < 1) {
    return invalidValue(["workers", index, "generation"], "must be a positive integer");
  }
  if (!Number.isInteger(value.activeLeases) || value.activeLeases < 0) {
    return invalidValue(["workers", index, "activeLeases"], "must be a non-negative integer");
  }
  return valid(void 0);
}
var workerDiagnosticJsonSchema = {
  type: "object",
  required: [
    "root",
    "rootType",
    "state",
    "generation",
    "activeLeases",
    "lastUsedAt",
    "failureCount"
  ],
  properties: {
    root: { type: "string" },
    rootType: { enum: ["git", "non-git"] },
    state: { enum: ["starting", "ready", "draining", "dead"] },
    workerId: { type: "string" },
    pid: { type: ["integer", "null"] },
    generation: { type: "integer", minimum: 1 },
    activeLeases: { type: "integer", minimum: 0 },
    startedAt: { type: "number", minimum: 0 },
    lastUsedAt: { type: "number", minimum: 0 },
    lastCallAt: { type: "number", minimum: 0 },
    lastSuccessAt: { type: "number", minimum: 0 },
    lastError: { type: "string" },
    lastErrorAt: { type: "number", minimum: 0 },
    failureCount: { type: "integer", minimum: 0 },
    retryAfter: { type: "number", minimum: 0 },
    resources: {
      type: "object",
      properties: {
        sampledAt: { type: "number", minimum: 0 },
        rssBytes: { type: "integer", minimum: 0 },
        cpuTimeMs: { type: "number", minimum: 0 },
        threads: { type: "integer", minimum: 0 },
        processCount: { type: "integer", minimum: 1 }
      }
    },
    terminationReason: { type: "string" }
  }
};
var routerStatusJsonSchema = {
  $schema: JSON_SCHEMA_2020_12,
  type: "object",
  required: ["workers", "limits"],
  properties: {
    workers: { type: "array", items: workerDiagnosticJsonSchema },
    limits: {
      type: "object",
      required: ["maxWorkers", "maxNonGitWorkers"],
      properties: {
        maxWorkers: { type: "integer", minimum: 1 },
        maxNonGitWorkers: { type: "integer", minimum: 0 },
        maxWorkerRssBytes: { type: "integer", minimum: 1 },
        maxTotalWorkerRssBytes: { type: "integer", minimum: 1 }
      }
    },
    resources: {
      type: "object",
      properties: {
        sampledAt: { type: "number", minimum: 0 },
        daemonRssBytes: { type: "integer", minimum: 0 },
        workerRssBytes: { type: "integer", minimum: 0 },
        totalRssBytes: { type: "integer", minimum: 0 },
        measuredWorkers: { type: "integer", minimum: 0 }
      }
    }
  }
};
var routerStatusSchema = runtimeSchema(routerStatusJsonSchema, (value) => {
  if (!isRecord2(value)) return invalidValue([], "status must be an object");
  if (!Array.isArray(value.workers)) return invalidValue(["workers"], "must be an array");
  for (let index = 0; index < value.workers.length; index += 1) {
    const worker = validateWorkerDiagnostic(value.workers[index], index);
    if (!worker.success) return worker;
  }
  if (!isRecord2(value.limits)) return invalidValue(["limits"], "must be an object");
  if (!Number.isInteger(value.limits.maxWorkers) || value.limits.maxWorkers < 1) {
    return invalidValue(["limits", "maxWorkers"], "must be a positive integer");
  }
  if (!Number.isInteger(value.limits.maxNonGitWorkers) || value.limits.maxNonGitWorkers < 0) {
    return invalidValue(["limits", "maxNonGitWorkers"], "must be a non-negative integer");
  }
  return valid(value);
});
var warmResultJsonSchema = {
  type: "object",
  required: ["workers"],
  properties: { workers: { type: "array", items: workerDiagnosticJsonSchema } }
};
var warmResultSchema = runtimeSchema(
  warmResultJsonSchema,
  (value) => {
    if (!isRecord2(value) || !Array.isArray(value.workers)) {
      return invalidValue(["workers"], "must be an array");
    }
    for (let index = 0; index < value.workers.length; index += 1) {
      const worker = validateWorkerDiagnostic(value.workers[index], index);
      if (!worker.success) return worker;
    }
    return valid(value);
  }
);
var evictResultJsonSchema = {
  type: "object",
  required: ["evicted"],
  properties: { evicted: { type: "array", items: { type: "string" } } }
};
var evictResultSchema = runtimeSchema(
  evictResultJsonSchema,
  (value) => isRecord2(value) && Array.isArray(value.evicted) && value.evicted.every((item) => typeof item === "string") ? valid(value) : invalidValue(["evicted"], "must be an array of strings")
);
var PUBLIC_TOOL_DEFINITIONS = [
  {
    name: "find_files",
    description: "Fuzzy-search file names and paths using a shared warm fff-mcp index. within must be one or more absolute paths under the same repository or configured non-Git root.",
    inputSchema: findFilesInputSchema,
    outputSchema: findFilesResultJsonSchema
  },
  {
    name: "grep",
    description: "Search file contents through a shared warm fff-mcp index. Multiple patterns use OR semantics; literal matching is the safe default and regex matching must be selected explicitly.",
    inputSchema: grepInputSchema,
    outputSchema: grepResultJsonSchema
  }
];
function invalid3(message) {
  return { ok: false, error: { code: "INVALID_REQUEST", message } };
}
function formatValidationError(error2) {
  return error2.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "request"}: ${issue.message}`).join("; ");
}
function normalizeWithin(value, env) {
  const values = Array.isArray(value) ? value : [value];
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of values) {
    const expanded = expandHomePath(entry.trim(), env);
    if (!expanded.ok) return invalid3(expanded.error.message);
    if (!path12.isAbsolute(expanded.value)) {
      return invalid3("within paths must be absolute on the daemon wire protocol");
    }
    const clean = path12.normalize(expanded.value);
    if (seen.has(clean)) return invalid3(`within contains duplicate path '${clean}'`);
    seen.add(clean);
    normalized.push(clean);
  }
  return { ok: true, value: normalized };
}
function rejectWildcardOnlyRegex(patterns, literal) {
  if (literal) return { ok: true, value: void 0 };
  const wildcardOnly = /^(?:[.^$]*(?:[.][*+?]|[*+])[.^$]*|[.^$\s]*|\.\*[+?]?|\.\+[?]?|[.*?])$/;
  const rejected = patterns.find((pattern) => wildcardOnly.test(pattern.trim()));
  return rejected ? invalid3(`regex '${rejected}' matches everything; provide a concrete expression`) : { ok: true, value: void 0 };
}
function normalizePublicToolInput(tool, input, env = process.env) {
  const parsed = tool === "find_files" ? findFilesInputSchema.safeParse(input) : grepInputSchema.safeParse(input);
  if (!parsed.success) return invalid3(formatValidationError(parsed.error));
  const resolvedWithin = normalizeWithin(parsed.data.within, env);
  if (!resolvedWithin.ok) return resolvedWithin;
  const common = {
    within: resolvedWithin.value,
    ...parsed.data.glob ? { glob: parsed.data.glob } : {},
    extensions: parsed.data.extensions,
    excludePaths: parsed.data.excludePaths,
    limit: parsed.data.limit,
    cursor: parsed.data.cursor
  };
  if (tool === "find_files") {
    const data2 = parsed.data;
    const request2 = { tool, query: data2.query, ...common };
    return { ok: true, value: request2 };
  }
  const data = parsed.data;
  const concreteRegex = rejectWildcardOnlyRegex(data.patterns, data.literal);
  if (!concreteRegex.ok) return concreteRegex;
  const request = {
    tool,
    patterns: [...new Set(data.patterns)],
    literal: data.literal,
    contextLines: data.contextLines,
    ...common
  };
  return { ok: true, value: request };
}

// lib/fff-router/mcp-tools.ts
var adminWithinJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["within"],
  properties: {
    within: {
      oneOf: [
        { type: "string", minLength: 1 },
        {
          type: "array",
          minItems: 1,
          maxItems: 32,
          items: { type: "string", minLength: 1 }
        }
      ]
    }
  }
};
var READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};
var MCP_TOOLS = [
  ...PUBLIC_TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema.jsonSchema,
    outputSchema: tool.outputSchema,
    annotations: READ_ONLY_ANNOTATIONS
  })),
  {
    name: "router_status",
    description: "Show the shared fff-routerd worker pool, resource usage, and health state.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false
    },
    outputSchema: routerStatusJsonSchema,
    annotations: READ_ONLY_ANNOTATIONS
  },
  {
    name: "router_warm",
    description: "Start and retain warm fff-mcp workers for one or more absolute paths.",
    inputSchema: adminWithinJsonSchema,
    outputSchema: warmResultJsonSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  {
    name: "router_evict",
    description: "Drain and remove fff-mcp workers for one or more absolute paths.",
    inputSchema: adminWithinJsonSchema,
    outputSchema: evictResultJsonSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  }
];
function formatResult(result) {
  if (result.displayText) return result.displayText;
  if (result.tool === "find_files") {
    return result.items.length > 0 ? result.items.map((item) => item.path).join("\n") : "0 results.";
  }
  return result.items.length > 0 ? result.items.map((item) => `${item.path}
  ${item.line}: ${item.text}`).join("\n--\n") : "0 matches.";
}
function errorResponse(code, message) {
  return {
    resultType: "complete",
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ ok: false, code, message }) }]
  };
}
function successResponse(text, structuredContent) {
  return {
    resultType: "complete",
    isError: false,
    content: [{ type: "text", text }],
    structuredContent
  };
}
function normalizeAdminWithin(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ProtocolValidationError([{ path: [], message: "request must be an object" }]);
  }
  const record = input;
  const unknown = Object.keys(record).find((key) => key !== "within");
  if (unknown) {
    throw new ProtocolValidationError([{ path: [unknown], message: "unknown field" }]);
  }
  const values = Array.isArray(record.within) ? record.within : [record.within];
  if (values.length === 0 || values.length > 32) {
    throw new ProtocolValidationError([
      { path: ["within"], message: "must contain between 1 and 32 paths" }
    ]);
  }
  return values.map((value, index) => {
    if (typeof value !== "string" || value.length === 0 || !path13.isAbsolute(value)) {
      throw new ProtocolValidationError([
        { path: ["within", index], message: "within paths must be absolute" }
      ]);
    }
    return path13.normalize(value);
  });
}
function listMcpTools() {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    annotations: tool.annotations
  }));
}
async function executeMcpTool(args) {
  try {
    switch (args.name) {
      case "find_files":
      case "grep": {
        const normalized = normalizePublicToolInput(args.name, args.input, args.env);
        if (!normalized.ok) return errorResponse(normalized.error.code, normalized.error.message);
        const result = await args.service.execute(normalized.value);
        if (!result.ok) return errorResponse(result.error.code, result.error.message);
        return successResponse(formatResult(result.value), result.value);
      }
      case "router_status": {
        if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) {
          return errorResponse("INVALID_REQUEST", "request must be an object");
        }
        if (Object.keys(args.input).length > 0) {
          return errorResponse("INVALID_REQUEST", "router_status accepts no arguments");
        }
        const status = args.service.status();
        return successResponse(JSON.stringify(status, null, 2), status);
      }
      case "router_warm": {
        const result = await args.service.warm(normalizeAdminWithin(args.input));
        if (!result.ok) return errorResponse(result.error.code, result.error.message);
        const payload = { workers: result.value };
        return successResponse(JSON.stringify(payload, null, 2), payload);
      }
      case "router_evict": {
        const result = await args.service.evict(normalizeAdminWithin(args.input));
        if (!result.ok) return errorResponse(result.error.code, result.error.message);
        return successResponse(JSON.stringify(result.value, null, 2), result.value);
      }
    }
  } catch (caught) {
    if (caught instanceof ProtocolValidationError) {
      return errorResponse(
        "INVALID_REQUEST",
        caught.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`).join("; ")
      );
    }
    return errorResponse(
      "INTERNAL_ERROR",
      caught instanceof Error ? caught.message : String(caught)
    );
  }
}
var MCP_INPUT_SCHEMAS = {
  find_files: findFilesInputSchema.jsonSchema,
  grep: grepInputSchema.jsonSchema,
  router_status: MCP_TOOLS.find((tool) => tool.name === "router_status").inputSchema,
  router_warm: adminWithinJsonSchema,
  router_evict: adminWithinJsonSchema
};

// lib/fff-router/mcp-server.ts
var MCP_PROTOCOL_VERSION = "2026-07-28";
var MCP_PROTOCOL_VERSIONS = [MCP_PROTOCOL_VERSION];
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function jsonRpcError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...data === void 0 ? {} : { data } }
  };
}
function serverMeta() {
  return {
    "io.modelcontextprotocol/serverInfo": {
      name: "fff-router",
      version: PACKAGE_VERSION
    }
  };
}
function completeResult(result) {
  return { resultType: "complete", ...result, _meta: serverMeta() };
}
function validateModernRequest(value) {
  const id = isRecord3(value) && (typeof value.id === "string" || typeof value.id === "number") ? value.id : null;
  if (!isRecord3(value) || value.jsonrpc !== "2.0" || typeof value.method !== "string") {
    return { ok: false, response: jsonRpcError(id, -32600, "Invalid Request") };
  }
  if (!(typeof value.id === "string" || typeof value.id === "number") && value.id !== void 0) {
    return {
      ok: false,
      response: jsonRpcError(null, -32600, "Invalid Request: id must be a string or number")
    };
  }
  if (!isRecord3(value.params)) {
    return { ok: false, response: jsonRpcError(id, -32602, "params must be an object") };
  }
  const meta = value.params._meta;
  if (!isRecord3(meta)) {
    return { ok: false, response: jsonRpcError(id, -32602, "params._meta is required") };
  }
  const requestedVersion = meta["io.modelcontextprotocol/protocolVersion"];
  if (requestedVersion !== MCP_PROTOCOL_VERSION) {
    return {
      ok: false,
      response: jsonRpcError(id, -32022, "Unsupported protocol version", {
        supported: [...MCP_PROTOCOL_VERSIONS],
        ...typeof requestedVersion === "string" ? { requested: requestedVersion } : {}
      })
    };
  }
  if (!isRecord3(meta["io.modelcontextprotocol/clientCapabilities"])) {
    return {
      ok: false,
      response: jsonRpcError(
        id,
        -32602,
        "params._meta.io.modelcontextprotocol/clientCapabilities is required"
      )
    };
  }
  return { ok: true, request: value };
}
function createMcpServer(args) {
  if (!args.service && !args.handler) {
    throw new Error("createMcpServer requires a RouterService or MCP tool handler");
  }
  async function callTool(name, input) {
    if (args.handler) return await args.handler(name, input);
    return await executeMcpTool({ service: args.service, name, input, env: args.env });
  }
  async function handleRequest(message) {
    const validated = validateModernRequest(message);
    if (!validated.ok) return validated.response;
    const request = validated.request;
    if (request.id === void 0) {
      return null;
    }
    const id = request.id;
    switch (request.method) {
      case "server/discover":
        return {
          jsonrpc: "2.0",
          id,
          result: completeResult({
            supportedVersions: [...MCP_PROTOCOL_VERSIONS],
            capabilities: { tools: {} },
            instructions: "Use find_files to discover relevant files and grep for exact identifiers. All searches are read-only and scoped to an absolute repository path.",
            ttlMs: 3e5,
            cacheScope: "private"
          })
        };
      case "tools/list": {
        const cursor = request.params?.cursor;
        if (cursor !== void 0 && cursor !== null) {
          return jsonRpcError(id, -32602, "tools/list does not have another page");
        }
        return {
          jsonrpc: "2.0",
          id,
          result: completeResult({
            tools: listMcpTools(),
            ttlMs: 3e5,
            cacheScope: "private"
          })
        };
      }
      case "tools/call": {
        const name = request.params?.name;
        if (typeof name !== "string") {
          return jsonRpcError(id, -32602, "tools/call params.name must be a string");
        }
        const known = listMcpTools().some((tool) => tool.name === name);
        if (!known) return jsonRpcError(id, -32602, `Unknown tool '${name}'`);
        const input = request.params?.arguments;
        if (input !== void 0 && !isRecord3(input)) {
          return jsonRpcError(id, -32602, "tools/call params.arguments must be an object");
        }
        const result = await callTool(name, input ?? {});
        return {
          jsonrpc: "2.0",
          id,
          result: { ...result, _meta: serverMeta() }
        };
      }
      case "initialize":
        return jsonRpcError(
          id,
          -32601,
          `This server implements stateless MCP ${MCP_PROTOCOL_VERSION}; use server/discover instead of initialize`
        );
      default:
        return jsonRpcError(id, -32601, `Method not found: ${request.method}`);
    }
  }
  return {
    listTools: async () => listMcpTools(),
    callTool,
    handleRequest,
    async connectStdio(options = {}) {
      let buffered = "";
      let chain = Promise.resolve();
      let settled = false;
      const done = new Promise((resolve, reject) => {
        const finish = () => {
          if (settled) return;
          settled = true;
          options.onClose?.();
          resolve();
        };
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => {
          buffered += chunk;
          const lines = buffered.split(/\r?\n/);
          buffered = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            chain = chain.then(async () => {
              let response;
              try {
                response = await handleRequest(JSON.parse(line));
              } catch (caught) {
                response = jsonRpcError(
                  null,
                  -32700,
                  caught instanceof SyntaxError ? "Parse error" : caught instanceof Error ? caught.message : String(caught)
                );
              }
              if (response) process.stdout.write(`${JSON.stringify(response)}
`);
            });
          }
        });
        process.stdin.once("end", () => void chain.then(finish, reject));
        process.stdin.once("error", reject);
        process.stdin.resume();
      });
      return { done, close: () => process.stdin.pause() };
    }
  };
}

// lib/fff-router/local-auth.ts
import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync as existsSync6, mkdirSync as mkdirSync3, readFileSync as readFileSync4, writeFileSync as writeFileSync3 } from "node:fs";
function validToken(value) {
  return /^[A-Za-z0-9_-]{32,}$/.test(value);
}
async function readDaemonAuthToken(env = process.env) {
  const tokenPath = getDaemonPaths({ env }).authTokenPath;
  if (!existsSync6(tokenPath)) {
    return null;
  }
  try {
    const token = readFileSync4(tokenPath, "utf8").trim();
    return validToken(token) ? token : null;
  } catch {
    return null;
  }
}
async function ensureDaemonAuthToken(env = process.env) {
  const paths = getDaemonPaths({ env });
  mkdirSync3(paths.dir, { recursive: true, mode: 448 });
  if (process.platform !== "win32") {
    chmodSync(paths.dir, 448);
  }
  const existing = await readDaemonAuthToken(env);
  if (existing) {
    if (process.platform !== "win32") {
      chmodSync(paths.authTokenPath, 384);
    }
    return existing;
  }
  const token = randomBytes(32).toString("base64url");
  try {
    writeFileSync3(paths.authTokenPath, `${token}
`, { flag: "wx", mode: 384 });
    return token;
  } catch (caught) {
    if (typeof caught === "object" && caught && "code" in caught && caught.code === "EEXIST") {
      const raced = await readDaemonAuthToken(env);
      if (raced) {
        return raced;
      }
    }
    throw caught;
  }
}
function isAuthorized(authorization, expectedToken) {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return false;
  }
  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

// lib/fff-router/runtime-manager.ts
function unavailable(message, retryable = true) {
  return {
    ok: false,
    error: { code: "WORKER_UNAVAILABLE", message, retryable }
  };
}
async function closeBestEffort(runtime) {
  if (!runtime) {
    return;
  }
  await Promise.resolve(runtime.close()).catch(() => {
  });
}
var WorkerPool = class {
  constructor(options) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.scheduleSweep();
  }
  options;
  entries = /* @__PURE__ */ new Map();
  deadDiagnostics = [];
  now;
  sweepTimer = null;
  generation = 0;
  closed = false;
  scheduleSweep() {
    if (this.closed || this.sweepTimer) return;
    this.sweepTimer = setTimeout(
      () => {
        this.sweepTimer = null;
        void this.sweep().catch(() => {
        }).finally(() => this.scheduleSweep());
      },
      Math.max(100, this.options.sweepIntervalMs)
    );
  }
  updateOptions(options, ttl) {
    const reschedule = !this.closed && options.sweepIntervalMs !== this.options.sweepIntervalMs;
    this.options = { ...options, now: this.options.now };
    if (reschedule) {
      if (this.sweepTimer) clearTimeout(this.sweepTimer);
      this.sweepTimer = null;
      this.scheduleSweep();
    }
    if (ttl) {
      for (const entry of this.entries.values()) {
        entry.ttlMs = entry.rootType === "git" ? ttl.gitMs : ttl.nonGitMs;
      }
    }
  }
  toDiagnostic(entry, state = entry.state) {
    const resources = entry.supervision?.resources ?? entry.runtime?.getResourceUsage?.() ?? entry.lastResources ?? null;
    const terminationReason = entry.supervision?.terminationReason ?? entry.runtime?.getTerminationReason?.() ?? entry.terminationReason;
    return {
      root: entry.root,
      rootType: entry.rootType,
      state,
      workerId: entry.runtime?.id,
      pid: entry.runtime?.pid,
      generation: entry.generation,
      activeLeases: entry.activeLeases,
      startedAt: entry.startedAt,
      lastUsedAt: entry.lastUsedAt,
      lastCallAt: entry.lastCallAt,
      lastSuccessAt: entry.lastSuccessAt,
      lastError: entry.lastError,
      lastErrorAt: entry.lastErrorAt,
      failureCount: entry.failureCount,
      retryAfter: entry.retryAfter,
      resources: resources ?? void 0,
      terminationReason
    };
  }
  restartDelay(failureCount) {
    const exponential = this.options.restartBackoffMs * 2 ** Math.max(0, failureCount - 1);
    return Math.min(exponential, this.options.restartBackoffMaxMs ?? 6e4);
  }
  rememberDead(entry) {
    const diagnostic = this.toDiagnostic(entry, "dead");
    this.deadDiagnostics.unshift(diagnostic);
    this.deadDiagnostics.splice(this.options.maxDeadDiagnostics ?? 32);
  }
  detachRuntimeObservers(entry) {
    entry.detachClose?.();
    entry.detachResourceSample?.();
    entry.detachTermination?.();
    entry.detachClose = void 0;
    entry.detachResourceSample = void 0;
    entry.detachTermination = void 0;
  }
  activeEntries(rootType) {
    return [...this.entries.values()].filter(
      (entry) => entry.state !== "dead" && (rootType === void 0 || entry.rootType === rootType)
    );
  }
  removeIdleLru(rootType) {
    const candidate = this.activeEntries(rootType).filter((entry) => entry.activeLeases === 0 && entry.state !== "starting").sort((left, right) => left.lastUsedAt - right.lastUsedAt)[0];
    if (!candidate) {
      return void 0;
    }
    this.detachRuntimeObservers(candidate);
    candidate.state = "draining";
    this.entries.delete(candidate.root);
    return candidate.runtime;
  }
  reserveCapacity(rootType) {
    const toClose = [];
    if (rootType === "non-git" && this.activeEntries("non-git").length >= this.options.maxNonGitWorkers) {
      const runtime = this.removeIdleLru("non-git");
      if (!runtime) {
        return {
          ok: false,
          error: {
            code: "WORKER_LIMIT_REACHED",
            message: "all non-Git worker slots are busy",
            retryable: true
          }
        };
      }
      toClose.push(runtime);
    }
    if (this.activeEntries().length >= this.options.maxWorkers) {
      const runtime = this.removeIdleLru();
      if (!runtime) {
        return {
          ok: false,
          error: {
            code: "WORKER_LIMIT_REACHED",
            message: "all fff-mcp worker slots are busy",
            retryable: true
          }
        };
      }
      toClose.push(runtime);
    }
    return { ok: true, value: toClose };
  }
  createEntry(spec, previousFailures = 0) {
    const now = this.now();
    const entry = {
      token: Symbol(spec.root),
      root: spec.root,
      rootType: spec.rootType,
      state: "starting",
      generation: ++this.generation,
      activeLeases: 0,
      ttlMs: spec.ttlMs,
      createdAt: now,
      lastUsedAt: now,
      startedAt: void 0,
      lastCallAt: void 0,
      lastSuccessAt: void 0,
      lastError: void 0,
      lastErrorAt: void 0,
      failureCount: previousFailures,
      retryAfter: void 0,
      runtime: void 0,
      supervision: null,
      lastResources: void 0,
      terminationReason: void 0,
      startup: void 0,
      detachClose: void 0,
      detachResourceSample: void 0,
      detachTermination: void 0
    };
    entry.startup = Promise.resolve().then(spec.start).then(async (runtime) => {
      const current = this.entries.get(spec.root);
      if (this.closed || current?.token !== entry.token) {
        await closeBestEffort(runtime);
        throw new Error(`worker for '${spec.root}' was evicted during startup`);
      }
      const draining = entry.state === "draining";
      entry.runtime = runtime;
      entry.supervision = runtime.supervision ?? null;
      entry.startup = void 0;
      entry.state = draining ? "draining" : "ready";
      entry.startedAt = this.now();
      entry.retryAfter = void 0;
      entry.detachClose = runtime.onClose?.((reason) => {
        this.markUnexpectedClose(spec.root, entry.token, reason);
      });
      entry.detachResourceSample = runtime.onResourceSample?.(() => {
        const resources = entry.supervision?.resources ?? runtime.getResourceUsage?.();
        if (resources) entry.lastResources = { ...resources };
      });
      entry.detachTermination = runtime.onTermination?.(() => {
        entry.terminationReason = entry.supervision?.terminationReason ?? runtime.getTerminationReason?.() ?? entry.terminationReason;
      });
      return runtime;
    }).catch((error2) => {
      const current = this.entries.get(spec.root);
      if (current?.token === entry.token) {
        const now2 = this.now();
        entry.startup = void 0;
        entry.state = "dead";
        entry.lastError = error2 instanceof Error ? error2.message : String(error2);
        entry.lastErrorAt = now2;
        entry.failureCount += 1;
        entry.retryAfter = now2 + this.restartDelay(entry.failureCount);
      }
      throw error2;
    });
    this.entries.set(spec.root, entry);
    return entry;
  }
  markUnexpectedClose(root, token, reason) {
    const entry = this.entries.get(root);
    if (!entry || entry.token !== token || entry.state === "draining") {
      return;
    }
    const now = this.now();
    const resources = entry.supervision?.resources ?? entry.runtime?.getResourceUsage?.();
    if (resources) entry.lastResources = resources;
    entry.terminationReason = reason ?? entry.supervision?.terminationReason ?? entry.runtime?.getTerminationReason?.() ?? entry.terminationReason;
    this.detachRuntimeObservers(entry);
    entry.state = "dead";
    entry.lastError = entry.terminationReason ?? "fff-mcp worker exited unexpectedly";
    entry.lastErrorAt = now;
    entry.failureCount += 1;
    entry.retryAfter = now + this.restartDelay(entry.failureCount);
  }
  async acquire(spec) {
    if (this.closed) {
      return unavailable("worker pool is closed", false);
    }
    const now = this.now();
    let entry = this.entries.get(spec.root);
    let coldStart = false;
    let runtimesToClose = [];
    let previousFailures = 0;
    if (entry?.state === "dead") {
      if (entry.activeLeases > 0 || (entry.retryAfter ?? 0) > now) {
        return unavailable(
          `fff-mcp worker for '${spec.root}' is backing off after ${entry.failureCount} failure(s)`
        );
      }
      previousFailures = entry.failureCount;
      this.rememberDead(entry);
      this.entries.delete(spec.root);
      entry = void 0;
    }
    if (entry?.state === "draining") {
      return unavailable(`fff-mcp worker for '${spec.root}' is draining`);
    }
    if (!entry) {
      const capacity = this.reserveCapacity(spec.rootType);
      if (!capacity.ok) {
        return capacity;
      }
      runtimesToClose = capacity.value;
      const start = spec.start;
      entry = this.createEntry(
        {
          ...spec,
          start: async () => {
            await Promise.all(runtimesToClose.map(closeBestEffort));
            return await start();
          }
        },
        previousFailures
      );
      coldStart = true;
    }
    entry.activeLeases += 1;
    entry.lastUsedAt = now;
    entry.ttlMs = spec.ttlMs;
    let runtime;
    try {
      runtime = entry.runtime ?? await entry.startup;
    } catch (error2) {
      await this.release(entry.root, entry.token);
      return unavailable(error2 instanceof Error ? error2.message : String(error2));
    }
    const token = entry.token;
    const generation = entry.generation;
    let released = false;
    return {
      ok: true,
      value: {
        root: entry.root,
        rootType: entry.rootType,
        runtime,
        generation,
        coldStart,
        recordCallStart: () => {
          const current = this.entries.get(entry.root);
          if (current?.token === token) {
            current.lastCallAt = this.now();
          }
        },
        recordCallSuccess: () => {
          const current = this.entries.get(entry.root);
          if (current?.token === token) {
            current.lastSuccessAt = this.now();
            current.failureCount = 0;
          }
        },
        recordCallError: (error2) => {
          const current = this.entries.get(entry.root);
          if (current?.token === token) {
            current.lastError = error2;
            current.lastErrorAt = this.now();
          }
        },
        release: async () => {
          if (released) {
            return;
          }
          released = true;
          await this.release(entry.root, token);
        }
      }
    };
  }
  async release(root, token) {
    const entry = this.entries.get(root);
    if (!entry || entry.token !== token) {
      return;
    }
    entry.activeLeases = Math.max(0, entry.activeLeases - 1);
    entry.lastUsedAt = this.now();
    if (entry.activeLeases === 0 && entry.state === "draining") {
      this.detachRuntimeObservers(entry);
      this.entries.delete(root);
      this.rememberDead(entry);
      await closeBestEffort(entry.runtime);
    }
    if (entry.activeLeases === 0 && this.options.maxTotalWorkerRssBytes) {
      void this.sweep();
    }
  }
  async invalidate(root, generation, reason) {
    const entry = this.entries.get(root);
    if (!entry || entry.generation !== generation) {
      return;
    }
    entry.lastError = reason;
    entry.lastErrorAt = this.now();
    entry.failureCount += 1;
    entry.state = "draining";
    if (entry.activeLeases === 0) {
      this.detachRuntimeObservers(entry);
      this.entries.delete(root);
      this.rememberDead(entry);
      await closeBestEffort(entry.runtime);
    }
  }
  async evict(root) {
    const entry = this.entries.get(root);
    if (!entry) {
      return false;
    }
    entry.state = "draining";
    if (entry.activeLeases === 0) {
      this.detachRuntimeObservers(entry);
      this.entries.delete(root);
      this.rememberDead(entry);
      await closeBestEffort(entry.runtime);
    }
    return true;
  }
  async evictAll() {
    await Promise.all([...this.entries.keys()].map((root) => this.evict(root)));
  }
  async sweep() {
    if (this.closed) {
      return;
    }
    const now = this.now();
    const expired = [...this.entries.values()].filter(
      (entry) => entry.state === "ready" && entry.activeLeases === 0 && entry.lastUsedAt + entry.ttlMs <= now
    );
    await Promise.all(expired.map((entry) => this.evict(entry.root)));
    const capacityClosures = [];
    while (this.activeEntries("non-git").length > this.options.maxNonGitWorkers) {
      const runtime = this.removeIdleLru("non-git");
      if (!runtime) {
        break;
      }
      capacityClosures.push(runtime);
    }
    while (this.activeEntries().length > this.options.maxWorkers) {
      const runtime = this.removeIdleLru();
      if (!runtime) {
        break;
      }
      capacityClosures.push(runtime);
    }
    const totalLimit = this.options.maxTotalWorkerRssBytes;
    if (totalLimit) {
      let totalRss = this.activeEntries().reduce(
        (total, entry) => total + (entry.supervision?.resources?.rssBytes ?? entry.runtime?.getResourceUsage?.()?.rssBytes ?? 0),
        0
      );
      while (totalRss > totalLimit) {
        const candidate = this.activeEntries().filter((entry) => entry.activeLeases === 0 && entry.state === "ready").sort((left, right) => {
          const rssDelta = (right.supervision?.resources?.rssBytes ?? right.runtime?.getResourceUsage?.()?.rssBytes ?? 0) - (left.supervision?.resources?.rssBytes ?? left.runtime?.getResourceUsage?.()?.rssBytes ?? 0);
          return rssDelta || left.lastUsedAt - right.lastUsedAt;
        })[0];
        if (!candidate) break;
        const rss = candidate.supervision?.resources?.rssBytes ?? candidate.runtime?.getResourceUsage?.()?.rssBytes ?? 0;
        this.detachRuntimeObservers(candidate);
        candidate.state = "draining";
        this.entries.delete(candidate.root);
        if (candidate.runtime) capacityClosures.push(candidate.runtime);
        totalRss = Math.max(0, totalRss - rss);
      }
    }
    await Promise.all(capacityClosures.map(closeBestEffort));
  }
  getDiagnostics() {
    return [
      ...[...this.entries.values()].sort((left, right) => left.root.localeCompare(right.root)).map((entry) => this.toDiagnostic(entry)),
      ...this.deadDiagnostics
    ];
  }
  getResourceSummary() {
    const samples = this.activeEntries().map((entry) => entry.supervision?.resources ?? entry.runtime?.getResourceUsage?.() ?? null).filter((sample) => sample !== null);
    return {
      sampledAt: samples.reduce((latest, sample) => Math.max(latest, sample.sampledAt), 0),
      workerRssBytes: samples.reduce((total, sample) => total + sample.rssBytes, 0),
      measuredWorkers: samples.length
    };
  }
  getLiveWorkerCount() {
    return this.activeEntries().length;
  }
  getActiveLeaseCount() {
    return this.activeEntries().reduce((total, entry) => total + entry.activeLeases, 0);
  }
  async closeAll() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (this.sweepTimer) clearTimeout(this.sweepTimer);
    this.sweepTimer = null;
    const entries = [...this.entries.values()];
    this.entries.clear();
    for (const entry of entries) {
      this.detachRuntimeObservers(entry);
      entry.state = "draining";
    }
    await Promise.all(entries.map((entry) => closeBestEffort(entry.runtime)));
    await Promise.all(entries.map((entry) => entry.startup?.catch(() => {
    })));
  }
};

// lib/fff-router/http-daemon.ts
var MAX_REQUEST_BODY_BYTES = 1024 * 1024;
var IS_PERRY3 = typeof process.versions.perry === "string";
var DAEMON_CONTROL_PATH = "/control";
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requestId(value) {
  if (!isRecord4(value)) return null;
  return typeof value.id === "string" || typeof value.id === "number" ? value.id : null;
}
function sendJson(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}
function sendMcpError(res, status, id, code, message, data) {
  sendJson(res, status, jsonRpcError(id, code, message, data));
}
function headerValue(req, name) {
  const value = req.headers[name.toLowerCase()];
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? null : null;
}
function decodeMcpHeader(value) {
  if (!value.startsWith("=?base64?")) return /^[\x20-\x7e]+$/.test(value) ? value : null;
  if (!value.endsWith("?=")) return null;
  try {
    const encoded = value.slice("=?base64?".length, -2);
    if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return null;
    return Buffer.from(encoded, "base64").toString("utf8");
  } catch {
    return null;
  }
}
function isAllowedOrigin(origin, config) {
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const configured = config.host.toLowerCase().replace(/^\[|\]$/g, "");
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && (host === "localhost" || host === "::1" || host === configured || isIP2(host) === 4 && host.startsWith("127."));
  } catch {
    return false;
  }
}
function validateMcpHttpHeaders(req, body) {
  const id = requestId(body);
  if (!isRecord4(body)) {
    return { ok: false, status: 400, response: jsonRpcError(id, -32600, "Invalid Request") };
  }
  const protocolHeader = headerValue(req, "mcp-protocol-version");
  const methodHeader = headerValue(req, "mcp-method");
  const bodyMethod = body.method;
  const params = isRecord4(body.params) ? body.params : null;
  const meta = params && isRecord4(params._meta) ? params._meta : null;
  const bodyVersion = meta?.["io.modelcontextprotocol/protocolVersion"];
  if (!protocolHeader || !methodHeader) {
    return {
      ok: false,
      status: 400,
      response: jsonRpcError(
        id,
        -32020,
        "Header mismatch: MCP-Protocol-Version and Mcp-Method are required"
      )
    };
  }
  if (protocolHeader !== bodyVersion || methodHeader !== bodyMethod) {
    return {
      ok: false,
      status: 400,
      response: jsonRpcError(
        id,
        -32020,
        "Header mismatch: request metadata does not match the JSON-RPC body"
      )
    };
  }
  if (protocolHeader !== MCP_PROTOCOL_VERSION) {
    return {
      ok: false,
      status: 400,
      response: jsonRpcError(id, -32022, "Unsupported protocol version", {
        supported: [MCP_PROTOCOL_VERSION],
        requested: protocolHeader
      })
    };
  }
  if (bodyMethod === "tools/call") {
    const nameHeader = headerValue(req, "mcp-name");
    const decodedName = nameHeader ? decodeMcpHeader(nameHeader) : null;
    if (!nameHeader || decodedName === null || decodedName !== params?.name) {
      return {
        ok: false,
        status: 400,
        response: jsonRpcError(id, -32020, "Header mismatch: Mcp-Name does not match params.name")
      };
    }
  }
  return { ok: true };
}
function assertLocalHost(host) {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized !== "localhost" && normalized !== "::1" && !(isIP2(normalized) === 4 && normalized.startsWith("127."))) {
    throw new Error("fff-routerd only binds to a local loopback address");
  }
}
async function readDaemonMetadata(pathValue) {
  if (!existsSync7(pathValue)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync5(pathValue, "utf8"));
  } catch {
    return null;
  }
}
async function writeDaemonMetadata(pathValue, metadata) {
  const temporaryPath = `${pathValue}.${process.pid}.tmp`;
  writeFileSync4(temporaryPath, `${JSON.stringify(metadata, null, 2)}
`, {
    mode: 384
  });
  renameSync2(temporaryPath, pathValue);
}
function poolOptions(config) {
  return {
    maxWorkers: config.limits.maxWorkers,
    maxNonGitWorkers: config.limits.maxNonGitWorkers,
    sweepIntervalMs: config.runtime.sweepIntervalMs,
    restartBackoffMs: config.runtime.restartBackoffMs,
    restartBackoffMaxMs: config.runtime.restartBackoffMaxMs,
    maxTotalWorkerRssBytes: config.limits.maxTotalWorkerRssBytes
  };
}
function createDefaultService(args) {
  return createRouterService({
    configRef: args.configRef,
    adapter: createFffMcpStdioAdapter(),
    workerPool: args.workerPool
  });
}
async function policyConfigSignature(paths) {
  const signatures = [paths.jsonPath, paths.jsoncPath].map((pathValue) => {
    if (!existsSync7(pathValue)) {
      return `${pathValue}:missing`;
    }
    try {
      const details = statSync5(pathValue);
      return `${pathValue}:${details.mtimeMs}:${details.size}`;
    } catch {
      return `${pathValue}:missing`;
    }
  });
  return signatures.join("|");
}
function buildMetadata(args) {
  return {
    pid: process.pid,
    host: args.config.host,
    port: args.port,
    mcpPath: args.config.mcpPath,
    controlPath: DAEMON_CONTROL_PATH,
    protocolVersion: DAEMON_PROTOCOL_VERSION,
    packageVersion: PACKAGE_VERSION,
    daemonSourceFingerprint: getDaemonSourceFingerprint({ env: args.env }),
    serverFingerprint: getDaemonServerFingerprint({
      env: args.env,
      daemonConfig: {
        host: args.config.host,
        port: args.port,
        mcpPath: args.config.mcpPath
      }
    }),
    reloadFingerprint: getDaemonReloadFingerprintForConfig(args.reloadConfig),
    startedAt: args.startedAt
  };
}
async function startHttpDaemon(args = {}) {
  const env = args.env ?? process.env;
  const baseConfig = getDaemonConfig({ env });
  const config = {
    host: args.host ?? baseConfig.host,
    port: args.port ?? baseConfig.port,
    mcpPath: args.mcpPath ?? baseConfig.mcpPath
  };
  assertLocalHost(config.host);
  const loadReloadConfig = args.loadReloadConfig ?? loadDaemonReloadConfig;
  const initialReloadConfig = loadReloadConfig({ env });
  const configRef = args.configRef ?? { current: initialReloadConfig.router };
  const workerPool = new WorkerPool(poolOptions(initialReloadConfig.router));
  const service = args.service ?? args.createService?.({ configRef, workerPool }) ?? createDefaultService({ configRef, workerPool });
  const paths = getDaemonPaths({ env });
  const policyConfigPaths = getDaemonPolicyConfigPaths({ env });
  const startedAt = Date.now();
  let metadata = null;
  let configPollTimer = null;
  let configPollRunning = false;
  let idleTimer = null;
  let rescheduleIdleCheck = () => {
  };
  let reloadChain = Promise.resolve();
  let closing = false;
  let lastActivityAt = startedAt;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  const warmConfiguredRoots = (roots) => {
    if (roots.length === 0) {
      return;
    }
    void service.warm(roots).then((result) => {
      if (!result.ok) {
        console.error("fff-routerd warm roots failed:", result.error.message);
      }
    });
  };
  const reload = async (override) => {
    const nextReload = reloadChain.then(async () => {
      if (closing) {
        throw new Error("fff-routerd is closing");
      }
      lastActivityAt = Date.now();
      const nextConfig = override?.loadConfig ? override.loadConfig() : loadReloadConfig({ env });
      const nextMetadata = buildMetadata({
        env,
        config,
        port: metadata?.port ?? config.port,
        reloadConfig: nextConfig,
        startedAt
      });
      configRef.current = nextConfig.router;
      workerPool.updateOptions(poolOptions(nextConfig.router), nextConfig.router.ttl);
      if (override?.clearRuntimes) {
        await workerPool.evictAll();
      }
      await writeDaemonMetadata(paths.metadataPath, nextMetadata);
      metadata = nextMetadata;
      warmConfiguredRoots(nextConfig.router.warmRoots);
      rescheduleIdleCheck();
    });
    reloadChain = nextReload.catch(() => {
    });
    return await nextReload;
  };
  mkdirSync4(paths.dir, { recursive: true, mode: 448 });
  mkdirSync4(policyConfigPaths.dir, { recursive: true, mode: 448 });
  const authToken = await ensureDaemonAuthToken(env);
  const server = createServer(async (req, res) => {
    const url = new URL(
      req.url || "/",
      req.headers.host ? `http://${req.headers.host}` : getDaemonOriginFromConfig(config)
    );
    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      const authorized = isAuthorized(req.headers.authorization, authToken);
      if (authorized) lastActivityAt = Date.now();
      res.end(
        JSON.stringify({
          ok: true,
          metadata,
          ...authorized ? service.status() : {}
        })
      );
      return;
    }
    const isMcpRequest = url.pathname === config.mcpPath;
    const isControlRequest = url.pathname === DAEMON_CONTROL_PATH;
    if (!isMcpRequest && !isControlRequest) {
      res.writeHead(404).end("Not found");
      return;
    }
    const origin = headerValue(req, "origin");
    if (origin && !isAllowedOrigin(origin, config)) {
      sendMcpError(res, 403, null, -32020, "Origin is not allowed");
      return;
    }
    if (!isAuthorized(req.headers.authorization, authToken)) {
      res.writeHead(401, {
        "content-type": "application/json",
        "www-authenticate": 'Bearer realm="fff-routerd"'
      });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    lastActivityAt = Date.now();
    if (req.method !== "POST") {
      res.writeHead(405, { allow: "POST" }).end();
      return;
    }
    const contentType = headerValue(req, "content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      sendMcpError(res, 415, null, -32600, "Content-Type must be application/json");
      return;
    }
    const accept = (headerValue(req, "accept") ?? "").toLowerCase();
    if (isMcpRequest && (!accept.includes("application/json") || !accept.includes("text/event-stream"))) {
      sendMcpError(
        res,
        406,
        null,
        -32600,
        "Accept must include application/json and text/event-stream"
      );
      return;
    }
    try {
      const parsedBody = await new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        let tooLarge = false;
        let settled = false;
        req.on("data", (chunk) => {
          if (settled) return;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += buffer.byteLength;
          if (size > MAX_REQUEST_BODY_BYTES) {
            tooLarge = true;
            return;
          }
          chunks.push(buffer);
        });
        req.on("end", () => {
          if (settled) return;
          settled = true;
          if (tooLarge) {
            reject(new Error(`request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes`));
            return;
          }
          try {
            resolve(
              chunks.length === 0 ? void 0 : JSON.parse(Buffer.concat(chunks).toString("utf8"))
            );
          } catch (caught) {
            reject(caught);
          }
        });
        req.on("error", (caught) => {
          if (settled) return;
          settled = true;
          reject(caught);
        });
        req.on("aborted", () => {
          if (settled) return;
          settled = true;
          reject(new Error("request body was aborted"));
        });
      });
      if (isControlRequest) {
        if (!isRecord4(parsedBody) || typeof parsedBody.action !== "string") {
          sendJson(res, 400, { ok: false, error: "control action is required" });
          return;
        }
        switch (parsedBody.action) {
          case "reload":
            await reload({ clearRuntimes: parsedBody.clearRuntimes === true });
            sendJson(res, 200, { ok: true, action: "reload" });
            return;
          case "shutdown":
            res.setHeader("connection", "close");
            sendJson(res, 202, { ok: true, action: "shutdown" });
            setTimeout(() => void closeDaemon(), 0);
            return;
          default:
            sendJson(res, 400, { ok: false, error: "unsupported control action" });
            return;
        }
      }
      const headers = validateMcpHttpHeaders(req, parsedBody);
      if (!headers.ok) {
        sendJson(res, headers.status, headers.response);
        return;
      }
      const response = await createMcpServer({ service, env }).handleRequest(parsedBody);
      if (!response) {
        res.writeHead(202).end();
        return;
      }
      const status = "error" in response && response.error.code === -32601 ? 404 : 200;
      if (closing) res.setHeader("connection", "close");
      sendJson(res, status, response);
    } catch (caught) {
      if (!res.headersSent) {
        const parseError = caught instanceof SyntaxError;
        sendMcpError(
          res,
          parseError ? 400 : 500,
          null,
          parseError ? -32700 : -32603,
          parseError ? "Parse error" : caught instanceof Error ? caught.message : String(caught)
        );
      }
    }
  });
  try {
    if (IS_PERRY3) {
      let listenError = null;
      const onError = (caught) => {
        listenError = caught;
      };
      server.once("error", onError);
      server.listen(config.port, config.host);
      const deadline = Date.now() + 5e3;
      while (!server.listening && !listenError && Date.now() < deadline) {
        await sleep(10);
      }
      server.off("error", onError);
      if (listenError) throw listenError;
      if (!server.listening) throw new Error("daemon HTTP listener did not become ready");
    } else {
      await new Promise((resolve, reject) => {
        const onError = (caught) => {
          server.off("listening", onListening);
          reject(caught);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };
        server.once("error", onError);
        server.listen(config.port, config.host, onListening);
      });
    }
  } catch (caught) {
    await service.close();
    await workerPool.closeAll();
    throw caught;
  }
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : config.port;
  metadata = buildMetadata({
    env,
    config,
    port: actualPort,
    reloadConfig: initialReloadConfig,
    startedAt
  });
  await writeDaemonMetadata(paths.metadataPath, metadata);
  warmConfiguredRoots(initialReloadConfig.router.warmRoots);
  if (args.watchConfig !== false) {
    let signature = await policyConfigSignature(policyConfigPaths);
    const scheduleConfigPoll = () => {
      if (closing || configPollRunning || configPollTimer) return;
      configPollTimer = setTimeout(() => {
        configPollTimer = null;
        if (closing) return;
        configPollRunning = true;
        void policyConfigSignature(policyConfigPaths).then(async (nextSignature) => {
          if (nextSignature === signature) return;
          signature = nextSignature;
          await reload();
        }).catch((caught) => {
          console.error("fff-routerd config reload failed:", caught);
        }).finally(() => {
          configPollRunning = false;
          scheduleConfigPoll();
        });
      }, 1e3);
    };
    scheduleConfigPoll();
  }
  let closePromise = null;
  const closeDaemon = async () => {
    if (closePromise) return await closePromise;
    closePromise = (async () => {
      closing = true;
      if (configPollTimer) clearTimeout(configPollTimer);
      if (idleTimer) clearTimeout(idleTimer);
      await reloadChain.catch(() => {
      });
      const serverClosed = IS_PERRY3 ? (async () => {
        server.close();
        const deadline = Date.now() + 5e3;
        while (server.listening && Date.now() < deadline) await sleep(10);
      })() : new Promise((resolve) => server.close(() => resolve()));
      await Promise.all([
        serverClosed,
        service.close().catch(() => {
        }),
        workerPool.closeAll().catch(() => {
        })
      ]);
      try {
        rmSync3(paths.metadataPath, { force: true });
      } catch {
      }
      resolveDone();
    })();
    return await closePromise;
  };
  rescheduleIdleCheck = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    const idleTimeoutMs = configRef.current.runtime.daemonIdleTimeoutMs ?? 0;
    if (closing || idleTimeoutMs <= 0) return;
    const elapsedMs = Date.now() - lastActivityAt;
    const activeLeases = workerPool.getActiveLeaseCount();
    const delayMs = activeLeases ? Math.max(25, Math.min(1e3, Math.floor(idleTimeoutMs / 4))) : Math.max(25, Math.min(6e4, idleTimeoutMs - elapsedMs));
    idleTimer = setTimeout(() => {
      idleTimer = null;
      const currentTimeoutMs = configRef.current.runtime.daemonIdleTimeoutMs ?? 0;
      if (!closing && currentTimeoutMs > 0 && workerPool.getActiveLeaseCount() === 0 && Date.now() - lastActivityAt >= currentTimeoutMs) {
        void closeDaemon();
        return;
      }
      rescheduleIdleCheck();
    }, delayMs);
  };
  rescheduleIdleCheck();
  return {
    server,
    get metadata() {
      return metadata;
    },
    paths,
    get url() {
      return `${getDaemonOriginFromConfig({
        host: metadata.host,
        port: metadata.port,
        mcpPath: metadata.mcpPath
      })}${metadata.mcpPath}`;
    },
    reload,
    done,
    close: closeDaemon
  };
}
export {
  DAEMON_CONTROL_PATH,
  DAEMON_PROTOCOL_VERSION,
  DEFAULT_DAEMON_HOST,
  DEFAULT_DAEMON_MCP_PATH,
  DEFAULT_DAEMON_PORT,
  PACKAGE_MANAGER,
  PACKAGE_VERSION,
  RouterServiceImpl,
  WorkerPool,
  createFffMcpStdioAdapter,
  createMcpServer,
  createRouterService,
  formatDaemonUrlHost,
  getDaemonConfig,
  getDaemonConfigFingerprint,
  getDaemonEndpoint,
  getDaemonOriginFromConfig,
  getDaemonPaths,
  getDaemonPolicyConfigPaths,
  getDaemonReloadFingerprint,
  getDaemonReloadFingerprintForConfig,
  getDaemonServerFingerprint,
  getDaemonSourceFingerprint,
  getDefaultDaemonConfig,
  getDefaultDaemonFileConfig,
  getDefaultDaemonReloadConfig,
  getDefaultRouterConfig,
  loadDaemonReloadConfig,
  parseJsonWithComments,
  readDaemonMetadata,
  readPreferredDaemonPolicyFile,
  startHttpDaemon
};
