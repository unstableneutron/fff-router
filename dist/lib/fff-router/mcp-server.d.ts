import { type McpToolResponse, type RouterMcpToolName } from "./mcp-tools";
import type { RouterService } from "./types";
export type { McpToolResponse } from "./mcp-tools";
export declare const MCP_PROTOCOL_VERSION = "2026-07-28";
export declare const MCP_PROTOCOL_VERSIONS: readonly ["2026-07-28"];
export type JsonRpcId = string | number | null;
export type JsonRpcRequest = {
    jsonrpc: "2.0";
    id?: JsonRpcId;
    method: string;
    params?: Record<string, unknown>;
};
export type JsonRpcResponse = {
    jsonrpc: "2.0";
    id: JsonRpcId;
    result: unknown;
} | {
    jsonrpc: "2.0";
    id: JsonRpcId;
    error: {
        code: number;
        message: string;
        data?: unknown;
    };
};
export type McpToolHandler = (name: RouterMcpToolName, input: unknown) => Promise<McpToolResponse>;
export declare function jsonRpcError(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse;
export declare function createMcpServer(args: {
    service?: RouterService;
    handler?: McpToolHandler;
    env?: NodeJS.ProcessEnv;
}): {
    listTools: () => Promise<{
        name: RouterMcpToolName;
        description: string;
        inputSchema: import("./public-api").JsonSchema;
        outputSchema: import("./public-api").JsonSchema;
        annotations: {
            readOnlyHint: boolean;
            destructiveHint: boolean;
            idempotentHint: boolean;
            openWorldHint: boolean;
        };
    }[]>;
    callTool: (name: RouterMcpToolName, input: unknown) => Promise<McpToolResponse>;
    handleRequest: (message: unknown) => Promise<JsonRpcResponse | null>;
    connectStdio(options?: {
        onClose?: () => void;
    }): Promise<{
        done: Promise<void>;
        close: () => NodeJS.ReadStream & {
            fd: 0;
        };
    }>;
};
export type McpServer = ReturnType<typeof createMcpServer>;
