import type { Result, SearchBackendId, SearchQueryKind, ValidatedWithinEntry, WorkerResourceUsage, WorkerSupervisionTelemetry } from "../types";
export type SearchBackendRuntime = {
    id: string;
    pid?: number | null;
    supervision?: WorkerSupervisionTelemetry;
    close: () => Promise<void> | void;
    onClose?: (handler: (reason?: string) => void) => () => void;
    onResourceSample?: (handler: () => void) => () => void;
    onTermination?: (handler: () => void) => () => void;
    getResourceUsage?: () => WorkerResourceUsage | null;
    getTerminationReason?: () => string | undefined;
};
export type RuntimeStartSpec<TRuntime extends SearchBackendRuntime = SearchBackendRuntime> = {
    persistenceRoot: string;
    start: () => Promise<TRuntime>;
};
export type BackendRequestBase = {
    persistenceRoot: string;
    within: string;
    basePath: string;
    fileRestriction?: string;
    additionalWithinEntries?: ValidatedWithinEntry[];
    glob?: string;
    extensions: string[];
    excludePaths: string[];
    limit: number;
    cursor: string | null;
};
export type FindFilesBackendRequest = BackendRequestBase & {
    queryKind: "find_files";
    query: string;
};
export type GrepBackendRequest = BackendRequestBase & {
    queryKind: "grep";
    patterns: string[];
    literal: boolean;
    contextLines: number;
};
export type BackendSearchRequest = FindFilesBackendRequest | GrepBackendRequest;
export type BackendFileItem = {
    path: string;
    relativePath: string;
};
export type BackendTextMatch = {
    path: string;
    relativePath: string;
    line: number;
    text: string;
    column?: number;
    contextBefore?: string[];
    contextAfter?: string[];
    isDefinition?: boolean;
    definitionBody?: string[];
};
export type BackendResultItem = BackendFileItem | BackendTextMatch;
export type BackendSearchError = {
    code: "WORKER_UNAVAILABLE" | "SEARCH_FAILED";
    message: string;
    backendId: SearchBackendId;
};
export type BackendSearchSummary = {
    shownCount?: number;
    totalCount?: number;
    readRecommendation?: {
        relativePath: string;
        reason?: string;
    };
};
export type BackendSearchSuccess = {
    backendId: SearchBackendId;
    queryKind: SearchQueryKind;
    items: BackendResultItem[];
    nextCursor: string | null;
    renderedCompact?: string;
    summary?: BackendSearchSummary;
    diagnostics?: Record<string, unknown>;
};
export type BackendSearchResult = Result<BackendSearchSuccess, BackendSearchError>;
export interface SearchBackendAdapter<TRuntime extends SearchBackendRuntime = SearchBackendRuntime> {
    readonly backendId: "fff-mcp";
    startRuntime: (args: {
        persistenceRoot: string;
        supervision?: {
            sampleIntervalMs?: number;
            maxRssBytes?: number;
            shutdownGraceMs?: number;
            killGraceMs?: number;
            orphanIdleTimeoutMs?: number;
        };
    }) => Promise<TRuntime>;
    execute: (args: {
        request: BackendSearchRequest;
        runtime: TRuntime;
    }) => Promise<BackendSearchResult>;
}
