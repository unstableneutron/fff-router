import type { RouterConfig } from "./types";
export declare const DEFAULT_DAEMON_HOST = "127.0.0.1";
export declare const DAEMON_PROTOCOL_VERSION = "fff-router-v2";
export declare const DEFAULT_DAEMON_PORT = 4319;
export declare const DEFAULT_DAEMON_MCP_PATH = "/mcp";
export type DaemonConfig = {
    host: string;
    port: number;
    mcpPath: string;
};
export type DaemonReloadConfig = {
    router: RouterConfig;
};
export type DaemonFileConfig = {
    host?: string;
    port?: number;
    mcpPath?: string;
    allowlist?: string[];
    warmRoots?: string[];
    ttl?: {
        gitMs?: number;
        nonGitMs?: number;
    };
    limits?: {
        maxWorkers?: number;
        maxNonGitWorkers?: number;
        maxWorkerRssBytes?: number;
        maxTotalWorkerRssBytes?: number;
    };
    runtime?: {
        toolTimeoutMs?: number;
        sweepIntervalMs?: number;
        restartBackoffMs?: number;
        restartBackoffMaxMs?: number;
        processSampleIntervalMs?: number;
        processShutdownGraceMs?: number;
        processKillGraceMs?: number;
        workerOrphanIdleTimeoutMs?: number;
        daemonIdleTimeoutMs?: number;
    };
};
export type DaemonPolicyConfigPaths = {
    dir: string;
    jsonPath: string;
    jsoncPath: string;
};
export type DaemonPaths = {
    dir: string;
    authTokenPath: string;
    metadataPath: string;
    lockPath: string;
    stdoutLogPath: string;
    stderrLogPath: string;
};
export declare const PACKAGE_VERSION = "2.0.0";
export declare const PACKAGE_MANAGER = "pnpm@11.19.0";
export declare function getDaemonSourceFingerprint(args?: {
    env?: NodeJS.ProcessEnv;
    daemonEntrypointPath?: string;
}): string;
export declare function getDefaultDaemonConfig(): DaemonConfig;
export declare function getDefaultRouterConfig(): RouterConfig;
export declare function getDefaultDaemonReloadConfig(): DaemonReloadConfig;
export type DefaultDaemonFileConfig = {
    host: string;
    port: number;
    mcpPath: string;
    allowlist: string[];
    warmRoots: string[];
    ttl: {
        gitMs: number;
        nonGitMs: number;
    };
    limits: {
        maxWorkers: number;
        maxNonGitWorkers: number;
        maxWorkerRssBytes: number;
        maxTotalWorkerRssBytes: number;
    };
    runtime: {
        toolTimeoutMs: number;
        sweepIntervalMs: number;
        restartBackoffMs: number;
        restartBackoffMaxMs: number;
        processSampleIntervalMs: number;
        processShutdownGraceMs: number;
        processKillGraceMs: number;
        workerOrphanIdleTimeoutMs: number;
        daemonIdleTimeoutMs: number;
    };
};
export declare function getDefaultDaemonFileConfig(): DefaultDaemonFileConfig;
export declare function getDaemonPolicyConfigPaths(args?: {
    env?: NodeJS.ProcessEnv;
}): DaemonPolicyConfigPaths;
export declare function readPreferredDaemonPolicyFile(args?: {
    env?: NodeJS.ProcessEnv;
}): {
    path: string;
    text: string;
};
export declare function parseJsonWithComments(text: string): unknown;
export declare function getDaemonConfig(args?: {
    env?: NodeJS.ProcessEnv;
}): DaemonConfig;
export declare function formatDaemonUrlHost(host: string): string;
export declare function getDaemonOriginFromConfig(config: DaemonConfig): string;
export declare function getDaemonEndpoint(args?: {
    env?: NodeJS.ProcessEnv;
}): string;
export declare function loadDaemonReloadConfig(args?: {
    env?: NodeJS.ProcessEnv;
}): DaemonReloadConfig;
export declare function getDaemonServerFingerprint(args?: {
    env?: NodeJS.ProcessEnv;
    daemonConfig?: Partial<DaemonConfig>;
}): string;
export declare function getDaemonReloadFingerprintForConfig(config: DaemonReloadConfig): string;
export declare function getDaemonReloadFingerprint(args?: {
    env?: NodeJS.ProcessEnv;
}): string;
export declare function getDaemonConfigFingerprint(args?: {
    env?: NodeJS.ProcessEnv;
    daemonConfig?: Partial<DaemonConfig>;
}): string;
export declare function getDaemonPaths(args?: {
    env?: NodeJS.ProcessEnv;
}): DaemonPaths;
