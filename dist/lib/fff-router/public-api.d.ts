import type { FindFilesResult, GrepResult, PublicToolName, PublicToolRequest, PublicToolResult, Result, RouterError, RouterStatus, WorkerDiagnostic } from "./types";
export declare const MAX_RESULTS = 50;
export declare const MAX_CONTEXT_LINES = 5;
export declare const MAX_PATTERNS = 20;
export declare const MAX_FILTERS = 30;
export declare const MAX_WITHIN_PATHS = 10;
export declare const MAX_QUERY_LENGTH = 1024;
export type JsonSchema = {
    $schema?: string;
    type?: string | string[];
    [key: string]: unknown;
};
export type ValidationIssue = {
    path: Array<string | number>;
    message: string;
};
export type ValidationResult<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: {
        issues: ValidationIssue[];
    };
};
export declare class ProtocolValidationError extends Error {
    readonly issues: ValidationIssue[];
    constructor(issues: ValidationIssue[]);
}
export type RuntimeSchema<T> = JsonSchema & {
    readonly jsonSchema: JsonSchema;
    safeParse(value: unknown): ValidationResult<T>;
    parse(value: unknown): T;
};
export type FindFilesInput = {
    query: string;
    within: string | string[];
    glob?: string;
    extensions?: string[];
    excludePaths?: string[];
    limit?: number;
    cursor?: string | null;
};
export type GrepInput = {
    patterns: string[];
    literal?: boolean;
    contextLines?: number;
    within: string | string[];
    glob?: string;
    extensions?: string[];
    excludePaths?: string[];
    limit?: number;
    cursor?: string | null;
};
type ParsedCommonInput = {
    within: string | string[];
    glob?: string;
    extensions: string[];
    excludePaths: string[];
    limit: number;
    cursor: string | null;
};
type ParsedFindFilesInput = ParsedCommonInput & {
    query: string;
};
type ParsedGrepInput = ParsedCommonInput & {
    patterns: string[];
    literal: boolean;
    contextLines: number;
};
export declare const findFilesInputSchema: RuntimeSchema<ParsedFindFilesInput>;
export declare const grepInputSchema: RuntimeSchema<ParsedGrepInput>;
export declare const findFilesResultJsonSchema: JsonSchema;
export declare const grepResultJsonSchema: JsonSchema;
export declare const findFilesResultSchema: RuntimeSchema<FindFilesResult>;
export declare const grepResultSchema: RuntimeSchema<GrepResult>;
export declare const publicToolResultSchema: RuntimeSchema<PublicToolResult>;
export declare const workerDiagnosticJsonSchema: JsonSchema;
export declare const routerStatusJsonSchema: JsonSchema;
export declare const routerStatusSchema: RuntimeSchema<RouterStatus>;
export declare const warmResultJsonSchema: JsonSchema;
export declare const warmResultSchema: RuntimeSchema<{
    workers: WorkerDiagnostic[];
}>;
export declare const evictResultJsonSchema: JsonSchema;
export declare const evictResultSchema: RuntimeSchema<{
    evicted: string[];
}>;
export type PublicToolDefinition = {
    name: PublicToolName;
    description: string;
    inputSchema: RuntimeSchema<ParsedFindFilesInput> | RuntimeSchema<ParsedGrepInput>;
    outputSchema: JsonSchema;
};
export declare const PUBLIC_TOOL_DEFINITIONS: readonly PublicToolDefinition[];
export declare function normalizePublicToolInput(tool: PublicToolName, input: unknown, env?: NodeJS.ProcessEnv): Result<PublicToolRequest, RouterError>;
export {};
