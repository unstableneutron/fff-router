export declare function readDaemonAuthToken(env?: NodeJS.ProcessEnv): Promise<string | null>;
export declare function ensureDaemonAuthToken(env?: NodeJS.ProcessEnv): Promise<string>;
export declare function bearerHeaders(token: string | null): Record<string, string>;
export declare function isAuthorized(authorization: string | string[] | undefined, expectedToken: string): boolean;
