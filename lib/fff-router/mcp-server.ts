import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PACKAGE_VERSION } from "./daemon-config";
import {
  executeMcpTool,
  listMcpTools,
  MCP_INPUT_SCHEMAS,
  MCP_TOOLS,
  type RouterMcpToolName,
} from "./mcp-tools";
import type { RouterService } from "./types";

export type McpToolResponse = Awaited<ReturnType<typeof executeMcpTool>>;
export type McpToolHandler = (name: RouterMcpToolName, input: unknown) => Promise<McpToolResponse>;

export function createMcpServer(args: {
  service?: RouterService;
  handler?: McpToolHandler;
  env?: NodeJS.ProcessEnv;
}) {
  if (!args.service && !args.handler) {
    throw new Error("createMcpServer requires a RouterService or MCP tool handler");
  }

  async function callTool(name: RouterMcpToolName, input: unknown): Promise<McpToolResponse> {
    if (args.handler) {
      return await args.handler(name, input);
    }
    return await executeMcpTool({
      service: args.service!,
      name,
      input,
      env: args.env,
    });
  }

  function toSdkServer() {
    const server = new McpServer({
      name: "fff-router",
      version: PACKAGE_VERSION,
    });

    for (const tool of MCP_TOOLS) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: MCP_INPUT_SCHEMAS[tool.name].shape,
        },
        async (input: unknown) => await callTool(tool.name, input),
      );
    }

    return server;
  }

  return {
    listTools: async () => listMcpTools(),
    callTool,
    toSdkServer,
    async connectStdio(options: { onClose?: () => void } = {}) {
      const transport = new StdioServerTransport();
      transport.onclose = options.onClose;
      const server = toSdkServer();
      await server.connect(transport);
      return { server, transport };
    },
  };
}
