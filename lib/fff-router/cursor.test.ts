import { describe, expect, test } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor";
import type { PublicFindFilesRequest } from "./types";

function request(overrides: Partial<PublicFindFilesRequest> = {}): PublicFindFilesRequest {
  return {
    tool: "find_files",
    query: "router",
    within: ["/repo"],
    extensions: [],
    excludePaths: [],
    limit: 20,
    cursor: null,
    ...overrides,
  };
}

describe("router cursor envelope", () => {
  test("round-trips the opaque upstream cursor", () => {
    const encoded = encodeCursor({
      root: "/repo",
      generation: 7,
      request: request(),
      upstreamCursor: "upstream:2",
    });
    expect(
      decodeCursor({
        cursor: encoded,
        root: "/repo",
        generation: 7,
        request: request({ cursor: encoded }),
      }),
    ).toEqual({ ok: true, value: "upstream:2" });
  });

  test("binds cursors to the repository and query", () => {
    const encoded = encodeCursor({
      root: "/repo",
      generation: 1,
      request: request(),
      upstreamCursor: "2",
    });
    expect(
      decodeCursor({
        cursor: encoded,
        root: "/other",
        generation: 1,
        request: request(),
      }),
    ).toMatchObject({ ok: false, error: { code: "CURSOR_INVALID" } });
    expect(
      decodeCursor({
        cursor: encoded,
        root: "/repo",
        generation: 1,
        request: request({ query: "different" }),
      }),
    ).toMatchObject({ ok: false, error: { code: "CURSOR_INVALID" } });
  });

  test("expires when the owning worker generation changes", () => {
    const encoded = encodeCursor({
      root: "/repo",
      generation: 1,
      request: request(),
      upstreamCursor: "2",
    });
    expect(
      decodeCursor({ cursor: encoded, root: "/repo", generation: 2, request: request() }),
    ).toMatchObject({ ok: false, error: { code: "CURSOR_EXPIRED" } });
  });

  test("rejects malformed payloads", () => {
    expect(
      decodeCursor({ cursor: "not-json", root: "/repo", generation: 1, request: request() }),
    ).toMatchObject({ ok: false, error: { code: "CURSOR_INVALID" } });
  });
});
