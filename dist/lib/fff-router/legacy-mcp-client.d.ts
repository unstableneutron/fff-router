import type { WorkerResourceUsage, WorkerSupervisionTelemetry } from "./types";
import { ProcessSupervisor, type ProcessSupervisorOptions } from "./process-supervisor";
export type LegacyMcpClientOptions = Omit<ProcessSupervisorOptions, "maxStderrBytes"> & {
    initializeTimeoutMs?: number;
    maxMessageBytes?: number;
    filePollIntervalMs?: number;
};
declare abstract class LegacyMcpClientBase {
    protected readonly options: LegacyMcpClientOptions;
    readonly supervisor: ProcessSupervisor;
    private readonly pending;
    private readonly closeHandlers;
    private nextId;
    private stdoutBuffer;
    protected closed: boolean;
    protected constructor(options: LegacyMcpClientOptions, supervisor: ProcessSupervisor);
    get pid(): number | null;
    get supervision(): WorkerSupervisionTelemetry;
    getResourceUsage(): WorkerResourceUsage | null;
    getTerminationReason(): string | undefined;
    onClose(handler: (reason?: string) => void): () => void;
    onResourceSample(handler: () => void): () => void;
    onTermination(handler: () => void): () => void;
    protected getRecentStderr(): string;
    protected onTransportClosed(): void;
    protected prepareTransport(): Promise<void>;
    protected closeTransport(): Promise<void> | void;
    protected rejectAll(error: Error): void;
    protected failTransport(message: string): void;
    protected handleLine(line: string): void;
    protected handleStdout(chunk: string): void;
    protected abstract writeMessage(message: unknown): Promise<void> | void;
    private request;
    connect(): Promise<void>;
    callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
    close(): Promise<void>;
}
export declare class LegacyMcpClient extends LegacyMcpClientBase {
    constructor(options: LegacyMcpClientOptions);
    protected writeMessage(message: unknown): Promise<void>;
}
/**
 * Perry's child_process implementation starts and supervises long-lived
 * children correctly, but it does not currently dispatch pipe stream events
 * reliably. This POSIX transport preserves the upstream stdio MCP protocol
 * while moving bytes through atomic request/response spool files and private
 * shell-owned FIFOs. The shell remains the supervised process-group leader so
 * the worker and both spool pumps are terminated as one unit.
 */
export declare class FileBackedLegacyMcpClient extends LegacyMcpClientBase {
    private readonly directory;
    private readonly readyPath;
    private readonly requestPrefix;
    private readonly responsePrefix;
    private readonly stderrPath;
    private requestSequence;
    private responseSequence;
    private pollTimer;
    private transportExited;
    constructor(options: LegacyMcpClientOptions);
    protected getRecentStderr(): string;
    private cleanup;
    protected onTransportClosed(): void;
    private capStderr;
    private pollResponse;
    private scheduleResponsePoll;
    protected prepareTransport(): Promise<void>;
    protected writeMessage(message: unknown): void;
    protected closeTransport(): void;
    close(): Promise<void>;
}
export declare function createLegacyMcpClient(options: LegacyMcpClientOptions): LegacyMcpClient | FileBackedLegacyMcpClient;
export {};
