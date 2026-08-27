import { type RouterClient } from "./http-client";
import { type McpToolHandler } from "./mcp-server";
type BridgeClient = Pick<RouterClient, "callMcpTool" | "close">;
export type McpHttpBridgeOptions = {
    env?: NodeJS.ProcessEnv;
    connectClient?: () => Promise<BridgeClient>;
    connectStdio?: (handler: McpToolHandler, onClose: () => void) => Promise<void>;
};
/**
 * Expose the daemon's authenticated HTTP MCP endpoint as stdio for hosts that
 * only support command-based MCP servers. This process owns no index and does
 * no routing work; it is a thin, stateless protocol adapter to fff-routerd.
 */
export declare function runMcpHttpBridge(options?: McpHttpBridgeOptions): Promise<void>;
export {};
