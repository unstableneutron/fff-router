import { type DoctorFffMcpStatus } from "./fff-mcp-installer";
import { readDaemonLogs, resolveDaemonLaunchCommand } from "./daemon-autostart";
import { type DaemonMetadata } from "./http-daemon";
import { getDaemonConfig } from "./daemon-config";
import type { RouterStatus, WorkerDiagnostic } from "./types";
export type DaemonStatus = {
    running: boolean;
    metadata: DaemonMetadata | null;
    workers?: WorkerDiagnostic[];
    limits?: RouterStatus["limits"];
    resources?: RouterStatus["resources"];
};
export type DoctorReport = DaemonStatus & {
    endpoint: string;
    configPath: string;
    stateDir: string;
    daemonConfig: ReturnType<typeof getDaemonConfig>;
    fffMcp: DoctorFffMcpStatus;
    daemon: ReturnType<typeof resolveDaemonLaunchCommand>;
};
export declare function getDaemonStatus(env?: NodeJS.ProcessEnv): Promise<DaemonStatus>;
export declare function reloadDaemon(env?: NodeJS.ProcessEnv, options?: {
    clearRuntimes?: boolean;
}): Promise<boolean>;
export declare function stopDaemon(env?: NodeJS.ProcessEnv): Promise<boolean>;
export declare function runForegroundDaemon(env?: NodeJS.ProcessEnv): Promise<void>;
export declare function getDoctorReport(env?: NodeJS.ProcessEnv): Promise<DoctorReport>;
export declare function main(argv: string[], env?: NodeJS.ProcessEnv): Promise<number>;
export { readDaemonLogs };
