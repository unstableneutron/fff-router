import { LegacyMcpClient, type LegacyMcpClientOptions } from "../legacy-mcp-client";
import type { WorkerSupervisionTelemetry } from "../types";
import type { SearchBackendAdapter, SearchBackendRuntime } from "./types";
export type FffMcpRuntime = SearchBackendRuntime & {
    callTool: (name: string, args: Record<string, unknown>) => Promise<string>;
};
type FffMcpClient = {
    readonly pid: number | null;
    readonly supervision: WorkerSupervisionTelemetry;
    connect: () => Promise<void>;
    close: () => Promise<void> | void;
    callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    onClose: (handler: (reason?: string) => void) => () => void;
    onResourceSample: (handler: () => void) => () => void;
    onTermination: (handler: () => void) => () => void;
    getResourceUsage: LegacyMcpClient["getResourceUsage"];
    getTerminationReason: LegacyMcpClient["getTerminationReason"];
};
type CreateFffMcpStdioAdapterOptions = {
    resolveCommand?: () => string;
    createClient?: (params: LegacyMcpClientOptions) => FffMcpClient;
    waitForReady?: (callTool: (name: string, args: Record<string, unknown>) => Promise<string>) => Promise<string>;
};
/**
 * Walks an fff-mcp compact-text response and keeps only the path blocks whose
 * header relative-path satisfies `keep`. Preamble lines (`N/M matches shown`,
 * `0 matches`, `0 exact matches`, `cursor:…`, blanks) pass through this
 * low-level filter so callers can decide which metadata to preserve or strip;
 * `→ Read <path>` recommendations are dropped when the recommended path has
 * been filtered out so the rendered preamble never points at a file we just
 * removed from the body. Indented numbered lines (`  N:`, `  N-`, `  N|`)
 * and `--` block separators are emitted only while the active header is
 * accepted.
 *
 * The predicate mirrors the one the adapter applies to `items` via
 * `filterItems` so that `items` and `renderedCompact` describe the same set
 * of paths. fff-mcp's multi_grep/grep DSL treats bare path tokens as fuzzy
 * filename hints (not strict filters), so even with a tight constraint it
 * can still return path blocks from siblings of the restricted file. This
 * filter is the correctness gate; the anchored-glob constraint token in
 * `buildConstraintTokens` is just a performance hint to reduce the amount
 * of unrelated scanning fff-mcp has to do.
 */
export declare function filterRenderedCompactText(text: string, keep: (relativePath: string) => boolean): string;
/** Current fff-mcp blocks tool calls until its initial scan is complete. */
export declare const DEFAULT_FFF_MCP_READY_TIMEOUT_MS = 30000;
export interface WaitForFffMcpReadyOptions {
    deadlineMs?: number;
}
export declare function waitForFffMcpReady(callTool: (name: string, args: Record<string, unknown>) => Promise<string>, options?: WaitForFffMcpReadyOptions): Promise<string>;
export declare function createFffMcpStdioAdapter(options?: CreateFffMcpStdioAdapterOptions): SearchBackendAdapter<FffMcpRuntime>;
export {};
