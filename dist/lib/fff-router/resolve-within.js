// lib/fff-router/resolve-within.ts
import { realpathSync, statSync } from "node:fs";
import path2 from "node:path";

// lib/fff-router/home-path.ts
import path from "node:path";
function invalid(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function joinHome(home, suffix) {
  return suffix ? path.join(home, suffix) : home;
}
function expandHomePath(candidate, env = process.env) {
  const trimmed = candidate.trim();
  const home = env.HOME?.trim();
  if (trimmed === "~" || trimmed.startsWith("~/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice(2)) };
  }
  if (trimmed === "$HOME" || trimmed.startsWith("$HOME/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice("$HOME/".length)) };
  }
  if (trimmed === "${HOME}" || trimmed.startsWith("${HOME}/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice("${HOME}/".length)) };
  }
  return { ok: true, value: trimmed };
}

// lib/fff-router/resolve-within.ts
function invalid2(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function withinNotFound(within) {
  return {
    ok: false,
    error: {
      code: "WITHIN_NOT_FOUND",
      message: `within '${within}' does not exist`
    }
  };
}
function internalError(message) {
  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message
    }
  };
}
function validateAbsolutePath(candidate, field) {
  const trimmed = candidate.trim();
  if (trimmed === "") {
    return invalid2(`${field} must be a non-empty path`);
  }
  if (!path2.isAbsolute(trimmed)) {
    return invalid2(`${field} must be absolute`);
  }
  return { ok: true, value: trimmed };
}
function resolveStatType(stats) {
  if (stats.isDirectory()) {
    return { ok: true, value: "directory" };
  }
  if (stats.isFile()) {
    return { ok: true, value: "file" };
  }
  return invalid2("within must point to a regular file or directory");
}
async function resolveWithinFromCaller(args) {
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
    return invalid2("within must be a non-empty string when provided");
  }
  return {
    ok: true,
    value: {
      resolvedWithin: path2.isAbsolute(within) ? within : path2.resolve(callerCwd.value, within)
    }
  };
}
async function validateResolvedWithinEntry(candidate) {
  const within = validateAbsolutePath(candidate, "within");
  if (!within.ok) {
    return within;
  }
  let resolvedWithin;
  try {
    resolvedWithin = realpathSync(within.value);
  } catch (error) {
    const code = error.code;
    if (code === "ENOENT") {
      return withinNotFound(within.value);
    }
    return internalError(`failed to canonicalize within '${within.value}'`);
  }
  let stats;
  try {
    stats = statSync(resolvedWithin);
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
        basePath: resolvedWithin
      }
    };
  }
  return {
    ok: true,
    value: {
      resolvedWithin,
      basePath: path2.dirname(resolvedWithin),
      fileRestriction: resolvedWithin
    }
  };
}
async function validateResolvedWithinPaths(args) {
  if (args.withinPaths.length === 0) {
    return invalid2("withinPaths must contain at least one entry");
  }
  const entries = [];
  for (const candidate of args.withinPaths) {
    const entry = await validateResolvedWithinEntry(candidate);
    if (!entry.ok) {
      return entry;
    }
    entries.push(entry.value);
  }
  const [primary, ...rest] = entries;
  return {
    ok: true,
    value: {
      resolvedWithin: primary.resolvedWithin,
      basePath: primary.basePath,
      ...primary.fileRestriction !== void 0 ? { fileRestriction: primary.fileRestriction } : {},
      ...rest.length > 0 ? { additionalEntries: rest } : {}
    }
  };
}
async function validateResolvedWithin(args) {
  return validateResolvedWithinPaths({ withinPaths: [args.within] });
}
export {
  resolveWithinFromCaller,
  validateResolvedWithin,
  validateResolvedWithinPaths
};
