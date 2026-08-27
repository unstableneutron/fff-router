import { type JsonSchema } from "./public-api";
import type { PublicToolName, RouterService } from "./types";
export type RouterMcpToolName = PublicToolName | "router_status" | "router_warm" | "router_evict";
export type McpToolDefinition = {
    name: RouterMcpToolName;
    description: string;
    inputSchema: JsonSchema;
    outputSchema: JsonSchema;
    annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        idempotentHint: boolean;
        openWorldHint: boolean;
    };
};
export declare const MCP_TOOLS: readonly McpToolDefinition[];
export type McpTextContent = {
    type: "text";
    text: string;
};
export type McpToolResponse = {
    resultType: "complete";
    isError: boolean;
    content: McpTextContent[];
    structuredContent?: unknown;
};
export declare function listMcpTools(): {
    name: RouterMcpToolName;
    description: string;
    inputSchema: JsonSchema;
    outputSchema: JsonSchema;
    annotations: {
        readOnlyHint: boolean;
        destructiveHint: boolean;
        idempotentHint: boolean;
        openWorldHint: boolean;
    };
}[];
export declare function executeMcpTool(args: {
    service: RouterService;
    name: RouterMcpToolName;
    input: unknown;
    env?: NodeJS.ProcessEnv;
}): Promise<McpToolResponse>;
export declare const MCP_INPUT_SCHEMAS: {
    readonly find_files: JsonSchema;
    readonly grep: JsonSchema;
    readonly router_status: JsonSchema;
    readonly router_warm: JsonSchema;
    readonly router_evict: JsonSchema;
};
export declare const MCP_OUTPUT_SCHEMAS: {
    readonly find_files: JsonSchema;
    readonly grep: JsonSchema;
    readonly router_status: JsonSchema;
    readonly router_warm: JsonSchema;
    readonly router_evict: JsonSchema;
};
