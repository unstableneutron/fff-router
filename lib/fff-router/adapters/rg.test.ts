import { describe, expect, test } from "vitest";
import { createRgAdapter, runCommandWithSpawn } from "./rg";
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
  backendId: "rg",
  persistenceRoot: "/repo",
  queryKind: "find_files",
  within: "/repo/src",
  basePath: "/repo/src",
  glob: "**/*.ts",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 20,
  query: "router",
};

const searchTermsRequest: SearchTermsBackendRequest = {
  backendId: "rg",
  persistenceRoot: "/repo",
  queryKind: "search_terms",
  within: "/repo/src",
  basePath: "/repo/src",
  glob: "**/*.ts",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 20,
  terms: ["router", "createRouter"],
  contextLines: 2,
};

const grepRequest: GrepBackendRequest = {
  backendId: "rg",
  persistenceRoot: "/repo",
  queryKind: "grep",
  within: "/repo/src",
  basePath: "/repo/src",
  glob: "**/*.ts",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 20,
  patterns: ["plan(Request)?", "build(Request)?"],
  caseSensitive: true,
  literal: false,
  contextLines: 1,
};

describe("runCommandWithSpawn", () => {
  test("captures stdout from a Node child process without Bun APIs", async () => {
    const result = await runCommandWithSpawn(process.execPath, ["-e", "console.log('ok')"], "/");

    expect(result).toEqual({
      ok: true,
      stdout: "ok\n",
      stderr: "",
    });
  });

  test("maps missing commands to missing-command failures", async () => {
    const result = await runCommandWithSpawn("definitely-not-a-real-command", [], "/");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected command failure");
    }
    expect(result.kind).toBe("missing-command");
  });
});

describe("createRgAdapter", () => {
  test("maps fallback find_files results into normalized file items", async () => {
    const calls: CommandCall[] = [];
    const adapter = createRgAdapter({
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
        args: [
          "--type",
          "f",
          "--base-directory",
          "/repo",
          "--glob",
          "**/*.ts",
          "--glob",
          "*.ts",
          "--glob",
          "!dist/**",
          ".",
          "src",
        ],
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
    const adapter = createRgAdapter({
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
          "**/*.ts",
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

  test("preserves context lines from rg json events", async () => {
    const adapter = createRgAdapter({
      runCommand: async () => ({
        ok: true,
        stdout: [
          JSON.stringify({
            type: "context",
            data: {
              path: { text: "/repo/src/router.ts" },
              line_number: 7,
              lines: { text: "const before = true;\n" },
              submatches: [],
            },
          }),
          JSON.stringify({
            type: "match",
            data: {
              path: { text: "/repo/src/router.ts" },
              line_number: 8,
              lines: { text: "const router = createRouter();\n" },
              submatches: [{ start: 6 }],
            },
          }),
          JSON.stringify({
            type: "context",
            data: {
              path: { text: "/repo/src/router.ts" },
              line_number: 9,
              lines: { text: "const after = true;\n" },
              submatches: [],
            },
          }),
          "",
        ].join("\n"),
      }),
    });

    const result = await adapter.execute({ request: searchTermsRequest });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([
      {
        path: "/repo/src/router.ts",
        relativePath: "src/router.ts",
        line: 8,
        text: "const router = createRouter();",
        column: 6,
        contextBefore: ["const before = true;"],
        contextAfter: ["const after = true;"],
      },
    ]);
  });

  test("maps malformed rg output to SEARCH_FAILED", async () => {
    const adapter = createRgAdapter({
      runCommand: async () => ({ ok: true, stdout: "not-json\n" }),
    });

    const result = await adapter.execute({ request: searchTermsRequest });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("SEARCH_FAILED");
  });

  test("lowers grep requests into regex rg with case-sensitive matching", async () => {
    const calls: CommandCall[] = [];
    const adapter = createRgAdapter({
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
          "**/*.ts",
          "--glob",
          "*.ts",
          "--glob",
          "!dist/**",
          "-e",
          "plan(Request)?",
          "-e",
          "build(Request)?",
          "/repo/src",
        ],
        cwd: "/repo",
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.queryKind).toBe("grep");
  });

  test("adds --fixed-strings when literal=true so regex metacharacters stay literal", async () => {
    const calls: CommandCall[] = [];
    const adapter = createRgAdapter({
      runCommand: async (command, args, cwd) => {
        calls.push({ command, args, cwd });
        return { ok: true, stdout: "" };
      },
    });

    await adapter.execute({
      request: { ...grepRequest, literal: true, patterns: ['provider: "anthropic"'] },
    });

    expect(calls[0]?.args).toEqual([
      "--json",
      "--context",
      "1",
      "--glob",
      "**/*.ts",
      "--glob",
      "*.ts",
      "--glob",
      "!dist/**",
      "--fixed-strings",
      "-e",
      'provider: "anthropic"',
      "/repo/src",
    ]);
  });

  test("passes glob through fd for find_files", async () => {
    const calls: CommandCall[] = [];
    const adapter = createRgAdapter({
      runCommand: async (command, args, cwd) => {
        calls.push({ command, args, cwd });
        return { ok: true, stdout: "src/router.ts\n" };
      },
    });

    const result = await adapter.execute({ request: findFilesRequest });

    expect(calls).toEqual([
      {
        command: "fd",
        args: [
          "--type",
          "f",
          "--base-directory",
          "/repo",
          "--glob",
          "**/*.ts",
          "--glob",
          "*.ts",
          "--glob",
          "!dist/**",
          ".",
          "src",
        ],
        cwd: "/repo",
      },
    ]);
    expect(result.ok).toBe(true);
  });
});
