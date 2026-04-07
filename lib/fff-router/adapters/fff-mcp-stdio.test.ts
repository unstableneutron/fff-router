import { describe, expect, test } from "vitest";
import { createFffMcpStdioAdapter, waitForFffMcpReady } from "./fff-mcp-stdio";
import type {
  FindFilesBackendRequest,
  GrepBackendRequest,
  SearchTermsBackendRequest,
} from "./types";

const findFilesRequest: FindFilesBackendRequest = {
  backendId: "fff-mcp",
  persistenceRoot: "/repo",
  queryKind: "find_files",
  within: "/repo/lib",
  basePath: "/repo/lib",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 5,
  query: "router",
};

const searchTermsRequest: SearchTermsBackendRequest = {
  backendId: "fff-mcp",
  persistenceRoot: "/repo",
  queryKind: "search_terms",
  within: "/repo/lib",
  basePath: "/repo/lib",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 5,
  terms: ["createSearchCoordinator"],
  contextLines: 1,
};

const grepRequest: GrepBackendRequest = {
  backendId: "fff-mcp",
  persistenceRoot: "/repo",
  queryKind: "grep",
  within: "/repo/lib",
  basePath: "/repo/lib",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 5,
  pattern: "createSearchCoordinator",
  caseSensitive: true,
  contextLines: 1,
};

describe("waitForFffMcpReady", () => {
  test("polls until stock fff-mcp reports a non-zero indexed corpus", async () => {
    const callTool = async (_name: string, _args: Record<string, unknown>) => {
      responses += 1;
      return responses === 1 ? "0 results (0 indexed)" : "lib/fff-router/coordinator.ts git:clean";
    };
    let responses = 0;

    await waitForFffMcpReady(callTool, async () => {});

    expect(responses).toBe(2);
  });
});

describe("createFffMcpStdioAdapter", () => {
  test("maps find_files requests onto stock fff-mcp and parses file results", async () => {
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const adapter = createFffMcpStdioAdapter();

    const result = await adapter.execute({
      request: findFilesRequest,
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          return "lib/fff-router/coordinator.test.ts git:clean\nlib/fff-router/coordinator.ts git:clean";
        },
      },
    });

    expect(calls).toEqual([
      {
        name: "find_files",
        arguments: {
          query: "router lib/ *.ts !dist/",
          maxResults: 5,
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([
      {
        path: "/repo/lib/fff-router/coordinator.test.ts",
        relativePath: "lib/fff-router/coordinator.test.ts",
      },
      {
        path: "/repo/lib/fff-router/coordinator.ts",
        relativePath: "lib/fff-router/coordinator.ts",
      },
    ]);
  });

  test("applies router-side filtering to parsed stock fff-mcp results", async () => {
    const adapter = createFffMcpStdioAdapter();

    const result = await adapter.execute({
      request: {
        ...findFilesRequest,
        limit: 1,
      },
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async () =>
          ["lib/fff-router/coordinator.test.ts git:clean", "outside/escape.ts git:clean"].join(
            "\n",
          ),
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([
      {
        path: "/repo/lib/fff-router/coordinator.test.ts",
        relativePath: "lib/fff-router/coordinator.test.ts",
      },
    ]);
  });

  test("maps multi_grep requests and parses content output with context", async () => {
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const adapter = createFffMcpStdioAdapter();

    const result = await adapter.execute({
      request: searchTermsRequest,
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          return [
            "→ Read lib/fff-router/coordinator.test.ts (only match)",
            "lib/fff-router/coordinator.test.ts",
            ' 8-} from "./adapters/types";',
            ' 9: import { createSearchCoordinator } from "./coordinator";',
            ' 10-import { RuntimeManager } from "./runtime-manager";',
            "--",
          ].join("\n");
        },
      },
    });

    expect(calls).toEqual([
      {
        name: "multi_grep",
        arguments: {
          patterns: ["createSearchCoordinator"],
          constraints: "lib/ *.ts !dist/",
          maxResults: 5,
          context: 1,
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([
      {
        path: "/repo/lib/fff-router/coordinator.test.ts",
        relativePath: "lib/fff-router/coordinator.test.ts",
        line: 9,
        text: 'import { createSearchCoordinator } from "./coordinator";',
        contextBefore: ['} from "./adapters/types";'],
        contextAfter: ['import { RuntimeManager } from "./runtime-manager";'],
      },
    ]);
  });

  test("maps grep requests and parses line matches", async () => {
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const adapter = createFffMcpStdioAdapter();

    const result = await adapter.execute({
      request: grepRequest,
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          return [
            "→ Read lib/fff-router/coordinator.test.ts (only match)",
            "5/13 matches shown",
            "lib/fff-router/coordinator.test.ts",
            ' 84: describe("createSearchCoordinator", () => {',
            " 96: const coordinator = createSearchCoordinator({",
          ].join("\n");
        },
      },
    });

    expect(calls).toEqual([
      {
        name: "grep",
        arguments: {
          query: "lib/ *.ts !dist/ createSearchCoordinator",
          maxResults: 5,
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([
      {
        path: "/repo/lib/fff-router/coordinator.test.ts",
        relativePath: "lib/fff-router/coordinator.test.ts",
        line: 84,
        text: 'describe("createSearchCoordinator", () => {',
      },
      {
        path: "/repo/lib/fff-router/coordinator.test.ts",
        relativePath: "lib/fff-router/coordinator.test.ts",
        line: 96,
        text: "const coordinator = createSearchCoordinator({",
      },
    ]);
  });
});
