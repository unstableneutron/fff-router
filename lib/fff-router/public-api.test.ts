import { Value } from "@sinclair/typebox/value";
import { describe, expect, test } from "vitest";
import {
  findFilesInputSchema,
  normalizeCursor,
  normalizeExcludePaths,
  normalizeExtensions,
  normalizePublicToolInput,
  normalizeTerms,
  normalizeWithin,
  PUBLIC_TOOL_DEFINITIONS,
  parsePublicOutputMode,
} from "./public-api";

describe("public-api", () => {
  test("exports exactly the 3 public tools with snippets", () => {
    expect(PUBLIC_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([
      "fff_find_files",
      "fff_search_terms",
      "fff_grep",
    ]);
    expect(
      PUBLIC_TOOL_DEFINITIONS.every(
        (tool) => typeof tool.description === "string" && typeof tool.snippet === "string",
      ),
    ).toBe(true);
  });

  test("normalizes fff_find_files input and dotted extensions", () => {
    const result = normalizePublicToolInput("fff_find_files", {
      query: "router",
      within: "/tmp/project/src",
      extensions: [".ts", "tsx"],
      exclude_paths: ["dist", "src/generated"],
      limit: 10,
      cursor: null,
      output_mode: "json",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.value).toEqual({
      tool: "fff_find_files",
      query: "router",
      within: "/tmp/project/src",
      extensions: ["ts", "tsx"],
      excludePaths: ["dist", "src/generated"],
      limit: 10,
      cursor: null,
      outputMode: "json",
    });
  });

  test("applies defaults for omitted optional fields", () => {
    const result = normalizePublicToolInput("fff_search_terms", {
      terms: ["router", "coordinator"],
      within: "/tmp/project",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.value).toEqual({
      tool: "fff_search_terms",
      terms: ["router", "coordinator"],
      within: "/tmp/project",
      extensions: [],
      excludePaths: [],
      contextLines: 0,
      limit: 20,
      cursor: null,
      outputMode: "compact",
    });
  });

  test("normalizes fff_grep input", () => {
    const result = normalizePublicToolInput("fff_grep", {
      pattern: "plan(Request)?",
      within: "/tmp/project/lib",
      case_sensitive: true,
      context_lines: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.value).toEqual({
      tool: "fff_grep",
      pattern: "plan(Request)?",
      within: "/tmp/project/lib",
      caseSensitive: true,
      extensions: [],
      excludePaths: [],
      contextLines: 2,
      limit: 20,
      cursor: null,
      outputMode: "compact",
    });
  });

  test("defaults grep case sensitivity to false when omitted", () => {
    const result = normalizePublicToolInput("fff_grep", {
      pattern: "plan(Request)?",
      within: "/tmp/project/lib",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }

    expect(result.value.tool).toBe("fff_grep");
    if (result.value.tool !== "fff_grep") {
      throw new Error("expected grep request");
    }
    expect(result.value.caseSensitive).toBe(false);
  });

  test("preserves meaningful search whitespace while rejecting blank values", () => {
    const grep = normalizePublicToolInput("fff_grep", {
      pattern: "  plan(Request)?  ",
      within: "/tmp/project/lib",
    });
    expect(grep.ok).toBe(true);
    if (!grep.ok) {
      throw new Error("expected success");
    }
    expect(grep.value.tool).toBe("fff_grep");
    if (grep.value.tool !== "fff_grep") {
      throw new Error("expected grep request");
    }
    expect(grep.value.pattern).toBe("  plan(Request)?  ");

    const terms = normalizePublicToolInput("fff_search_terms", {
      terms: ["  router  ", "coordinator"],
      within: "/tmp/project",
    });
    expect(terms.ok).toBe(true);
    if (!terms.ok) {
      throw new Error("expected success");
    }
    expect(terms.value.tool).toBe("fff_search_terms");
    if (terms.value.tool !== "fff_search_terms") {
      throw new Error("expected search terms request");
    }
    expect(terms.value.terms).toEqual(["  router  ", "coordinator"]);

    const blankPattern = normalizePublicToolInput("fff_grep", {
      pattern: "   ",
      within: "/tmp/project/lib",
    });
    expect(blankPattern.ok).toBe(false);
    if (blankPattern.ok) {
      throw new Error("expected failure");
    }
    expect(blankPattern.error.code).toBe("INVALID_REQUEST");
  });

  test("rejects missing or empty search terms", () => {
    const missingTerms = normalizePublicToolInput("fff_search_terms", {
      within: "/tmp/project",
    });
    expect(missingTerms.ok).toBe(false);
    if (missingTerms.ok) {
      throw new Error("expected failure");
    }
    expect(missingTerms.error.code).toBe("INVALID_REQUEST");

    const emptyTerms = normalizePublicToolInput("fff_search_terms", {
      terms: [],
      within: "/tmp/project",
    });
    expect(emptyTerms.ok).toBe(false);
    if (emptyTerms.ok) {
      throw new Error("expected failure");
    }
    expect(emptyTerms.error.code).toBe("INVALID_REQUEST");
  });

  test("rejects invalid output_mode and non-null cursor in the initial slice", () => {
    const invalidMode = normalizePublicToolInput("fff_find_files", {
      query: "router",
      within: "/tmp/project",
      output_mode: "summary",
    });
    expect(invalidMode.ok).toBe(false);
    if (invalidMode.ok) {
      throw new Error("expected failure");
    }
    expect(invalidMode.error.code).toBe("INVALID_REQUEST");

    const nonNullCursor = normalizePublicToolInput("fff_find_files", {
      query: "router",
      within: "/tmp/project",
      cursor: "cursor-1",
    });
    expect(nonNullCursor.ok).toBe(false);
    if (nonNullCursor.ok) {
      throw new Error("expected failure");
    }
    expect(nonNullCursor.error.code).toBe("INVALID_REQUEST");
  });

  test("rejects absolute, traversing, and globbed exclude_paths", () => {
    for (const excludePath of ["/tmp/project/dist", "../dist", "src/*"]) {
      const result = normalizePublicToolInput("fff_find_files", {
        query: "router",
        within: "/tmp/project",
        exclude_paths: [excludePath],
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error("expected failure");
      }
      expect(result.error.code).toBe("INVALID_REQUEST");
    }
  });

  test("documents that raw callers must pass absolute within values", () => {
    const result = normalizePublicToolInput("fff_find_files", {
      query: "router",
      within: "src",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.error.code).toBe("INVALID_REQUEST");
  });

  test("expands HOME-based direct-MCP within values", () => {
    expect(normalizeWithin("~/.config", { HOME: "/home/tester" } as NodeJS.ProcessEnv)).toEqual({
      ok: true,
      value: "/home/tester/.config",
    });

    expect(normalizeWithin("$HOME/.config", { HOME: "/home/tester" } as NodeJS.ProcessEnv)).toEqual(
      {
        ok: true,
        value: "/home/tester/.config",
      },
    );

    expect(normalizeWithin("${HOME}/src", { HOME: "/home/tester" } as NodeJS.ProcessEnv)).toEqual({
      ok: true,
      value: "/home/tester/src",
    });
  });

  test("keeps rejecting non-HOME relative within values for direct callers", () => {
    const result = normalizeWithin("src", { HOME: "/home/tester" } as NodeJS.ProcessEnv);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.error.code).toBe("INVALID_REQUEST");
  });

  test("fails clearly when direct-MCP HOME expansion is requested without HOME", () => {
    const result = normalizeWithin("~/.config", {} as NodeJS.ProcessEnv);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.error).toEqual({
      code: "INVALID_REQUEST",
      message: "HOME must be set to expand '~', '$HOME', or '${HOME}' paths",
    });
  });

  test("rejects unknown fields so schemas and helpers agree", () => {
    const payload = {
      query: "router",
      within: "/tmp/project",
      unexpected: true,
    };

    expect(Value.Check(findFilesInputSchema, payload)).toBe(false);

    const result = normalizePublicToolInput("fff_find_files", payload);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.error.code).toBe("INVALID_REQUEST");
  });

  test("exports field-level normalization helpers", () => {
    expect(typeof normalizeWithin).toBe("function");
    expect(typeof normalizeExtensions).toBe("function");
    expect(typeof normalizeExcludePaths).toBe("function");
    expect(typeof normalizeCursor).toBe("function");
    expect(typeof normalizeTerms).toBe("function");
  });

  test("cursor schema matches the initial null-only pagination contract", () => {
    expect(
      Value.Check(findFilesInputSchema, {
        query: "router",
        within: "/tmp/project",
        cursor: null,
      }),
    ).toBe(true);

    expect(
      Value.Check(findFilesInputSchema, {
        query: "router",
        within: "/tmp/project",
        cursor: "cursor-1",
      }),
    ).toBe(false);
  });

  test("parses output_mode separately with compact default", () => {
    expect(parsePublicOutputMode(undefined)).toEqual({
      ok: true,
      value: "compact",
    });
    expect(parsePublicOutputMode("json")).toEqual({
      ok: true,
      value: "json",
    });

    const invalid = parsePublicOutputMode("files");
    expect(invalid.ok).toBe(false);
    if (invalid.ok) {
      throw new Error("expected failure");
    }
    expect(invalid.error.code).toBe("INVALID_REQUEST");
  });
});
