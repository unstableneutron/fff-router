import fs from "node:fs/promises";
import path from "node:path";
import type { PublicError, ResolvedWithinFromCaller, Result, ValidatedWithin } from "./types";

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
}): Promise<Result<ResolvedWithinFromCaller, PublicError>> {
  const callerCwd = validateAbsolutePath(args.callerCwd, "callerCwd");
  if (!callerCwd.ok) {
    return callerCwd;
  }

  if (args.within == null) {
    return { ok: true, value: { resolvedWithin: callerCwd.value } };
  }

  const within = args.within.trim();
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

export async function validateResolvedWithin(args: {
  within: string;
}): Promise<Result<ValidatedWithin, PublicError>> {
  const within = validateAbsolutePath(args.within, "within");
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
