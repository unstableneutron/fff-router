import fs from "node:fs/promises";
import path from "node:path";
import { expandHomePath } from "./home-path";
import type {
  PublicError,
  ResolvedWithinFromCaller,
  Result,
  ValidatedWithin,
  ValidatedWithinEntry,
} from "./types";

function invalid(message: string): Result<never, PublicError> {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message,
    },
  };
}

function withinNotFound(within: string): Result<never, PublicError> {
  return {
    ok: false,
    error: {
      code: "WITHIN_NOT_FOUND",
      message: `within '${within}' does not exist`,
    },
  };
}

function internalError(message: string): Result<never, PublicError> {
  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message,
    },
  };
}

function validateAbsolutePath(candidate: string, field: string): Result<string, PublicError> {
  const trimmed = candidate.trim();
  if (trimmed === "") {
    return invalid(`${field} must be a non-empty path`);
  }

  if (!path.isAbsolute(trimmed)) {
    return invalid(`${field} must be absolute`);
  }

  return { ok: true, value: trimmed };
}

function resolveStatType(
  stats: Awaited<ReturnType<typeof fs.stat>>,
): Result<"file" | "directory", PublicError> {
  if (stats.isDirectory()) {
    return { ok: true, value: "directory" };
  }

  if (stats.isFile()) {
    return { ok: true, value: "file" };
  }

  return invalid("within must point to a regular file or directory");
}

export async function resolveWithinFromCaller(args: {
  callerCwd: string;
  within?: string | null;
  env?: NodeJS.ProcessEnv;
}): Promise<Result<ResolvedWithinFromCaller, PublicError>> {
  const env = args.env ?? process.env;
  const callerCwd = validateAbsolutePath(args.callerCwd, "callerCwd");
  if (!callerCwd.ok) {
    return callerCwd;
  }

  if (args.within == null) {
    return { ok: true, value: { resolvedWithin: callerCwd.value } };
  }

  const expandedWithin = expandHomePath(args.within, env);
  if (!expandedWithin.ok) {
    return expandedWithin;
  }

  const within = expandedWithin.value;
  if (within === "") {
    return invalid("within must be a non-empty string when provided");
  }

  return {
    ok: true,
    value: {
      resolvedWithin: path.isAbsolute(within) ? within : path.resolve(callerCwd.value, within),
    },
  };
}

async function validateResolvedWithinEntry(
  candidate: string,
): Promise<Result<ValidatedWithinEntry, PublicError>> {
  const within = validateAbsolutePath(candidate, "within");
  if (!within.ok) {
    return within;
  }

  let resolvedWithin: string;
  try {
    resolvedWithin = await fs.realpath(within.value);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return withinNotFound(within.value);
    }

    return internalError(`failed to canonicalize within '${within.value}'`);
  }

  let stats;
  try {
    stats = await fs.stat(resolvedWithin);
  } catch {
    return internalError(`failed to stat resolved within '${resolvedWithin}'`);
  }

  const statType = resolveStatType(stats);
  if (!statType.ok) {
    return statType;
  }

  if (statType.value === "directory") {
    return {
      ok: true,
      value: {
        resolvedWithin,
        basePath: resolvedWithin,
      },
    };
  }

  return {
    ok: true,
    value: {
      resolvedWithin,
      basePath: path.dirname(resolvedWithin),
      fileRestriction: resolvedWithin,
    },
  };
}

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
export async function validateResolvedWithinPaths(args: {
  withinPaths: string[];
}): Promise<Result<ValidatedWithin, PublicError>> {
  if (args.withinPaths.length === 0) {
    return invalid("withinPaths must contain at least one entry");
  }

  const entries: ValidatedWithinEntry[] = [];
  for (const candidate of args.withinPaths) {
    const entry = await validateResolvedWithinEntry(candidate);
    if (!entry.ok) {
      return entry;
    }
    entries.push(entry.value);
  }

  const [primary, ...rest] = entries as [ValidatedWithinEntry, ...ValidatedWithinEntry[]];
  return {
    ok: true,
    value: {
      resolvedWithin: primary.resolvedWithin,
      basePath: primary.basePath,
      ...(primary.fileRestriction !== undefined
        ? { fileRestriction: primary.fileRestriction }
        : {}),
      ...(rest.length > 0 ? { additionalEntries: rest } : {}),
    },
  };
}

/**
 * Single-path convenience wrapper over `validateResolvedWithinPaths`. Kept
 * as the preferred entry point for callers that only ever have one path
 * and don't want to wrap it in an array just to unwrap the head again.
 */
export async function validateResolvedWithin(args: {
  within: string;
}): Promise<Result<ValidatedWithin, PublicError>> {
  return validateResolvedWithinPaths({ withinPaths: [args.within] });
}
