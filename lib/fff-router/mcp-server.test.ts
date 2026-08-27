import { describe, expect, test, vi } from "vitest";
import { createMcpServer, MCP_PROTOCOL_VERSION } from "./mcp-server";
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

function request(method: string, params: Record<string, unknown> = {}) {
  return {
    jsonrpc: "2.0" as const,
    id: 1,
    method,
    params: {
      ...params,
      _meta: {
        "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
}

describe("stateless MCP 2026-07-28 server", () => {
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
      resultType: "complete",
      isError: false,
      structuredContent: {
        tool: "find_files",
        root: "/repo",
        backend: "fff-mcp",
        items: [{ path: "src/router.ts", absolutePath: "/repo/src/router.ts" }],
      },
    });
  });

  test("discovers capabilities without an initialize session", async () => {
    const server = createMcpServer({ service: service() });
    expect(await server.handleRequest(request("server/discover"))).toMatchObject({
      result: {
        resultType: "complete",
        supportedVersions: [MCP_PROTOCOL_VERSION],
        capabilities: { tools: {} },
      },
    });
    expect(await server.handleRequest(request("initialize"))).toMatchObject({
      error: { code: -32601 },
    });
  });

  test("returns serializable JSON Schema and cache hints from tools/list", async () => {
    const response = await createMcpServer({ service: service() }).handleRequest(
      request("tools/list"),
    );
    const serialized = JSON.stringify(response);
    const parsed = JSON.parse(serialized) as {
      result: { resultType: string; ttlMs: number; cacheScope: string; tools: unknown[] };
    };
    expect(parsed).toMatchObject({
      result: {
        resultType: "complete",
        ttlMs: 300_000,
        cacheScope: "private",
      },
    });
    expect(parsed.result.tools[0]).toMatchObject({
      name: "find_files",
      inputSchema: { type: "object" },
    });
  });

  test("requires per-request protocol metadata", async () => {
    const server = createMcpServer({ service: service() });
    expect(
      await server.handleRequest({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    ).toMatchObject({ error: { code: -32602 } });
    expect(
      await server.handleRequest({
        ...request("tools/list"),
        params: {
          _meta: {
            "io.modelcontextprotocol/protocolVersion": "2025-11-25",
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      }),
    ).toMatchObject({ error: { code: -32022 } });
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
