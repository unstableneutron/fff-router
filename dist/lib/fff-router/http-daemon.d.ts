import { type IncomingMessage, type ServerResponse } from "node:http";
import { type FffMcpRuntime } from "./adapters/fff-mcp-stdio";
import { type DaemonConfig, type DaemonReloadConfig } from "./daemon-config";
import { type RouterConfigRef } from "./coordinator";
import { WorkerPool } from "./runtime-manager";
import type { RouterService } from "./types";
export declare const DAEMON_CONTROL_PATH = "/control";
export type DaemonMetadata = {
    pid: number;
    host: string;
    port: number;
    mcpPath: string;
    controlPath?: string;
    protocolVersion: string;
    packageVersion: string;
    daemonSourceFingerprint?: string;
    serverFingerprint: string;
    reloadFingerprint: string;
    startedAt: number;
};
export type StartHttpDaemonArgs = Partial<DaemonConfig> & {
    service?: RouterService;
    createService?: (args: {
        configRef: RouterConfigRef;
        workerPool: WorkerPool<FffMcpRuntime>;
    }) => RouterService;
    configRef?: RouterConfigRef;
    loadReloadConfig?: (args?: {
        env?: NodeJS.ProcessEnv;
    }) => DaemonReloadConfig;
    env?: NodeJS.ProcessEnv;
    watchConfig?: boolean;
};
type DaemonReloadOptions = {
    loadConfig?: () => DaemonReloadConfig;
    clearRuntimes?: boolean;
};
export declare function readDaemonMetadata(pathValue: string): Promise<DaemonMetadata | null>;
export declare function startHttpDaemon(args?: StartHttpDaemonArgs): Promise<{
    server: import("http").Server<typeof IncomingMessage, typeof ServerResponse>;
    readonly metadata: DaemonMetadata;
    paths: import("./daemon-config").DaemonPaths;
    readonly url: string;
    reload: (override?: DaemonReloadOptions) => Promise<void>;
    done: Promise<void>;
    close: () => Promise<void>;
}>;
export {};
