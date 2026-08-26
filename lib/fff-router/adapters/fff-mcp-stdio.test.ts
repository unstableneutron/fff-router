import { describe, expect, test, vi } from "vitest";
import {
  createFffMcpStdioAdapter,
  filterRenderedCompactText,
  waitForFffMcpReady,
  type FffMcpRuntime,
} from "./fff-mcp-stdio";
import type { FindFilesBackendRequest, GrepBackendRequest } from "./types";

const findRequest: FindFilesBackendRequest = {
  persistenceRoot: "/repo",
  queryKind: "find_files",
  within: "/repo/lib",
  basePath: "/repo/lib",
  glob: "**/*.ts",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 5,
  cursor: null,
  query: "router",
};

const grepRequest: GrepBackendRequest = {
  persistenceRoot: "/repo",
  queryKind: "grep",
  within: "/repo/lib",
  basePath: "/repo/lib",
  glob: "**/*.ts",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 5,
  cursor: null,
  patterns: ["createRouterService"],
  literal: true,
  contextLines: 1,
};

function fakeRuntime(callTool: FffMcpRuntime["callTool"]): FffMcpRuntime {
  return { id: "fff-mcp::/repo", close: async () => {}, callTool };
}

describe("fff-mcp compatibility adapter", () => {
  test("accepts an empty repository after fff-mcp completes its scan", async () => {
    const call = vi.fn(async () => "0 results (0 indexed)");
    await expect(waitForFffMcpReady(call)).resolves.toBe("0 results (0 indexed)");
    expect(call).toHaveBeenCalledOnce();
  });

  test("times out a stuck readiness probe with actionable context", async () => {
    await expect(
      waitForFffMcpReady(async () => await new Promise(() => {}), { deadlineMs: 2 }),
    ).rejects.toThrow(/readiness probe exceeded 2ms/);
  });

  test("closes both MCP handles when the client cannot connect", async () => {
    const clientClose = vi.fn(async () => {});
    const transportClose = vi.fn(async () => {});
    const waitForReady = vi.fn(async () => "ready");
    const adapter = createFffMcpStdioAdapter({
      resolveCommand: () => "/fake/fff-mcp",
      createTransport: () => ({ close: transportClose }),
      createClient: () => ({
        connect: async () => {
          throw new Error("connect failed");
        },
        close: clientClose,
        callTool: async () => ({}),
      }),
      waitForReady,
    });

    await expect(adapter.startRuntime({ persistenceRoot: "/repo" })).rejects.toThrow(
      "connect failed",
    );
    expect(clientClose).toHaveBeenCalledOnce();
    expect(transportClose).toHaveBeenCalledOnce();
    expect(waitForReady).not.toHaveBeenCalled();
  });

  test("parses native find_files text and preserves the upstream cursor", async () => {
    const call = vi.fn(async () =>
      [
        "→ Read lib/router.ts (best match)",
        "2/2 matches",
        "lib/router.ts git:clean",
        "outside/escape.ts git:clean",
        "cursor: upstream-2",
      ].join("\n"),
    );
    const result = await createFffMcpStdioAdapter().execute({
      request: { ...findRequest, limit: 1 },
      runtime: fakeRuntime(call),
    });

    expect(call).toHaveBeenCalledWith("find_files", {
      query: "router lib/** **/*.ts *.ts !dist/",
      maxResults: 1,
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        backendId: "fff-mcp",
        queryKind: "find_files",
        nextCursor: "upstream-2",
        items: [{ path: "/repo/lib/router.ts", relativePath: "lib/router.ts" }],
      },
    });
    expect(result.ok && result.value.renderedCompact).not.toContain("outside/escape.ts");
  });

  test("drains filtered find_files pages until it fills the caller's result budget", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce(
        ["1/3 matches", "outside/a.ts git:clean", "cursor: next-page"].join("\n"),
      )
      .mockResolvedValueOnce("lib/router.ts git:clean");
    const result = await createFffMcpStdioAdapter().execute({
      request: { ...findRequest, limit: 1 },
      runtime: fakeRuntime(call),
    });

    expect(call).toHaveBeenNthCalledWith(2, "find_files", {
      query: "router lib/** **/*.ts *.ts !dist/",
      maxResults: 1,
      cursor: "next-page",
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        items: [{ relativePath: "lib/router.ts" }],
        nextCursor: null,
        diagnostics: { cursorDrain: { pagesFetched: 2, filteredOutCount: 1 } },
      },
    });
  });

  test("maps literal grep to multi_grep and parses definition context", async () => {
    const call = vi.fn(async () =>
      [
        "→ Read lib/router.ts (only match)",
        "1/1 matches shown",
        "lib/router.ts [def]",
        " 9: export function createRouterService() {",
        " 10| return service;",
        " 11| }",
        "cursor: upstream-g2",
      ].join("\n"),
    );
    const result = await createFffMcpStdioAdapter().execute({
      request: { ...grepRequest, cursor: "upstream-g1" },
      runtime: fakeRuntime(call),
    });

    expect(call).toHaveBeenCalledWith("multi_grep", {
      patterns: ["createRouterService"],
      constraints: "lib/** **/*.ts *.ts !dist/",
      maxResults: 5,
      context: 1,
      cursor: "upstream-g1",
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        nextCursor: "upstream-g2",
        items: [
          {
            path: "/repo/lib/router.ts",
            line: 9,
            text: "export function createRouterService() {",
            isDefinition: true,
            definitionBody: ["return service;", "}"],
          },
        ],
      },
    });
  });

  test("maps regex grep to upstream grep without pretending to support case flags", async () => {
    const call = vi.fn(async () => "0 matches shown");
    await createFffMcpStdioAdapter().execute({
      request: {
        ...grepRequest,
        literal: false,
        patterns: ["create Router"],
      },
      runtime: fakeRuntime(call),
    });
    expect(call).toHaveBeenCalledWith("grep", {
      query: "lib/** **/*.ts *.ts !dist/ create\\sRouter",
      maxResults: 5,
    });
  });

  test("does not narrow a multi-path union when one entry is the repository root", async () => {
    const call = vi.fn(async () => "0 results (10 indexed)");
    await createFffMcpStdioAdapter().execute({
      request: {
        ...findRequest,
        within: "/repo",
        basePath: "/repo",
        additionalWithinEntries: [{ resolvedWithin: "/repo/lib", basePath: "/repo/lib" }],
      },
      runtime: fakeRuntime(call),
    });
    expect(call).toHaveBeenCalledWith("find_files", {
      query: "router **/*.ts *.ts !dist/",
      maxResults: 5,
    });
  });

  test("leaves unencodable space-containing scopes to the correctness filter", async () => {
    const call = vi.fn(async () => "0 results (10 indexed)");
    await createFffMcpStdioAdapter().execute({
      request: {
        ...findRequest,
        within: "/repo/my folder",
        basePath: "/repo/my folder",
      },
      runtime: fakeRuntime(call),
    });
    expect(call).toHaveBeenCalledWith("find_files", {
      query: "router **/*.ts *.ts !dist/",
      maxResults: 5,
    });
  });

  test("leaves a space-containing single-file scope to the correctness filter", async () => {
    const call = vi.fn(async () => "0 results (10 indexed)");
    await createFffMcpStdioAdapter().execute({
      request: {
        ...findRequest,
        within: "/repo/my folder/router.ts",
        basePath: "/repo/my folder",
        fileRestriction: "/repo/my folder/router.ts",
      },
      runtime: fakeRuntime(call),
    });
    expect(call).toHaveBeenCalledWith("find_files", {
      query: "router **/*.ts *.ts !dist/",
      maxResults: 5,
    });
  });

  test("uses only the remaining result budget while draining filtered grep pages", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce(
        [
          "2/4 matches shown",
          "outside/a.ts",
          " 1: createRouterService",
          "lib/a.ts",
          " 2: createRouterService",
          "cursor: next-page",
        ].join("\n"),
      )
      .mockResolvedValueOnce(["lib/b.ts", " 3: createRouterService"].join("\n"));
    const result = await createFffMcpStdioAdapter().execute({
      request: grepRequest,
      runtime: fakeRuntime(call),
    });

    expect(call).toHaveBeenNthCalledWith(
      2,
      "multi_grep",
      expect.objectContaining({ cursor: "next-page", maxResults: 4 }),
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        items: [{ relativePath: "lib/a.ts" }, { relativePath: "lib/b.ts" }],
        nextCursor: null,
      },
    });
  });

  test("filters native compact output in lockstep with structured items", () => {
    expect(
      filterRenderedCompactText(
        ["a.ts", " 1: hit", "b.ts", " 2: hit", "cursor: 2"].join("\n"),
        (relativePath) => relativePath === "a.ts",
      ),
    ).toBe(["a.ts", " 1: hit", "cursor: 2"].join("\n"));
  });
});
