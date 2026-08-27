import type { FindFilesResult, GrepResult, Result, RouterError, RouterStatus, WorkerDiagnostic } from "./types";
type CommonClientInput = {
    within?: string | string[];
    glob?: string;
    extensions?: string[];
    excludePaths?: string[];
    limit?: number;
    cursor?: string | null;
};
export type FindFilesClientInput = CommonClientInput & {
    query: string;
};
export type GrepClientInput = CommonClientInput & {
    patterns: string | string[];
    literal?: boolean;
    contextLines?: number;
};
export type RouterClientOptions = {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
    autoStart?: boolean;
};
export type ToolResponse = {
    resultType?: "complete";
    isError?: boolean;
    content?: Array<{
        type: string;
        text?: string;
    }>;
    structuredContent?: unknown;
};
export declare class RouterClient {
    private endpoint;
    private authToken;
    private connecting;
    private closed;
    private requestId;
    private readonly env;
    private readonly cwd;
    private readonly autoStart;
    get isClosed(): boolean;
    constructor(options?: RouterClientOptions);
    private connect;
    private disconnect;
    private request;
    callMcpTool(name: string, input: Record<string, unknown>, allowReconnect?: boolean): Promise<ToolResponse>;
    private callTool;
    findFiles(input: FindFilesClientInput): Promise<Result<FindFilesResult, RouterError>>;
    grep(input: GrepClientInput): Promise<Result<GrepResult, RouterError>>;
    warm(within: string | string[]): Promise<Result<{
        workers: WorkerDiagnostic[];
    }, RouterError>>;
    evict(within: string | string[]): Promise<Result<{
        evicted: string[];
    }, RouterError>>;
    status(): Promise<Result<RouterStatus, RouterError>>;
    close(): Promise<void>;
}
export declare function connectRouter(options?: RouterClientOptions): Promise<RouterClient>;
export declare function getRouterClient(options?: RouterClientOptions): Promise<RouterClient>;
export {};
