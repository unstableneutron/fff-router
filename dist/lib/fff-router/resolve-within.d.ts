import type { ResolvedWithinFromCaller, Result, RouterError, ValidatedWithin } from "./types";
export declare function resolveWithinFromCaller(args: {
    callerCwd: string;
    within?: string | null;
    env?: NodeJS.ProcessEnv;
}): Promise<Result<ResolvedWithinFromCaller, RouterError>>;
/**
 * Resolve + validate one or more within paths and pack them into a single
 * `ValidatedWithin`. The first path becomes the primary entry (exposed on
 * the result itself for single-path consumers that read `resolvedWithin` /
 * `basePath` / `fileRestriction` directly); any remaining paths land in
 * `additionalEntries` for multi-path-aware code.
 *
 * Per-entry validation (absolute path, exists, canonicalizes) happens here.
 * The cross-entry check that all paths share a routing target is the
 * coordinator's job — it needs the routing resolver and allowlist.
 */
export declare function validateResolvedWithinPaths(args: {
    withinPaths: string[];
}): Promise<Result<ValidatedWithin, RouterError>>;
/**
 * Single-path convenience wrapper over `validateResolvedWithinPaths`. Kept
 * as the preferred entry point for callers that only ever have one path
 * and don't want to wrap it in an array just to unwrap the head again.
 */
export declare function validateResolvedWithin(args: {
    within: string;
}): Promise<Result<ValidatedWithin, RouterError>>;
