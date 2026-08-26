import { createHash } from "node:crypto";
import type { PublicToolRequest, Result, RouterError } from "./types";

type CursorEnvelope = {
  v: 1;
  r: string;
  q: string;
  g: number;
  c: string;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url").slice(0, 16);
}

function requestFingerprint(request: PublicToolRequest): string {
  const base = {
    tool: request.tool,
    within: request.within,
    glob: request.glob ?? null,
    extensions: request.extensions,
    excludePaths: request.excludePaths,
    limit: request.limit,
  };
  const value =
    request.tool === "find_files"
      ? { ...base, query: request.query }
      : {
          ...base,
          patterns: request.patterns,
          literal: request.literal,
          contextLines: request.contextLines,
        };
  return digest(JSON.stringify(value));
}

export function encodeCursor(args: {
  root: string;
  generation: number;
  request: PublicToolRequest;
  upstreamCursor: string;
}): string {
  const envelope: CursorEnvelope = {
    v: 1,
    r: digest(args.root),
    q: requestFingerprint(args.request),
    g: args.generation,
    c: args.upstreamCursor,
  };
  return Buffer.from(JSON.stringify(envelope)).toString("base64url");
}

export function decodeCursor(args: {
  cursor: string;
  root: string;
  generation: number;
  request: PublicToolRequest;
}): Result<string, RouterError> {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(args.cursor, "base64url").toString("utf8"));
  } catch {
    return {
      ok: false,
      error: { code: "CURSOR_INVALID", message: "cursor is not a valid fff-router cursor" },
    };
  }

  if (
    !value ||
    typeof value !== "object" ||
    (value as Partial<CursorEnvelope>).v !== 1 ||
    typeof (value as Partial<CursorEnvelope>).r !== "string" ||
    typeof (value as Partial<CursorEnvelope>).q !== "string" ||
    typeof (value as Partial<CursorEnvelope>).g !== "number" ||
    typeof (value as Partial<CursorEnvelope>).c !== "string"
  ) {
    return {
      ok: false,
      error: { code: "CURSOR_INVALID", message: "cursor payload is invalid" },
    };
  }

  const envelope = value as CursorEnvelope;
  if (envelope.r !== digest(args.root) || envelope.q !== requestFingerprint(args.request)) {
    return {
      ok: false,
      error: {
        code: "CURSOR_INVALID",
        message: "cursor belongs to a different search or repository",
      },
    };
  }
  if (envelope.g !== args.generation) {
    return {
      ok: false,
      error: {
        code: "CURSOR_EXPIRED",
        message: "cursor expired because its fff-mcp worker was restarted",
        retryable: false,
      },
    };
  }

  return { ok: true, value: envelope.c };
}
