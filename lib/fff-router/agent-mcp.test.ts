import { describe, expect, test, vi } from "vitest";
import { executeAgentMcpTool, listAgentMcpTools } from "./agent-mcp";
import type { PublicToolRequest, SearchCoordinatorResult } from "./types";

describe("listAgentMcpTools", () => {
  test("exposes fff-mcp-shaped tool names", () => {
    expect(listAgentMcpTools().map((tool) => tool.name)).toEqual([
      "find_files",
      "grep",
      "multi_grep",
    ]);
  });
});

describe("executeAgentMcpTool", () => {
  test("maps find_files to fff_find_files and returns plain text", async () => {
    const ensureDaemonRunning = vi.fn(async () => {});
    const callPublicToolOverHttp = vi.fn(async (request: PublicToolRequest) => {
      expect(request).toEqual({
        tool: "fff_find_files",
        query: "package",
        within: ["/repo"],
        glob: "*.json",
        extensions: [],
        excludePaths: ["dist"],
        limit: 3,
        cursor: null,
        outputMode: "compact",
      });
      return {
        ok: true,
        value: {
          mode: "compact",
          base_path: "/repo",
          next_cursor: null,
          items: [{ path: "package.json" }],
        },
      } satisfies SearchCoordinatorResult;
    });

    const response = await executeAgentMcpTool({
      name: "find_files",
      input: {
        query: "package *.json !dist/",
        within: ".",
        maxResults: 3,
      },
      cwd: "/repo",
      ensureDaemonRunning,
      callPublicToolOverHttp,
    });

    expect(ensureDaemonRunning).toHaveBeenCalledTimes(1);
    expect(response).toEqual({
      isError: false,
      content: [{ type: "text", text: "base_path: /repo\n\npackage.json" }],
    });
  });

  test("forwards cursor strings for native fff-mcp pagination", async () => {
    const callPublicToolOverHttp = vi.fn(async (request: PublicToolRequest) => {
      expect(request).toMatchObject({
        tool: "fff_find_files",
        query: "router",
        within: ["/repo"],
        cursor: "7",
      });
      return {
        ok: true,
        value: {
          mode: "compact",
          base_path: "/repo",
          next_cursor: "8",
          text: "8/40 matches\nlib/fff-router/mcp-server.ts\ncursor: 8",
        },
      } satisfies SearchCoordinatorResult;
    });

    const response = await executeAgentMcpTool({
      name: "find_files",
      input: { query: "router", within: "/repo", cursor: "7" },
      cwd: "/repo",
      ensureDaemonRunning: async () => {},
      callPublicToolOverHttp,
    });

    expect(response).toEqual({
      isError: false,
      content: [
        {
          type: "text",
          text: "8/40 matches\nlib/fff-router/mcp-server.ts\ncursor: 8",
        },
      ],
    });
  });

  test("maps grep query constraints to fff_grep regex requests", async () => {
    const callPublicToolOverHttp = vi.fn(async (request: PublicToolRequest) => {
      expect(request).toMatchObject({
        tool: "fff_grep",
        patterns: ["createMcpServer"],
        literal: false,
        within: ["/repo"],
        glob: "*.ts",
        limit: 2,
      });
      return {
        ok: true,
        value: {
          mode: "compact",
          base_path: "/repo",
          next_cursor: null,
          text: '→ Read lib/fff-router/http-daemon.ts (only match)\nlib/fff-router/http-daemon.ts\n 21: import { createMcpServer } from "./mcp-server";',
        },
      } satisfies SearchCoordinatorResult;
    });

    const response = await executeAgentMcpTool({
      name: "grep",
      input: { query: "*.ts createMcpServer", within: "/repo", maxResults: 2 },
      cwd: "/other",
      ensureDaemonRunning: async () => {},
      callPublicToolOverHttp,
    });

    expect(response.isError).toBe(false);
    expect(response.content[0]?.text).toContain("→ Read lib/fff-router/http-daemon.ts");
    expect(response.content[0]?.text).not.toContain('"mode"');
  });

  test("maps multi_grep to literal fff_grep and formats structured results", async () => {
    const callPublicToolOverHttp = vi.fn(async (request: PublicToolRequest) => {
      expect(request).toMatchObject({
        tool: "fff_grep",
        patterns: ["ActorAuth", "actor_auth"],
        literal: true,
        within: ["/repo"],
        glob: "src/**",
        contextLines: 1,
      });
      return {
        ok: true,
        value: {
          mode: "compact",
          base_path: "/repo",
          next_cursor: null,
          items: [{ path: "src/auth.ts", line: 12, text: "const ActorAuth = z.object({});" }],
        },
      } satisfies SearchCoordinatorResult;
    });

    const response = await executeAgentMcpTool({
      name: "multi_grep",
      input: {
        patterns: ["ActorAuth", "actor_auth"],
        constraints: "src/",
        within: "/repo",
        context: 1,
      },
      cwd: "/repo",
      ensureDaemonRunning: async () => {},
      callPublicToolOverHttp,
    });

    expect(response).toEqual({
      isError: false,
      content: [
        {
          type: "text",
          text: "base_path: /repo\n\nsrc/auth.ts\n  12: const ActorAuth = z.object({});",
        },
      ],
    });
  });
});
