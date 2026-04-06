import { describe, expect, test, vi } from "vitest";
import {
  buildWrapperInvocation,
  DEFAULT_MCPORTER_TARGET,
  MCPORTER_CONFIG_PATH,
  runWrapper,
} from "./wrappers";

describe("buildWrapperInvocation", () => {
  test("defaults the mcporter target to fff-router and resolves within for find_files", async () => {
    const invocation = await buildWrapperInvocation({
      tool: "fff_find_files",
      argv: ["router", "--within", "src", "--extension", "ts"],
      callerCwd: "/repo",
    });

    expect(invocation).toEqual({
      kind: "call",
      toolName: "fff_find_files",
      target: DEFAULT_MCPORTER_TARGET,
      publicArgs: {
        query: "router",
        within: "/repo/src",
        extensions: ["ts"],
      },
      mcporterArgs: [
        "call",
        "--config",
        MCPORTER_CONFIG_PATH,
        'fff-router.fff_find_files(query: "router", within: "/repo/src", extensions: ["ts"])',
      ],
    });
  });

  test("builds search_terms invocations with structured args", async () => {
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

    expect(invocation.kind).toBe("call");
    if (invocation.kind !== "call") throw new Error("expected call");
    expect(invocation.target).toBe("fff-router");
    expect(invocation.publicArgs).toEqual({
      terms: ["router", "coordinator"],
      context_lines: 2,
      within: "/repo",
      limit: 5,
      output_mode: "json",
    });
    expect(invocation.mcporterArgs[3]).toBe(
      'fff-router.fff_search_terms(terms: ["router","coordinator"], context_lines: 2, within: "/repo", limit: 5, output_mode: "json")',
    );
  });

  test("builds grep invocations with case-sensitive flag and target override", async () => {
    const invocation = await buildWrapperInvocation({
      tool: "fff_grep",
      argv: ["plan(Request)?", "--case-sensitive", "--target", "custom-router"],
      callerCwd: "/repo",
    });

    expect(invocation.kind).toBe("call");
    if (invocation.kind !== "call") throw new Error("expected call");
    expect(invocation.target).toBe("custom-router");
    expect(invocation.publicArgs).toEqual({
      pattern: "plan(Request)?",
      case_sensitive: true,
      within: "/repo",
    });
    expect(invocation.mcporterArgs[3]).toBe(
      'custom-router.fff_grep(pattern: "plan(Request)?", case_sensitive: true, within: "/repo")',
    );
  });

  test("omits explicit compact output mode because compact is the server default", async () => {
    const invocation = await buildWrapperInvocation({
      tool: "fff_find_files",
      argv: ["router", "--output-mode", "compact"],
      callerCwd: "/repo",
    });

    expect(invocation.kind).toBe("call");
    if (invocation.kind !== "call") throw new Error("expected call");
    expect(invocation.publicArgs).toEqual({
      query: "router",
      within: "/repo",
    });
    expect(invocation.mcporterArgs[3]).toBe(
      'fff-router.fff_find_files(query: "router", within: "/repo")',
    );
  });

  test("renders wrapper help text", async () => {
    const invocation = await buildWrapperInvocation({
      tool: "fff_grep",
      argv: ["--help"],
      callerCwd: "/repo",
    });

    expect(invocation).toEqual({
      kind: "help",
      text: "Usage: fff-grep <pattern> [--within PATH] [--case-sensitive] [--extension EXT] [--exclude-path PATH] [--context-lines N] [--limit N] [--output-mode compact|json] [--target NAME]",
    });
  });
});

describe("runWrapper", () => {
  test("spawns mcporter externally with a sanitized child environment", async () => {
    const spawn = vi.fn(
      (
        _argv: string[],
        _options: {
          stdin: "ignore";
          stdout: "pipe";
          stderr: "pipe";
          env: Record<string, string | undefined>;
        },
      ) => ({ exited: Promise.resolve(0) }),
    );

    await runWrapper(
      {
        tool: "fff_find_files",
        argv: ["router"],
        callerCwd: "/repo",
      },
      {
        env: {
          PATH: "/usr/bin",
          MCPORTER_DISABLE_AUTORUN: "1",
          MCPORTER_DAEMON_CHILD: "0",
          MCPORTER_DAEMON_SOCKET: "/tmp/socket",
          MCPORTER_DAEMON_METADATA: "/tmp/meta",
        },
        spawn,
        resolveMcporterCliPath: () => "/tmp/mcporter/dist/cli.js",
      },
    );

    expect(spawn).toHaveBeenCalledTimes(1);
    const call = spawn.mock.calls[0];
    expect(call).toBeDefined();
    const argv = call?.[0] as string[];
    const options = call?.[1] as {
      env: Record<string, string | undefined>;
    };
    expect(argv[0]).toBe("/bin/sh");
    expect(argv[1]).toBe("-lc");
    expect(argv[2]).toContain(process.execPath);
    expect(argv[2]).toContain("/tmp/mcporter/dist/cli.js");
    expect(argv[2]).toContain("call");
    expect(argv[2]).toContain(MCPORTER_CONFIG_PATH);
    expect(argv[2]).toContain("fff-router.fff_find_files(");
    expect(argv[2]).toContain('query: "router"');
    expect(argv[2]).toContain('within: "/repo"');
    expect(options.env.MCPORTER_DISABLE_AUTORUN).toBeUndefined();
    expect(options.env.MCPORTER_DAEMON_CHILD).toBeUndefined();
    expect(options.env.MCPORTER_DAEMON_SOCKET).toBeUndefined();
    expect(options.env.MCPORTER_DAEMON_METADATA).toBeUndefined();
    expect(options.env.FFF_ROUTER_WRAPPER_RECURSION_GUARD).toBe("1");
  });

  test("refuses to run when invoked in a daemon child context", async () => {
    await expect(
      runWrapper(
        {
          tool: "fff_grep",
          argv: ["router"],
          callerCwd: "/repo",
        },
        {
          env: { MCPORTER_DAEMON_CHILD: "1" },
          spawn: vi.fn(() => ({ exited: Promise.resolve(0) })),
          resolveMcporterCliPath: () => "/tmp/mcporter/dist/cli.js",
        },
      ),
    ).rejects.toThrow(/recursion|daemon child/i);
  });
});
