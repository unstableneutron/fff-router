type FffMcpRelease = {
    tag: string;
    version: string;
    assetUrl: string;
    checksumUrl: string;
};
export type FffMcpUpdatePlan = {
    kind: "missing" | "outdated";
    binaryPath: string;
    target: string;
    currentVersion: string | null;
    latestVersion: string;
    latestTag: string;
    assetUrl: string;
    checksumUrl: string;
};
export type FffMcpUpdateCheck = FffMcpUpdatePlan | {
    kind: "current";
    binaryPath: string;
    target: string;
    currentVersion: string;
    latestVersion: string;
    latestTag: string;
} | {
    kind: "unavailable";
    binaryPath: string;
    message: string;
};
export type FffRouterdUpdateCheck = {
    kind: "outdated";
    currentVersion: string;
    latestVersion: string;
    installer: "corepack-pnpm" | "aube" | "pnpm";
    command: string[];
} | {
    kind: "current";
    currentVersion: string;
    latestVersion: string;
} | {
    kind: "unavailable";
    currentVersion: string;
    message: string;
};
type Confirm = (question: string) => Promise<boolean>;
export type RunInteractiveUpdateOptions = {
    env?: NodeJS.ProcessEnv;
    checkFffMcpUpdate?: () => Promise<FffMcpUpdateCheck>;
    checkFffRouterdUpdate?: () => Promise<FffRouterdUpdateCheck>;
    installFffMcpUpdate?: (plan: FffMcpUpdatePlan) => Promise<string>;
    installFffRouterdUpdate?: (plan: Extract<FffRouterdUpdateCheck, {
        kind: "outdated";
    }>) => Promise<void>;
    stopDaemon?: () => Promise<boolean>;
    confirm?: Confirm;
    writeStdout?: (text: string) => void;
    writeStderr?: (text: string) => void;
};
export declare function selectLatestFffMcpRelease(releases: unknown[], target: string): FffMcpRelease;
export declare function checkFffMcpUpdate(args?: {
    env?: NodeJS.ProcessEnv;
    target?: string;
    readInstalledVersion?: (binaryPath: string) => Promise<string | null>;
    getLatestRelease?: (target: string) => Promise<FffMcpRelease>;
}): Promise<FffMcpUpdateCheck>;
export declare function installFffMcpUpdate(plan: FffMcpUpdatePlan, deps?: {
    downloadToFile?: (url: string, destinationPath: string) => Promise<void>;
    fetchText?: (url: string) => Promise<string>;
}): Promise<string>;
export declare function checkFffRouterdUpdate(args?: {
    currentVersion?: string;
    getLatestVersion?: () => Promise<string>;
    commandExists?: (command: string) => Promise<boolean>;
}): Promise<FffRouterdUpdateCheck>;
export declare function installFffRouterdUpdate(plan: Extract<FffRouterdUpdateCheck, {
    kind: "outdated";
}>): Promise<void>;
export declare function runInteractiveUpdate(options?: RunInteractiveUpdateOptions): Promise<number>;
export {};
