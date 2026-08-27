import path from "node:path";
import { describe, expect, test } from "vitest";
import { listMcpTools } from "./mcp-tools";
import { MAX_CONTEXT_LINES, MAX_RESULTS, normalizePublicToolInput } from "./public-api";

describe("v2 public protocol", () => {
  test("normalizes find_files into the canonical camelCase request", () => {
    const result = normalizePublicToolInput(
      "find_files",
      {
        query: " router ",
        within: ["/repo/src"],
        extensions: [".ts", "ts"],
        excludePaths: ["generated/**", "generated/**"],
      },
      { HOME: "/home/test" },
    );

    expect(result).toEqual({
      ok: true,
      value: {
        tool: "find_files",
        query: "router",
        within: [path.normalize("/repo/src")],
        extensions: ["ts"],
        excludePaths: ["generated/**"],
        limit: 20,
        cursor: null,
      },
    });
  });

  test("uses literal grep by default and rejects wildcard-only regex", () => {
    const literal = normalizePublicToolInput("grep", {
      patterns: ["a.*"],
      within: "/repo",
    });
    expect(literal.ok && literal.value.tool === "grep" && literal.value.literal).toBe(true);

    const regex = normalizePublicToolInput("grep", {
      patterns: [".*"],
      literal: false,
      within: "/repo",
    });
    expect(regex).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
  });

  test("requires absolute daemon-wire paths", () => {
    expect(normalizePublicToolInput("find_files", { query: "router", within: "." })).toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST", message: expect.stringContaining("absolute") },
    });
  });

  test("rejects legacy and unknown fields instead of silently accepting drift", () => {
    expect(
      normalizePublicToolInput("grep", {
        patterns: ["router"],
        within: "/repo",
        case_sensitive: true,
      }),
    ).toMatchObject({ ok: false, error: { code: "INVALID_REQUEST" } });
  });

  test("publishes the same bounded schemas through MCP", () => {
    const tools = listMcpTools();
    const find = tools.find((tool) => tool.name === "find_files")!;
    const grep = tools.find((tool) => tool.name === "grep")!;
    expect(find.inputSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
      properties: { limit: { maximum: MAX_RESULTS } },
    });
    expect(grep.inputSchema).toMatchObject({
      properties: { contextLines: { maximum: MAX_CONTEXT_LINES } },
    });
  });
});
