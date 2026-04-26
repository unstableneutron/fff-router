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

export async function validateResolvedWithin(args: {
  within: string;
}): Promise<Result<ValidatedWithin, PublicError>> {
  const entry = await validateResolvedWithinEntry(args.within);
  if (!entry.ok) {
    return entry;
  }
  return { ok: true, value: entry.value };
}

/**
 * Multi-path counterpart to `validateResolvedWithin`: resolves + validates
 * each path independently, preserves order, and returns a `ValidatedWithin`
 * whose primary entry is the first input (so the coordinator's existing
 * routing / persistence-root logic can keep operating on the head entry).
 *
 * Downstream checks (all entries share a routing target) live in the
 * coordinator — this function only does per-entry path resolution.
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
      additionalEntries: rest,
    },
  };
}
