import { PACKAGE_VERSION } from "./daemon-config";
import {
  executeMcpTool,
  listMcpTools,
  type McpToolResponse,
  type RouterMcpToolName,
} from "./mcp-tools";
import type { RouterService } from "./types";

export type { McpToolResponse } from "./mcp-tools";

export const MCP_PROTOCOL_VERSION = "2026-07-28";
export const MCP_PROTOCOL_VERSIONS = [MCP_PROTOCOL_VERSION] as const;

export type JsonRpcId = string | number | null;
export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};
export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | {
      jsonrpc: "2.0";
      id: JsonRpcId;
      error: { code: number; message: string; data?: unknown };
    };

export type McpToolHandler = (name: RouterMcpToolName, input: unknown) => Promise<McpToolResponse>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}

function serverMeta() {
  return {
    "io.modelcontextprotocol/serverInfo": {
      name: "fff-router",
      version: PACKAGE_VERSION,
    },
  };
}

function completeResult<T extends Record<string, unknown>>(
  result: T,
): T & {
  resultType: "complete";
  _meta: ReturnType<typeof serverMeta>;
} {
  return { resultType: "complete", ...result, _meta: serverMeta() };
}

function validateModernRequest(
  value: unknown,
): { ok: true; request: JsonRpcRequest } | { ok: false; response: JsonRpcResponse } {
  const id =
    isRecord(value) && (typeof value.id === "string" || typeof value.id === "number")
      ? value.id
      : null;
  if (!isRecord(value) || value.jsonrpc !== "2.0" || typeof value.method !== "string") {
    return { ok: false, response: jsonRpcError(id, -32600, "Invalid Request") };
  }
  if (!(typeof value.id === "string" || typeof value.id === "number") && value.id !== undefined) {
    return {
      ok: false,
      response: jsonRpcError(null, -32600, "Invalid Request: id must be a string or number"),
    };
  }
  if (!isRecord(value.params)) {
    return { ok: false, response: jsonRpcError(id, -32602, "params must be an object") };
  }
  const meta = value.params._meta;
  if (!isRecord(meta)) {
    return { ok: false, response: jsonRpcError(id, -32602, "params._meta is required") };
  }
  const requestedVersion = meta["io.modelcontextprotocol/protocolVersion"];
  if (requestedVersion !== MCP_PROTOCOL_VERSION) {
    return {
      ok: false,
      response: jsonRpcError(id, -32022, "Unsupported protocol version", {
        supported: [...MCP_PROTOCOL_VERSIONS],
        ...(typeof requestedVersion === "string" ? { requested: requestedVersion } : {}),
      }),
    };
  }
  if (!isRecord(meta["io.modelcontextprotocol/clientCapabilities"])) {
    return {
      ok: false,
      response: jsonRpcError(
        id,
        -32602,
        "params._meta.io.modelcontextprotocol/clientCapabilities is required",
      ),
    };
  }
  return { ok: true, request: value as JsonRpcRequest };
}

export function createMcpServer(args: {
  service?: RouterService;
  handler?: McpToolHandler;
  env?: NodeJS.ProcessEnv;
}) {
  if (!args.service && !args.handler) {
    throw new Error("createMcpServer requires a RouterService or MCP tool handler");
  }

  async function callTool(name: RouterMcpToolName, input: unknown): Promise<McpToolResponse> {
    if (args.handler) return await args.handler(name, input);
    return await executeMcpTool({ service: args.service!, name, input, env: args.env });
  }

  async function handleRequest(message: unknown): Promise<JsonRpcResponse | null> {
    const validated = validateModernRequest(message);
    if (!validated.ok) return validated.response;
    const request = validated.request;
    if (request.id === undefined) {
      return null;
    }
    const id = request.id;
    switch (request.method) {
      case "server/discover":
        return {
          jsonrpc: "2.0",
          id,
          result: completeResult({
            supportedVersions: [...MCP_PROTOCOL_VERSIONS],
            capabilities: { tools: {} },
            instructions:
              "Use find_files to discover relevant files and grep for exact identifiers. All searches are read-only and scoped to an absolute repository path.",
            ttlMs: 300_000,
            cacheScope: "private",
          }),
        };
      case "tools/list": {
        const cursor = request.params?.cursor;
        if (cursor !== undefined && cursor !== null) {
          return jsonRpcError(id, -32602, "tools/list does not have another page");
        }
        return {
          jsonrpc: "2.0",
          id,
          result: completeResult({
            tools: listMcpTools(),
            ttlMs: 300_000,
            cacheScope: "private",
          }),
        };
      }
      case "tools/call": {
        const name = request.params?.name;
        if (typeof name !== "string") {
          return jsonRpcError(id, -32602, "tools/call params.name must be a string");
        }
        const known = listMcpTools().some((tool) => tool.name === name);
        if (!known) return jsonRpcError(id, -32602, `Unknown tool '${name}'`);
        const input = request.params?.arguments;
        if (input !== undefined && !isRecord(input)) {
          return jsonRpcError(id, -32602, "tools/call params.arguments must be an object");
        }
        const result = await callTool(name as RouterMcpToolName, input ?? {});
        return {
          jsonrpc: "2.0",
          id,
          result: { ...result, _meta: serverMeta() },
        };
      }
      case "initialize":
        return jsonRpcError(
          id,
          -32601,
          `This server implements stateless MCP ${MCP_PROTOCOL_VERSION}; use server/discover instead of initialize`,
        );
      default:
        return jsonRpcError(id, -32601, `Method not found: ${request.method}`);
    }
  }

  return {
    listTools: async () => listMcpTools(),
    callTool,
    handleRequest,
    async connectStdio(options: { onClose?: () => void } = {}) {
      let buffered = "";
      let chain = Promise.resolve();
      let settled = false;
      const done = new Promise<void>((resolve, reject) => {
        const finish = () => {
          if (settled) return;
          settled = true;
          options.onClose?.();
          resolve();
        };
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk: string) => {
          buffered += chunk;
          const lines = buffered.split(/\r?\n/);
          buffered = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            chain = chain.then(async () => {
              let response: JsonRpcResponse | null;
              try {
                response = await handleRequest(JSON.parse(line));
              } catch (caught) {
                response = jsonRpcError(
                  null,
                  -32700,
                  caught instanceof SyntaxError
                    ? "Parse error"
                    : caught instanceof Error
                      ? caught.message
                      : String(caught),
                );
              }
              if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
            });
          }
        });
        process.stdin.once("end", () => void chain.then(finish, reject));
        process.stdin.once("error", reject);
        process.stdin.resume();
      });
      return { done, close: () => process.stdin.pause() };
    },
  };
}

export type McpServer = ReturnType<typeof createMcpServer>;
