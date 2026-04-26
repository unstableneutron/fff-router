import path from "node:path";
import picomatch from "picomatch";
import type { BackendResultItem, BackendSearchRequest } from "./types";

export function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
}

function matchesSingleEntry(
  entry: { within: string; fileRestriction?: string },
  candidatePath: string,
): boolean {
  if (entry.fileRestriction) {
    return candidatePath === entry.fileRestriction;
  }

  return candidatePath === entry.within || candidatePath.startsWith(entry.within + path.sep);
}

export function pathWithinScope(request: BackendSearchRequest, candidatePath: string): boolean {
  if (
    matchesSingleEntry(
      {
        within: request.within,
        ...(request.fileRestriction !== undefined
          ? { fileRestriction: request.fileRestriction }
          : {}),
      },
      candidatePath,
    )
  ) {
    return true;
  }

  // Multi-path: accept results that fall under ANY of the additional entries
  // (union semantics — same as `grep PAT file1 file2`).
  for (const entry of request.additionalWithinEntries ?? []) {
    if (
      matchesSingleEntry(
        {
          within: entry.resolvedWithin,
          ...(entry.fileRestriction !== undefined
            ? { fileRestriction: entry.fileRestriction }
            : {}),
        },
        candidatePath,
      )
    ) {
      return true;
    }
  }

  return false;
}

export function matchesExtension(extensions: string[], relativePath: string): boolean {
  if (extensions.length === 0) {
    return true;
  }

  return extensions.some((extension) =>
    normalizeRelativePath(relativePath).endsWith(`.${extension}`),
  );
}

export function matchesGlob(glob: string | undefined, relativePath: string): boolean {
  if (!glob) {
    return true;
  }

  return picomatch(glob, {
    dot: true,
    basename: !glob.includes("/"),
  })(normalizeRelativePath(relativePath));
}

export function matchesExcludePaths(excludePaths: string[], relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);

  return !excludePaths.some((excludePath) => {
    return normalized === excludePath || normalized.startsWith(`${excludePath}/`);
  });
}

export function filterItems(
  request: BackendSearchRequest,
  items: BackendResultItem[],
): BackendResultItem[] {
  return items
    .filter((item) => pathWithinScope(request, item.path))
    .filter((item) => matchesGlob(request.glob, item.relativePath))
    .filter((item) => matchesExtension(request.extensions, item.relativePath))
    .filter((item) => matchesExcludePaths(request.excludePaths, item.relativePath))
    .slice(0, request.limit);
}

export function toRelativePath(persistenceRoot: string, absolutePath: string): string {
  return normalizeRelativePath(path.relative(persistenceRoot, absolutePath));
}
