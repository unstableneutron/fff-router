import path from "node:path";
import type { BackendResultItem, BackendSearchRequest } from "./types";

export function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
}

export function pathWithinScope(request: BackendSearchRequest, candidatePath: string): boolean {
  if (request.fileRestriction) {
    return candidatePath === request.fileRestriction;
  }

  return candidatePath === request.within || candidatePath.startsWith(request.within + path.sep);
}

export function matchesExtension(extensions: string[], relativePath: string): boolean {
  if (extensions.length === 0) {
    return true;
  }

  return extensions.some((extension) =>
    normalizeRelativePath(relativePath).endsWith(`.${extension}`),
  );
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
    .filter((item) => matchesExtension(request.extensions, item.relativePath))
    .filter((item) => matchesExcludePaths(request.excludePaths, item.relativePath))
    .slice(0, request.limit);
}

export function toRelativePath(persistenceRoot: string, absolutePath: string): string {
  return normalizeRelativePath(path.relative(persistenceRoot, absolutePath));
}
