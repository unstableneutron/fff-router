import fs from "node:fs/promises";
import path from "node:path";
import type { ResolvedSearchPath, Result, RouterErrorCode } from "./types";

function searchPathError(code: RouterErrorCode, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function discoverGitRoot(
  realPath: string,
  statType: "file" | "directory",
): Promise<string | null> {
  let current = statType === "directory" ? realPath : path.dirname(realPath);

  while (true) {
    if (await pathExists(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

function resolveStatType(stats: Awaited<ReturnType<typeof fs.stat>>): Result<"file" | "directory"> {
  if (stats.isDirectory()) {
    return { ok: true, value: "directory" };
  }

  if (stats.isFile()) {
    return { ok: true, value: "file" };
  }

  return searchPathError(
    "INVALID_REQUEST",
    "search_path must point to a regular file or directory",
  );
}

export async function resolveSearchPath(searchPath: string): Promise<Result<ResolvedSearchPath>> {
  let realPath: string;

  try {
    realPath = await fs.realpath(searchPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return searchPathError("SEARCH_PATH_NOT_FOUND", `search_path '${searchPath}' does not exist`);
    }

    return searchPathError("SEARCH_PATH_REALPATH_FAILED", `failed to canonicalize '${searchPath}'`);
  }

  let stats;
  try {
    stats = await fs.stat(realPath);
  } catch {
    return searchPathError(
      "SEARCH_PATH_REALPATH_FAILED",
      `failed to stat '${realPath}' after canonicalization`,
    );
  }

  const statType = resolveStatType(stats);
  if (!statType.ok) {
    return statType;
  }

  return {
    ok: true,
    value: {
      realPath,
      statType: statType.value,
      gitRoot: await discoverGitRoot(realPath, statType.value),
    },
  };
}
