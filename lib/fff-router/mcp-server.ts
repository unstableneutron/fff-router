import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { executeMcpTool, listMcpTools, MCP_TOOLS } from "./mcp-tools";
import type { PublicToolName, SearchCoordinator } from "./types";

export type McpToolResponse = Awaited<ReturnType<typeof executeMcpTool>>;

export function createMcpServer(args: { coordinator: SearchCoordinator }) {
	async function callTool(
		name: PublicToolName,
		input: unknown,
	): Promise<McpToolResponse> {
		return executeMcpTool({
			coordinator: args.coordinator,
			name,
			input,
		});
	}

	function toSdkServer() {
		const server = new McpServer({
			name: "fff-router-mcp",
			version: "2.0.0",
		});

		for (const tool of MCP_TOOLS) {
			server.registerTool(
				tool.name,
				{
					description: tool.description,
					inputSchema: tool.zodInputShape,
				},
				async (input) => {
					return await callTool(tool.name, input);
				},
			);
		}

		return server;
	}

	return {
		listTools: async () => listMcpTools(),
		callTool,
		toSdkServer,
		async connectStdio() {
			const transport = new StdioServerTransport();
			const server = toSdkServer();
			await server.connect(transport);
			return server;
		},
	};
}
