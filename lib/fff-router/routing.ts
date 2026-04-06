import path from "node:path";
import type { Result, RouterConfig, RoutingTarget } from "./types";

type DeriveArgs = {
  realPath: string;
  statType: "file" | "directory";
  gitRoot: string | null;
  config: RouterConfig;
};

function invalidConfig(message: string): Result<never> {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message,
    },
  };
}

function outsideAllowedScope(realPath: string): Result<never> {
  return {
    ok: false,
    error: {
      code: "OUTSIDE_ALLOWED_SCOPE",
      message: `search_path '${realPath}' is outside a git repo and not under an allowlisted non-git prefix`,
    },
  };
}

function normalizeAllowlistedPrefixes(config: RouterConfig): Result<string[]> {
  const normalized = new Set<string>();

  for (const entry of config.allowlistedNonGitPrefixes) {
    if (!path.isAbsolute(entry.prefix)) {
      return invalidConfig("allowlisted non-git prefixes must be absolute paths");
    }

    normalized.add(path.normalize(entry.prefix));
  }

  return {
    ok: true,
    value: [...normalized].sort((a, b) => b.length - a.length),
  };
}

function longestMatchingPrefix(realPath: string, prefixes: string[]): string | null {
  for (const prefix of prefixes) {
    if (realPath === prefix || realPath.startsWith(prefix + path.sep)) {
      return prefix;
    }
  }

  return null;
}

function deriveFirstChildRoot(prefix: string, realPath: string): string | null {
  const relative = path.relative(prefix, realPath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  const firstSegment = relative.split(path.sep)[0];
  if (!firstSegment) {
    return null;
  }

  return path.join(prefix, firstSegment);
}

export function deriveRoutingTarget(args: DeriveArgs): Result<RoutingTarget> {
  if (args.gitRoot) {
    return {
      ok: true,
      value: {
        rootType: "git",
        persistenceRoot: path.normalize(args.gitRoot),
        searchScope: args.realPath,
        backendMode: "persistent",
        ttlMs: args.config.ttl.gitMs,
      },
    };
  }

  const prefixes = normalizeAllowlistedPrefixes(args.config);
  if (!prefixes.ok) {
    return prefixes;
  }

  const matchedPrefix = longestMatchingPrefix(args.realPath, prefixes.value);
  if (!matchedPrefix) {
    return outsideAllowedScope(args.realPath);
  }

  const persistenceRoot = deriveFirstChildRoot(matchedPrefix, args.realPath);
  if (!persistenceRoot) {
    return outsideAllowedScope(args.realPath);
  }

  return {
    ok: true,
    value: {
      rootType: "non-git",
      persistenceRoot,
      searchScope: args.realPath,
      backendMode: "ephemeral-candidate",
      ttlMs: args.config.ttl.nonGitMs,
    },
  };
}
