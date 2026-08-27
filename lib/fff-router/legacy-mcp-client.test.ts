import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { FileBackedLegacyMcpClient } from "./legacy-mcp-client";

function stringEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("file-backed legacy MCP transport", () => {
  test.runIf(process.platform !== "win32")(
    "round-trips JSON-RPC while retaining process-group supervision",
    async () => {
      const cwd = await mkdtemp(path.join(os.tmpdir(), "fff-file-mcp-test-"));
      const worker = String.raw`
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || "";
  for (const line of lines) {
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.method === "initialize") {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2025-11-25" } }) + "\n");
    } else if (message.method === "tools/call") {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: message.params.name }] } }) + "\n");
    }
  }
});
`;
      const client = new FileBackedLegacyMcpClient({
        command: process.execPath,
        args: ["-e", worker],
        cwd,
        env: stringEnv(),
        sampleIntervalMs: 0,
        shutdownGraceMs: 100,
        killGraceMs: 250,
        initializeTimeoutMs: 2_000,
        filePollIntervalMs: 5,
      });
      try {
        await client.connect();
        const pid = client.pid!;
        await expect(client.callTool("find_files", { query: "router" })).resolves.toEqual({
          content: [{ type: "text", text: "find_files" }],
        });
        expect(processExists(pid)).toBe(true);
        await client.close();
        expect(processExists(pid)).toBe(false);
      } finally {
        await client.close().catch(() => {});
        await rm(cwd, { recursive: true, force: true });
      }
    },
  );
});
