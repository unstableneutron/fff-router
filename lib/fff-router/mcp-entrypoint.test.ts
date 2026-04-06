import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js";
import { afterEach, describe, expect, test } from "vitest";
import { startHttpDaemon } from "./http-daemon";
import type { SearchCoordinator } from "./types";

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
  test("proxies stdio MCP requests through the HTTP daemon and exits on stdin close", async () => {
    const daemon = await startHttpDaemon({
      host: "127.0.0.1",
      port: 0,
      coordinator: makeCoordinator(),
    });
    startedDaemons.push(daemon);

    const child = spawn("bun", [binPath], {
      env: {
        ...process.env,
        FFF_ROUTER_HOST: daemon.metadata.host,
        FFF_ROUTER_PORT: String(daemon.metadata.port),
      },
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

    child.stdin.write(serializeMessage({ jsonrpc: "2.0", method: "notifications/initialized" }));
    child.stdin.write(
      serializeMessage({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "fff_find_files",
          arguments: {
            query: "router",
            within: "/repo/lib",
          },
        },
      }),
    );

    const callResponse = await reader.waitFor((message) => message.id === 2);
    expect(callResponse.error).toBeUndefined();
    expect(JSON.stringify(callResponse.result)).toContain("router.ts");

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
