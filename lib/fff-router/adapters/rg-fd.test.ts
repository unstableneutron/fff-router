import { describe, expect, test } from "vitest";
import { createRgFdAdapter } from "./rg-fd";
import type {
  FindFilesBackendRequest,
  GrepBackendRequest,
  SearchTermsBackendRequest,
} from "./types";

type CommandCall = {
  command: string;
  args: string[];
  cwd: string;
};

const findFilesRequest: FindFilesBackendRequest = {
  backendId: "rg-fd",
  persistenceRoot: "/repo",
  queryKind: "find_files",
  within: "/repo/src",
  basePath: "/repo/src",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 20,
  query: "router",
};

const searchTermsRequest: SearchTermsBackendRequest = {
  backendId: "rg-fd",
  persistenceRoot: "/repo",
  queryKind: "search_terms",
  within: "/repo/src",
  basePath: "/repo/src",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 20,
  terms: ["router", "createRouter"],
  contextLines: 2,
};

const grepRequest: GrepBackendRequest = {
  backendId: "rg-fd",
  persistenceRoot: "/repo",
  queryKind: "grep",
  within: "/repo/src",
  basePath: "/repo/src",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 20,
  pattern: "plan(Request)?",
  caseSensitive: true,
  contextLines: 1,
};

describe("createRgFdAdapter", () => {
  test("maps fallback find_files results into normalized file items", async () => {
    const calls: CommandCall[] = [];
    const adapter = createRgFdAdapter({
      runCommand: async (command, args, cwd) => {
        calls.push({ command, args, cwd });
        return {
          ok: true,
          stdout: "src/router.ts\ndist/router.js\n",
        };
      },
    });

    const result = await adapter.execute({ request: findFilesRequest });

    expect(calls).toEqual([
      {
        command: "fd",
        args: ["--type", "f", "--base-directory", "/repo", ".", "src"],
        cwd: "/repo",
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([
      { path: "/repo/src/router.ts", relativePath: "src/router.ts" },
    ]);
  });

  test("lowers search_terms requests into literal rg alternation with context", async () => {
    const calls: CommandCall[] = [];
    const adapter = createRgFdAdapter({
      runCommand: async (command, args, cwd) => {
        calls.push({ command, args, cwd });
        return {
          ok: true,
          stdout: `${JSON.stringify({
            type: "match",
            data: {
              path: { text: "/repo/src/router.ts" },
              line_number: 8,
              lines: { text: "const router = createRouter();\n" },
              submatches: [{ start: 6 }],
            },
          })}\n`,
        };
      },
    });

    const result = await adapter.execute({ request: searchTermsRequest });

    expect(calls).toEqual([
      {
        command: "rg",
        args: [
          "--json",
          "--fixed-strings",
          "--context",
          "2",
          "--glob",
          "*.ts",
          "--glob",
          "!dist/**",
          "-e",
          "router",
          "-e",
          "createRouter",
          "/repo/src",
        ],
        cwd: "/repo",
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([
      {
        path: "/repo/src/router.ts",
        relativePath: "src/router.ts",
        line: 8,
        text: "const router = createRouter();",
        column: 6,
      },
    ]);
  });

  test("maps malformed rg output to SEARCH_FAILED", async () => {
    const adapter = createRgFdAdapter({
      runCommand: async () => ({ ok: true, stdout: "not-json\n" }),
    });

    const result = await adapter.execute({ request: searchTermsRequest });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("SEARCH_FAILED");
  });

  test("lowers grep requests into regex rg with case-sensitive matching", async () => {
    const calls: CommandCall[] = [];
    const adapter = createRgFdAdapter({
      runCommand: async (command, args, cwd) => {
        calls.push({ command, args, cwd });
        return { ok: true, stdout: "" };
      },
    });

    const result = await adapter.execute({ request: grepRequest });

    expect(calls).toEqual([
      {
        command: "rg",
        args: [
          "--json",
          "--context",
          "1",
          "--glob",
          "*.ts",
          "--glob",
          "!dist/**",
          "-e",
          "plan(Request)?",
          "/repo/src",
        ],
        cwd: "/repo",
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.queryKind).toBe("grep");
  });
});
