import path from "node:path";
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

  return matchGlob(glob, normalizeRelativePath(relativePath));
}

function escapeRegexCharacter(character: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character;
}

/**
 * Compile the bounded public glob syntax without a package runtime. This is
 * the portable subset used by fff and shell tools: `*`, `**`, `?`, character
 * classes, and flat brace alternatives. A leading `!` negates the expression.
 */
function globSource(glob: string): string {
  let source = "";
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index] ?? "";
    if (character === "*") {
      if (glob[index + 1] === "*") {
        index += 1;
        if (glob[index + 1] === "/") {
          index += 1;
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
      continue;
    }
    if (character === "?") {
      source += "[^/]";
      continue;
    }
    if (character === "[") {
      const close = glob.indexOf("]", index + 1);
      if (close > index + 1) {
        let body = glob.slice(index + 1, close);
        if (body.startsWith("!")) body = `^${body.slice(1)}`;
        source += `[${body.replace(/\\/g, "\\\\")}]`;
        index = close;
        continue;
      }
    }
    if (character === "{") {
      const close = glob.indexOf("}", index + 1);
      if (close > index + 1) {
        const alternatives = glob.slice(index + 1, close).split(",");
        if (alternatives.length > 1 && alternatives.every((entry) => !/[{}]/.test(entry))) {
          source += `(?:${alternatives.map(globSource).join("|")})`;
          index = close;
          continue;
        }
      }
    }
    source += escapeRegexCharacter(character);
  }
  return source;
}

function matchGlob(glob: string, relativePath: string): boolean {
  const negated = glob.startsWith("!");
  const expression = negated ? glob.slice(1) : glob;
  const basename = !expression.includes("/");
  const candidate = basename ? (relativePath.split("/").at(-1) ?? relativePath) : relativePath;
  const matches = new RegExp(`^${globSource(expression)}$`, "u").test(candidate);
  return negated ? !matches : matches;
}

export function matchesExcludePaths(excludePaths: string[], relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);

  return !excludePaths.some((excludePath) => {
    if (/[*?[\]{}!]/.test(excludePath)) {
      return matchGlob(excludePath, normalized);
    }
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
