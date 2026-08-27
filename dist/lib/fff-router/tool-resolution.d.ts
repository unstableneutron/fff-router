export type ResolvableToolName = "fff-mcp";
export type ToolResolutionSource = "env" | "path" | "managed" | "missing";
export type ToolResolution = {
    tool: ResolvableToolName;
    command: string | null;
    source: ToolResolutionSource;
    envVar: string;
    executable: boolean;
    remediation?: string;
};
export type ToolDiagnostic = ToolResolution & {
    version?: string;
};
export declare function resolveExecutableOnPath(command: string, env?: NodeJS.ProcessEnv): string | null;
export declare function resolveToolCommand(tool: ResolvableToolName, deps?: {
    env?: NodeJS.ProcessEnv;
    resolveExecutableOnPath?: (command: string) => string | null;
    isExecutable?: (pathValue: string) => boolean;
}): ToolResolution;
type RunVersion = (command: string, options: {
    timeoutMs: number;
}) => Promise<string | undefined>;
export declare function getToolDiagnostic(tool: ResolvableToolName, deps?: Parameters<typeof resolveToolCommand>[1] & {
    runVersion?: RunVersion;
    versionTimeoutMs?: number;
}): Promise<ToolDiagnostic>;
export {};
