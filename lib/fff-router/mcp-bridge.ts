import { connectRouter, type RouterClient } from "./http-client";
import { createMcpServer, type McpToolHandler, type McpToolResponse } from "./mcp-server";

type BridgeClient = Pick<RouterClient, "callMcpTool" | "close">;

export type McpHttpBridgeOptions = {
  env?: NodeJS.ProcessEnv;
  connectClient?: () => Promise<BridgeClient>;
  connectStdio?: (handler: McpToolHandler, onClose: () => void) => Promise<void>;
};

function asArguments(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

/**
 * Expose the daemon's authenticated HTTP MCP endpoint as stdio for hosts that
 * only support command-based MCP servers. This process owns no index and does
 * no routing work; it is a thin, stateless protocol adapter to fff-routerd.
 */
export async function runMcpHttpBridge(options: McpHttpBridgeOptions = {}): Promise<void> {
  const env = options.env ?? process.env;
  const client = await (options.connectClient?.() ?? connectRouter({ env }));
  const handler: McpToolHandler = async (name, input) =>
    (await client.callMcpTool(name, asArguments(input))) as McpToolResponse;
  const onClose = () => {
    void client.close();
  };

  try {
    if (options.connectStdio) {
      await options.connectStdio(handler, onClose);
      return;
    }
    await createMcpServer({ handler, env }).connectStdio({ onClose });
  } catch (caught) {
    await client.close().catch(() => {});
    throw caught;
  }
}
