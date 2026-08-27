export type DoctorFffMcpStatus = {
    found: false;
    source?: "missing";
    executable?: false;
    envVar?: string;
    remediation?: string;
} | {
    found: true;
    path: string;
    source: "env" | "path" | "managed";
    executable: boolean;
    envVar: string;
    version?: string;
    remediation?: string;
};
export declare function detectFffMcpTarget(platform?: NodeJS.Platform, arch?: NodeJS.Architecture): string;
export declare function findFffMcpOnPath(env?: NodeJS.ProcessEnv): string | null;
export declare function getDoctorFffMcpStatus(env?: NodeJS.ProcessEnv): Promise<DoctorFffMcpStatus>;
