import fs from "node:fs";
import path from "node:path";
import { normalizeRelativePath, toRelativePath } from "./common";
import type { BackendSearchRequest } from "./types";

export type EncodedFffScope = {
  tokens: string[];
  fallbackRequired: boolean;
};

function isEncodableToken(token: string): boolean {
  return token !== "" && token !== "." && !/\s/.test(token);
}

function looksLikeFile(relativePath: string): boolean {
  const base = path.posix.basename(relativePath);
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) {
    return false;
  }

  const ext = base.slice(dot + 1);
  return /^[A-Za-z][A-Za-z0-9]{0,9}$/.test(ext);
}

function classifyPathKind(persistenceRoot: string, relativePath: string): "file" | "dir" {
  const absolutePath = path.join(persistenceRoot, relativePath);
  try {
    const stats = fs.statSync(absolutePath);
    return stats.isFile() ? "file" : "dir";
  } catch {
    return looksLikeFile(relativePath) ? "file" : "dir";
  }
}

function encodePathToken(
  relativePath: string,
  kind: "file" | "dir",
  negate = false,
): string | null {
  const normalized = normalizeRelativePath(relativePath).replace(/\/+$/, "");
  if (!isEncodableToken(normalized)) {
    return null;
  }

  const suffix = kind === "dir" ? "/" : "";
  return `${negate ? "!" : ""}${normalized}${suffix}`;
}

function toRepoRelativeToken(request: BackendSearchRequest, candidatePath: string): string {
  if (path.isAbsolute(candidatePath)) {
    return toRelativePath(request.persistenceRoot, candidatePath);
  }

  return normalizeRelativePath(candidatePath);
}

export function buildFffScopeTokens(request: BackendSearchRequest): EncodedFffScope {
  const tokens: string[] = [];
  let fallbackRequired = false;

  if (request.fileRestriction) {
    const relativeFile = toRelativePath(request.persistenceRoot, request.fileRestriction);
    const encoded = encodePathToken(relativeFile, "file");
    if (encoded) {
      tokens.push(encoded);
    } else {
      fallbackRequired = true;
    }
  } else {
    const relativeWithin = toRelativePath(request.persistenceRoot, request.within);
    if (relativeWithin !== "" && relativeWithin !== ".") {
      const encoded = encodePathToken(relativeWithin, "dir");
      if (encoded) {
        tokens.push(encoded);
      } else {
        fallbackRequired = true;
      }
    }
  }

  for (const excludePath of request.excludePaths) {
    const relativeExclude = toRepoRelativeToken(request, excludePath);
    const kind = classifyPathKind(request.persistenceRoot, relativeExclude);
    const encoded = encodePathToken(relativeExclude, kind, true);
    if (encoded) {
      tokens.push(encoded);
    } else {
      fallbackRequired = true;
    }
  }

  return {
    tokens,
    fallbackRequired,
  };
}

export function buildScopedQuery(tokens: string[], query: string): string {
  return [...tokens, query].filter(Boolean).join(" ").trim();
}
