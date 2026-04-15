import { describe, expect, test, vi } from "vitest";
import { buildWrapperInvocation, runWrapper } from "./wrappers";

describe("buildWrapperInvocation", () => {
  test("resolves within for find_files and builds a public request", async () => {
    const invocation = await buildWrapperInvocation({
      tool: "fff_find_files",
      argv: ["router", "--within", "src", "--glob", "**/*.ts", "--extension", "ts"],
      callerCwd: "/repo",
    });

    expect(invocation).toEqual({
      kind: "call",
      toolName: "fff_find_files",
      publicRequest: {
        tool: "fff_find_files",
        query: "router",
        within: "/repo/src",
        glob: "**/*.ts",
        extensions: ["ts"],
        excludePaths: [],
        limit: 20,
        cursor: null,
        outputMode: "compact",
      },
    });
  });

  test("builds search_terms invocations with normalized public args", async () => {
    const invocation = await buildWrapperInvocation({
      tool: "fff_search_terms",
      argv: [
        "router",
        "coordinator",
        "--context-lines",
        "2",
        "--limit",
        "5",
        "--output-mode",
        "json",
      ],
      callerCwd: "/repo",
    });

    expect(invocation).toEqual({
      kind: "call",
      toolName: "fff_search_terms",
      publicRequest: {
        tool: "fff_search_terms",
        terms: ["router", "coordinator"],
        contextLines: 2,
        within: "/repo",
        extensions: [],
        excludePaths: [],
        limit: 5,
        cursor: null,
        outputMode: "json",
      },
    });
  });

  test("builds grep invocations with case-sensitive flag", async () => {
    const invocation = await buildWrapperInvocation({
      tool: "fff_grep",
      argv: ["plan(Request)?", "--case-sensitive"],
      callerCwd: "/repo",
    });

    expect(invocation).toEqual({
      kind: "call",
      toolName: "fff_grep",
      publicRequest: {
        tool: "fff_grep",
        pattern: "plan(Request)?",
        caseSensitive: true,
        contextLines: 0,
        within: "/repo",
        extensions: [],
        excludePaths: [],
        limit: 20,
        cursor: null,
        outputMode: "compact",
      },
    });
  });

  test("renders wrapper help text", async () => {
    const invocation = await buildWrapperInvocation({
      tool: "fff_grep",
      argv: ["--help"],
      callerCwd: "/repo",
    });

    expect(invocation).toEqual({
      kind: "help",
      text: "Usage: fff-grep <pattern> [--within PATH] [--glob GLOB] [--case-sensitive] [--extension EXT] [--exclude-path PATH] [--context-lines N] [--limit N] [--output-mode compact|json]",
    });
  });

  test("builds grep invocations with glob filters", async () => {
    const invocation = await buildWrapperInvocation({
      tool: "fff_grep",
      argv: ["plan(Request)?", "--glob", "src/**/*.ts"],
      callerCwd: "/repo",
    });

    expect(invocation).toEqual({
      kind: "call",
      toolName: "fff_grep",
      publicRequest: {
        tool: "fff_grep",
        pattern: "plan(Request)?",
        glob: "src/**/*.ts",
        caseSensitive: false,
        contextLines: 0,
        within: "/repo",
        extensions: [],
        excludePaths: [],
        limit: 20,
        cursor: null,
        outputMode: "compact",
      },
    });
  });

  test("rejects unknown options", async () => {
    await expect(
      buildWrapperInvocation({
        tool: "fff_find_files",
        argv: ["router", "--target", "other"],
        callerCwd: "/repo",
      }),
    ).rejects.toThrow(/unknown option: --target/i);
  });
});

describe("runWrapper", () => {
  test("ensures the daemon is running and prints the HTTP MCP result", async () => {
    const ensureDaemon = vi.fn(async () => {});
    const callTool = vi.fn(async () => ({
      ok: true as const,
      value: {
        mode: "compact" as const,
        base_path: "/repo",
        next_cursor: null,
        items: [{ path: "router.ts" }],
      },
    }));
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runWrapper(
      {
        tool: "fff_find_files",
        argv: ["router"],
        callerCwd: "/repo",
      },
      {
        ensureDaemon,
        callTool,
      },
    );

    expect(ensureDaemon).toHaveBeenCalledTimes(1);
    expect(callTool).toHaveBeenCalledTimes(1);
    expect(stdout).toHaveBeenCalledWith(
      `${JSON.stringify(
        {
          mode: "compact",
          base_path: "/repo",
          next_cursor: null,
          items: [{ path: "router.ts" }],
        },
        null,
        2,
      )}\n`,
    );

    stdout.mockRestore();
  });

  test("throws a formatted public error when the daemon call fails", async () => {
    await expect(
      runWrapper(
        {
          tool: "fff_grep",
          argv: ["router"],
          callerCwd: "/repo",
        },
        {
          ensureDaemon: async () => {},
          callTool: async () => ({
            ok: false,
            error: {
              code: "BACKEND_UNAVAILABLE",
              message: "daemon offline",
            },
          }),
        },
      ),
    ).rejects.toThrow(/BACKEND_UNAVAILABLE: daemon offline/);
  });
});
