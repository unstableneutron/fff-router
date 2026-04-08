#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ensureDaemonRunning } from "../lib/fff-router/daemon-autostart";
import { createPersistentHttpToolClient } from "../lib/fff-router/http-client";
import { createMcpServer } from "../lib/fff-router/mcp-server";
import type { SearchCoordinator } from "../lib/fff-router/types";

await ensureDaemonRunning();
const daemonClient = await createPersistentHttpToolClient();

const coordinator: SearchCoordinator = {
  async execute(request) {
    return await daemonClient.callPublicTool(request);
  },
};

const server = createMcpServer({ coordinator });

async function main() {
  const sdkServer = server.toSdkServer();
  const transport = new StdioServerTransport();

  let closing: Promise<void> | null = null;
  const closeServer = () => {
    if (!closing) {
      closing = Promise.allSettled([sdkServer.close(), daemonClient.close()])
        .then(() => undefined)
        .catch((error) => {
          console.error("fff-router-mcp shutdown failed:", error);
        });
    }

    return closing;
  };

  process.stdin.once("end", () => {
    void closeServer();
  });
  process.stdin.once("close", () => {
    void closeServer();
  });
  process.once("SIGINT", () => {
    void closeServer();
  });
  process.once("SIGTERM", () => {
    void closeServer();
  });

  await sdkServer.connect(transport);
}

main().catch((error) => {
  console.error("fff-router-mcp failed:", error);
  process.exit(1);
});
