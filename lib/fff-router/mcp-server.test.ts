import { describe, expect, test, vi } from "vitest";
import { createMcpServer } from "./mcp-server";
import type { RouterService } from "./types";

function service(): RouterService {
  return {
    execute: vi.fn<RouterService["execute"]>(async (request) => ({
      ok: true,
      value:
        request.tool === "find_files"
          ? {
              tool: "find_files",
              root: "/repo",
              backend: "fff-mcp",
              items: [{ path: "src/router.ts", absolutePath: "/repo/src/router.ts" }],
              nextCursor: null,
              stats: {
                resultCount: 1,
                coldStart: false,
                workerId: "worker-1",
                workerGeneration: 1,
              },
            }
          : {
              tool: "grep",
              root: "/repo",
              backend: "fff-mcp",
              items: [],
              nextCursor: null,
              stats: {
                resultCount: 0,
                coldStart: false,
                workerId: "worker-1",
                workerGeneration: 1,
              },
            },
    })),
    warm: vi.fn<RouterService["warm"]>(async () => ({ ok: true, value: [] })),
    evict: vi.fn<RouterService["evict"]>(async () => ({
      ok: true,
      value: { evicted: ["/repo"] },
    })),
    status: () => ({ workers: [], limits: { maxWorkers: 12, maxNonGitWorkers: 4 } }),
    close: vi.fn(async () => {}),
  };
}

describe("v1 MCP server", () => {
  test("exposes search and worker-management tools", async () => {
    const tools = await createMcpServer({ service: service() }).listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "find_files",
      "grep",
      "router_status",
      "router_warm",
      "router_evict",
    ]);
  });

  test("returns normalized structured search content", async () => {
    const response = await createMcpServer({ service: service() }).callTool("find_files", {
      query: "router",
      within: "/repo",
    });
    expect(response).toMatchObject({
      isError: false,
      structuredContent: {
        tool: "find_files",
        root: "/repo",
        backend: "fff-mcp",
        items: [{ path: "src/router.ts", absolutePath: "/repo/src/router.ts" }],
      },
    });
  });

  test("returns stable structured error codes in text content", async () => {
    const response = await createMcpServer({ service: service() }).callTool("grep", {
      patterns: [".*"],
      literal: false,
      within: "/repo",
    });
    expect(response).toMatchObject({ isError: true });
    expect(JSON.parse(response.content[0]!.text)).toMatchObject({
      ok: false,
      code: "INVALID_REQUEST",
    });
  });

  test("requires absolute paths for management calls", async () => {
    const response = await createMcpServer({ service: service() }).callTool("router_warm", {
      within: ".",
    });
    expect(JSON.parse(response.content[0]!.text)).toMatchObject({
      code: "INVALID_REQUEST",
    });
  });

  test("distinguishes unexpected service failures from bad caller input", async () => {
    const broken = service();
    broken.execute = async () => {
      throw new Error("unexpected failure");
    };
    const response = await createMcpServer({ service: broken }).callTool("find_files", {
      query: "router",
      within: "/repo",
    });

    expect(JSON.parse(response.content[0]!.text)).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "unexpected failure",
    });
  });
});
