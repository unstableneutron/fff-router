import { describe, expect, test } from "vitest";
import { createMcpServer } from "./mcp-server";
import type { PublicToolRequest, SearchCoordinator } from "./types";

function makeCoordinator(result: Awaited<ReturnType<SearchCoordinator["execute"]>>) {
  const calls: PublicToolRequest[] = [];

  const coordinator: SearchCoordinator = {
    async execute(request) {
      calls.push(request);
      return result;
    },
  };

  return { coordinator, calls };
}

describe("createMcpServer", () => {
  test("registers exactly the 2 public tools with canonical schemas", async () => {
    const { coordinator } = makeCoordinator({
      ok: true,
      value: {
        mode: "compact",
        base_path: "/repo",
        next_cursor: null,
        items: [],
      },
    });
    const server = createMcpServer({ coordinator });

    const tools = await server.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(["fff_find_files", "fff_grep"]);
    expect(tools.map((tool) => tool.inputSchema)).toEqual(
      (await import("./public-api")).PUBLIC_TOOL_DEFINITIONS.map((tool) => tool.inputSchema),
    );
  });

  test("invokes the coordinator with normalized input and propagates compact/json responses", async () => {
    const compactCoordinator = makeCoordinator({
      ok: true,
      value: {
        mode: "compact",
        base_path: "/repo/src",
        next_cursor: null,
        items: [{ path: "router.ts" }],
      },
    });
    const compactServer = createMcpServer({
      coordinator: compactCoordinator.coordinator,
    });
    const compact = await compactServer.callTool("fff_find_files", {
      query: "router",
      within: "/repo/src",
      extensions: [".ts"],
    });
    expect(compactCoordinator.calls).toEqual([
      {
        tool: "fff_find_files",
        query: "router",
        within: "/repo/src",
        extensions: ["ts"],
        excludePaths: [],
        limit: 20,
        cursor: null,
        outputMode: "compact",
      },
    ]);
    expect(compact).toEqual({
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              mode: "compact",
              base_path: "/repo/src",
              next_cursor: null,
              items: [{ path: "router.ts" }],
            },
            null,
            2,
          ),
        },
      ],
    });

    const jsonServer = createMcpServer({
      coordinator: makeCoordinator({
        ok: true,
        value: {
          mode: "json",
          base_path: "/repo/src",
          next_cursor: null,
          backend_used: "rg",
          fallback_applied: true,
          fallback_reason: "backend_error",
          stats: { result_count: 1 },
          items: [{ path: "router.ts", absolute_path: "/repo/src/router.ts" }],
        },
      }).coordinator,
    });
    const json = await jsonServer.callTool("fff_find_files", {
      query: "router",
      within: "/repo/src",
      output_mode: "json",
    });
    expect(json.isError).toBe(false);
    expect(json.content[0]?.type).toBe("text");
    expect(json.content[0]?.text).toContain('"backend_used": "rg"');
  });

  test("serializes compact passthrough text results unchanged", async () => {
    const server = createMcpServer({
      coordinator: makeCoordinator({
        ok: true,
        value: {
          mode: "compact",
          base_path: "/repo/src",
          next_cursor: null,
          text: "→ Read src/router.ts (only match)\nsrc/router.ts [def]",
        },
      }).coordinator,
    });

    const result = await server.callTool("fff_grep", {
      patterns: ["router"],
      literal: false,
      within: "/repo/src",
    });

    expect(result).toEqual({
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              mode: "compact",
              base_path: "/repo/src",
              next_cursor: null,
              text: "→ Read src/router.ts (only match)\nsrc/router.ts [def]",
            },
            null,
            2,
          ),
        },
      ],
    });
  });

  test("maps public errors through MCP tool failures", async () => {
    const { coordinator } = makeCoordinator({
      ok: false,
      error: {
        code: "WITHIN_NOT_FOUND",
        message: "missing within",
      },
    });
    const server = createMcpServer({ coordinator });

    const result = await server.callTool("fff_find_files", {
      query: "router",
      within: "/missing",
    });

    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: false,
              code: "WITHIN_NOT_FOUND",
              message: "missing within",
            },
            null,
            2,
          ),
        },
      ],
    });
  });
});
