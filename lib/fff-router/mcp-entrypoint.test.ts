import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import { describe, expect, test } from "vitest";

const binPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../bin/fff-router-mcp.ts",
);

type JsonRpcMessage = {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
};

function createMessageReader(child: ReturnType<typeof spawn>) {
  const buffer = new ReadBuffer();
  const seen: JsonRpcMessage[] = [];
  const waiters: Array<{
    predicate: (message: JsonRpcMessage) => boolean;
    resolve: (message: JsonRpcMessage) => void;
  }> = [];

  child.stdout?.on("data", (chunk: Buffer) => {
    buffer.append(chunk);
    while (true) {
      const message = buffer.readMessage() as JsonRpcMessage | null;
      if (message == null) {
        return;
      }

      seen.push(message);
      const waiterIndex = waiters.findIndex(({ predicate }) => predicate(message));
      if (waiterIndex >= 0) {
        const [waiter] = waiters.splice(waiterIndex, 1);
        waiter?.resolve(message);
      }
    }
  });

  return {
    waitFor(predicate: (message: JsonRpcMessage) => boolean): Promise<JsonRpcMessage> {
      const existing = seen.find(predicate);
      if (existing) {
        return Promise.resolve(existing);
      }

      return new Promise<JsonRpcMessage>((resolve) => {
        waiters.push({ predicate, resolve });
      });
    },
  };
}

describe("fff-router-mcp entrypoint", () => {
  test("exits promptly after stdin closes following a real MCP request", async () => {
    const child = spawn("bun", [binPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const reader = createMessageReader(child);

    const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve, reject) => {
        child.on("error", reject);
        child.on("close", (code, signal) => resolve({ code, signal }));
      },
    );

    child.stdin.write(
      serializeMessage({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: {
            name: "entrypoint-test",
            version: "1.0.0",
          },
        },
      }),
    );

    const initializeResponse = await reader.waitFor((message) => message.id === 1);
    expect(initializeResponse.error).toBeUndefined();

    child.stdin.write(
      serializeMessage({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    );
    child.stdin.write(
      serializeMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    );

    const toolsResponse = await reader.waitFor((message) => message.id === 2);
    expect(toolsResponse.error).toBeUndefined();
    expect(
      (toolsResponse.result as { tools?: Array<{ name: string }> }).tools?.map((tool) => tool.name),
    ).toEqual(["fff_find_files", "fff_search_terms", "fff_grep"]);

    const startedAt = Date.now();
    child.stdin.end();

    const result = await Promise.race([
      exit,
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("entrypoint did not exit promptly after stdin closed")),
          500,
        );
      }),
    ]);

    const closeDurationMs = Date.now() - startedAt;
    expect(closeDurationMs).toBeLessThan(500);
    expect(result.code).toBe(0);
    expect(result.signal).toBeNull();
  });
});
