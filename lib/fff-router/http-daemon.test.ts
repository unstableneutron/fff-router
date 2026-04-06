import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, test } from "vitest";
import { startHttpDaemon } from "./http-daemon";
import type { SearchCoordinator } from "./types";

const startedDaemons: Array<Awaited<ReturnType<typeof startHttpDaemon>>> = [];

afterEach(async () => {
  while (startedDaemons.length > 0) {
    await startedDaemons.pop()?.close();
  }
});

function makeCoordinator(): SearchCoordinator {
  return {
    async execute(request) {
      return {
        ok: true,
        value: {
          mode: "compact",
          base_path: request.within || "/repo",
          next_cursor: null,
          items: [{ path: "router.ts" }],
        },
      };
    },
  };
}

describe("startHttpDaemon", () => {
  test("serves the MCP tools over HTTP", async () => {
    const daemon = await startHttpDaemon({
      host: "127.0.0.1",
      port: 0,
      coordinator: makeCoordinator(),
    });
    startedDaemons.push(daemon);

    const transport = new StreamableHTTPClientTransport(new URL(daemon.url));
    const client = new Client({ name: "http-daemon-test", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "fff_find_files",
      "fff_search_terms",
      "fff_grep",
    ]);

    const result = (await client.callTool({
      name: "fff_find_files",
      arguments: {
        query: "router",
        within: "/repo/lib",
      },
    })) as { isError?: boolean; content?: Array<{ type: string; text?: string }> };
    expect(result.isError).toBe(false);
    expect(result.content?.[0]?.type).toBe("text");
    expect(result.content?.[0]?.text).toContain('"path": "router.ts"');

    await client.close();
    await transport.close();
  });
});
