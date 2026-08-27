import type { Result, RouterError } from "./types";
export declare function expandHomePath(candidate: string, env?: NodeJS.ProcessEnv): Result<string, RouterError>;
