import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import type { WorkerResourceUsage, WorkerSupervisionTelemetry } from "./types";
import { ProcessSupervisor, type ProcessSupervisorOptions } from "./process-supervisor";

const IS_PERRY = typeof (process.versions as Record<string, string | undefined>).perry === "string";
const DEFAULT_MAX_MESSAGE_BYTES = 16 * 1024 * 1024;

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
};

export type LegacyMcpClientOptions = Omit<ProcessSupervisorOptions, "maxStderrBytes"> & {
  initializeTimeoutMs?: number;
  maxMessageBytes?: number;
  filePollIntervalMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

abstract class LegacyMcpClientBase {
  readonly supervisor: ProcessSupervisor;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly closeHandlers = new Set<(reason?: string) => void>();
  private nextId = 0;
  private stdoutBuffer = "";
  protected closed = false;

  protected constructor(
    protected readonly options: LegacyMcpClientOptions,
    supervisor: ProcessSupervisor,
  ) {
    this.supervisor = supervisor;
    this.supervisor.onClose((exit) => {
      const details = this.getRecentStderr();
      const reason = exit.reason ?? this.supervisor.getTerminationReason();
      this.rejectAll(
        new Error(
          `fff-mcp exited${reason ? `: ${reason}` : ""}${details ? `; recent stderr: ${details}` : ""}`,
        ),
      );
      this.onTransportClosed();
      for (const handler of this.closeHandlers) handler(reason);
      this.closeHandlers.clear();
    });
  }

  get pid(): number | null {
    return this.supervisor.pid;
  }

  get supervision(): WorkerSupervisionTelemetry {
    return this.supervisor.telemetry;
  }

  getResourceUsage(): WorkerResourceUsage | null {
    return this.supervisor.getResourceUsage();
  }

  getTerminationReason(): string | undefined {
    return this.supervisor.getTerminationReason();
  }

  onClose(handler: (reason?: string) => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  onResourceSample(handler: () => void): () => void {
    return this.supervisor.onResourceSample(handler);
  }

  onTermination(handler: () => void): () => void {
    return this.supervisor.onTermination(handler);
  }

  protected getRecentStderr(): string {
    return this.supervisor.getStderrTail();
  }

  protected onTransportClosed(): void {}

  protected async prepareTransport(): Promise<void> {}

  protected closeTransport(): Promise<void> | void {}

  protected rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  protected failTransport(message: string): void {
    const error = new Error(message);
    this.rejectAll(error);
    void this.supervisor.terminate(message);
  }

  protected handleLine(line: string): void {
    if (!line.trim()) return;
    let message: unknown;
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
      const text =
        typeof message.error.message === "string" ? message.error.message : "MCP request failed";
      pending.reject(new Error(text));
    } else {
      pending.resolve(message.result);
    }
  }

  protected handleStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    if (
      Buffer.byteLength(this.stdoutBuffer, "utf8") >
      (this.options.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES)
    ) {
      this.failTransport("fff-mcp stdout message exceeded the supervisor limit");
      return;
    }
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) this.handleLine(line);
  }

  protected abstract writeMessage(message: unknown): Promise<void> | void;

  private async request(
    method: string,
    params: Record<string, unknown>,
    timeoutMs = 0,
  ): Promise<unknown> {
    const id = ++this.nextId;
    const response = new Promise<unknown>((resolve, reject) => {
      const pending: PendingRequest = { resolve, reject };
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

  async connect(): Promise<void> {
    await this.supervisor.spawned;
    await this.prepareTransport();
    const initialized = await this.request(
      "initialize",
      {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "fff-router-supervisor", version: "2.0.0" },
      },
      this.options.initializeTimeoutMs ?? 10_000,
    );
    if (!isRecord(initialized) || typeof initialized.protocolVersion !== "string") {
      throw new Error("fff-mcp returned an invalid initialize response");
    }
    const notification = this.writeMessage({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    // The file-backed Perry transport completes the write synchronously. In
    // Perry 0.5.1220, awaiting the implicit promise from an async/synchronous
    // override can fail to resume even though the file was already consumed.
    // Node's pipe transport still needs its promise awaited for backpressure.
    if (!IS_PERRY) await notification;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return await this.request("tools/call", { name, arguments: args });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const transportClose = this.closeTransport();
    if (!IS_PERRY) await transportClose;
    await this.supervisor.close();
    this.rejectAll(new Error("fff-mcp client is closed"));
  }
}

export class LegacyMcpClient extends LegacyMcpClientBase {
  constructor(options: LegacyMcpClientOptions) {
    const supervisor = new ProcessSupervisor({ ...options, maxStderrBytes: 64 * 1_024 });
    super(options, supervisor);
    this.supervisor.child.stdout.setEncoding("utf8");
    this.supervisor.child.stdout.on("data", (chunk: string) => this.handleStdout(chunk));
  }

  protected async writeMessage(message: unknown): Promise<void> {
    if (this.closed || this.supervisor.child.stdin.destroyed) {
      throw new Error("fff-mcp client is closed");
    }
    const line = `${JSON.stringify(message)}\n`;
    if (this.supervisor.child.stdin.write(line)) return;
    await new Promise<void>((resolve, reject) => {
      const onDrain = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        this.supervisor.child.stdin.off("drain", onDrain);
        this.supervisor.child.stdin.off("error", onError);
      };
      this.supervisor.child.stdin.once("drain", onDrain);
      this.supervisor.child.stdin.once("error", onError);
    });
  }
}

/**
 * Perry's child_process implementation starts and supervises long-lived
 * children correctly, but it does not currently dispatch pipe stream events
 * reliably. This POSIX transport preserves the upstream stdio MCP protocol
 * while moving bytes through atomic request/response spool files and private
 * shell-owned FIFOs. The shell remains the supervised process-group leader so
 * the worker and both spool pumps are terminated as one unit.
 */
export class FileBackedLegacyMcpClient extends LegacyMcpClientBase {
  private readonly directory: string;
  private readonly readyPath: string;
  private readonly requestPrefix: string;
  private readonly responsePrefix: string;
  private readonly stderrPath: string;
  private requestSequence = 1;
  private responseSequence = 1;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private transportExited = false;

  constructor(options: LegacyMcpClientOptions) {
    if (process.platform === "win32") {
      throw new Error("file-backed fff-mcp transport requires a POSIX host");
    }
    const nonce = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    const directory = path.join(os.tmpdir(), `.fff-router-mcp.${nonce}`);
    const requestFifoPath = path.join(directory, "request.fifo");
    const requestPrefix = path.join(directory, "request");
    const responseFifoPath = path.join(directory, "response.fifo");
    const responsePrefix = path.join(directory, "response");
    const stderrPath = path.join(directory, "stderr.log");
    const readyPath = path.join(directory, "ready");
    mkdirSync(directory, { mode: 0o700 });
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
      'exit "$code"',
    ].join("; ");
    let supervisor: ProcessSupervisor;
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
          ...options.args,
        ],
        maxStderrBytes: 64 * 1_024,
      });
    } catch (caught) {
      rmSync(directory, { recursive: true, force: true });
      throw caught;
    }
    super(options, supervisor);
    this.directory = directory;
    this.readyPath = readyPath;
    this.requestPrefix = requestPrefix;
    this.responsePrefix = responsePrefix;
    this.stderrPath = stderrPath;
  }

  protected override getRecentStderr(): string {
    try {
      const fd = openSync(this.stderrPath, "r");
      try {
        const size = fstatSync(fd).size;
        const length = Math.min(size, 64 * 1_024);
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

  private cleanup(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    rmSync(this.directory, { recursive: true, force: true });
  }

  protected override onTransportClosed(): void {
    this.transportExited = true;
    this.cleanup();
  }

  private capStderr(): void {
    try {
      const details = statSync(this.stderrPath);
      if (details.size <= 64 * 1_024) return;
      const fd = openSync(this.stderrPath, "r");
      let tail: Buffer;
      try {
        tail = Buffer.alloc(64 * 1_024);
        readSync(fd, tail, 0, tail.byteLength, details.size - tail.byteLength);
      } finally {
        closeSync(fd);
      }
      // Diagnostic output is best effort; truncating may race with one log
      // write, but never with the JSON-RPC protocol stream.
      writeFileSync(this.stderrPath, tail, { mode: 0o600 });
    } catch {
      // The worker may not have emitted stderr yet.
    }
  }

  private pollResponse(): void {
    if (this.closed) return;
    try {
      this.capStderr();
      // Bound work per timer turn even if a buggy worker emits a burst.
      for (let handled = 0; handled < 256; handled += 1) {
        const responsePath = `${this.responsePrefix}.${this.responseSequence}.jsonl`;
        if (!existsSync(responsePath)) break;
        const size = statSync(responsePath).size;
        if (size > (this.options.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES)) {
          this.failTransport("fff-mcp stdout message exceeded the supervisor limit");
          return;
        }
        const line = readFileSync(responsePath, "utf8");
        rmSync(responsePath, { force: true });
        this.responseSequence += 1;
        this.handleStdout(line);
      }
    } catch (caught) {
      this.failTransport(
        `failed to read fff-mcp response transport: ${caught instanceof Error ? caught.message : String(caught)}`,
      );
    }
  }

  private scheduleResponsePoll(): void {
    if (this.closed || this.transportExited || this.pollTimer) return;
    this.pollTimer = setTimeout(
      () => {
        this.pollTimer = null;
        this.pollResponse();
        this.scheduleResponsePoll();
      },
      Math.max(5, this.options.filePollIntervalMs ?? 20),
    );
  }

  protected override async prepareTransport(): Promise<void> {
    const deadline = Date.now() + (this.options.initializeTimeoutMs ?? 10_000);
    while (true) {
      try {
        if (existsSync(this.readyPath) && statSync(this.readyPath).isFile()) break;
      } catch {
        // The shell may still be creating the private transport.
      }
      if (this.transportExited) {
        const details = this.supervisor.getStderrTail();
        throw new Error(
          `fff-mcp transport exited before its request spool became ready${details ? `: ${details}` : ""}`,
        );
      }
      if (Date.now() >= deadline) {
        const details = this.supervisor.getStderrTail();
        throw new Error(
          `fff-mcp request spool did not become ready${details ? `: ${details}` : ""}`,
        );
      }
      await wait(10);
    }
    // Perry 0.5.1220 neither reliably dispatches interval callbacks nor
    // unref'ed timeout callbacks. Keep this recursively scheduled one-shot
    // timer referenced until transport cleanup clears it.
    this.scheduleResponsePoll();
  }

  protected writeMessage(message: unknown): void {
    if (this.closed || this.transportExited) {
      throw new Error("fff-mcp client is closed");
    }
    const line = `${JSON.stringify(message)}\n`;
    if (
      Buffer.byteLength(line, "utf8") > (this.options.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES)
    ) {
      throw new Error("fff-mcp request message exceeded the supervisor limit");
    }
    const requestPath = `${this.requestPrefix}.${this.requestSequence}.jsonl`;
    const temporaryPath = `${requestPath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, line, { encoding: "utf8", mode: 0o600, flag: "wx" });
    renameSync(temporaryPath, requestPath);
    this.requestSequence += 1;
  }

  protected override closeTransport(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  override async close(): Promise<void> {
    try {
      await super.close();
    } finally {
      this.cleanup();
    }
  }
}

export function createLegacyMcpClient(
  options: LegacyMcpClientOptions,
): LegacyMcpClient | FileBackedLegacyMcpClient {
  return IS_PERRY ? new FileBackedLegacyMcpClient(options) : new LegacyMcpClient(options);
}
