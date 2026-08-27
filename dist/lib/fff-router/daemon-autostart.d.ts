import { type DaemonMetadata } from "./http-daemon";
type DaemonLaunchSource = "env" | "path" | "packaged" | "native";
export declare function resolveDaemonLaunchCommand(env?: NodeJS.ProcessEnv, deps?: {
    preferPackaged?: boolean;
    resolveExecutableOnPath?: (command: string) => string | null;
    nativeRuntime?: boolean;
}): {
    command: string;
    args: string[];
    source: DaemonLaunchSource;
};
export declare function checkDaemonBaseHealth(env?: NodeJS.ProcessEnv): Promise<void>;
export declare function checkDaemonHealth(env?: NodeJS.ProcessEnv): Promise<void>;
export declare function shouldReclaimStartupLock(args: {
    contents: string;
    mtimeMs: number;
    now?: number;
    isAlive?: (pid: number) => boolean;
}): boolean;
export declare function formatDaemonStartupError(error: unknown, env?: NodeJS.ProcessEnv): Promise<Error>;
export declare function readDaemonLogs(env?: NodeJS.ProcessEnv): Promise<{
    stdoutPath: string;
    stderrPath: string;
    stdout: string;
    stderr: string;
}>;
export declare function ensureDaemonRunningWithDeps(env: NodeJS.ProcessEnv | undefined, deps: {
    checkDaemonHealth: (env?: NodeJS.ProcessEnv) => Promise<void>;
    checkDaemonBaseHealth?: (env?: NodeJS.ProcessEnv) => Promise<void>;
    readRunningDaemonMetadata: (env?: NodeJS.ProcessEnv) => Promise<DaemonMetadata | null>;
    signalProcess: (pid: number, signal: NodeJS.Signals) => Promise<void>;
    terminateProcess: (pid: number) => Promise<void>;
    spawnDaemon: (env?: NodeJS.ProcessEnv, options?: {
        preferPackaged?: boolean;
    }) => {
        unref: () => void;
        source: DaemonLaunchSource;
    };
    waitForDaemonReady: (env?: NodeJS.ProcessEnv) => Promise<void>;
    withStartupLock: (callback: () => Promise<void>, env?: NodeJS.ProcessEnv) => Promise<void>;
    isProcessAlive?: (pid: number) => boolean;
}): Promise<void>;
export declare function ensureDaemonRunning(env?: NodeJS.ProcessEnv): Promise<void>;
export declare function readRunningDaemonMetadata(env?: NodeJS.ProcessEnv): Promise<DaemonMetadata | null>;
export {};
