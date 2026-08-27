import path from "node:path";
import { ensureDaemonRunning } from "./daemon-autostart";
import { getDaemonEndpoint, getDaemonPaths, PACKAGE_VERSION } from "./daemon-config";
import { expandHomePath } from "./home-path";
import { bearerHeaders, readDaemonAuthToken } from "./local-auth";
import { MCP_PROTOCOL_VERSION } from "./mcp-server";
import { requestJson } from "./http-json";
import {
  evictResultSchema,
  findFilesResultSchema,
  grepResultSchema,
  routerStatusSchema,
  warmResultSchema,
  type RuntimeSchema,
} from "./public-api";
import type {
  FindFilesResult,
  GrepResult,
  Result,
  RouterError,
  RouterStatus,
  WorkerDiagnostic,
} from "./types";

type CommonClientInput = {
  within?: string | string[];
  glob?: string;
  extensions?: string[];
  excludePaths?: string[];
  limit?: number;
  cursor?: string | null;
};

export type FindFilesClientInput = CommonClientInput & { query: string };
export type GrepClientInput = CommonClientInput & {
  patterns: string | string[];
  literal?: boolean;
  contextLines?: number;
};
export type RouterClientOptions = {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  autoStart?: boolean;
};
export type ToolResponse = {
  resultType?: "complete";
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
};

function clientError(message: string): Result<never, RouterError> {
  return { ok: false, error: { code: "DAEMON_UNAVAILABLE", message, retryable: true } };
}

function errorFromResponse(response: ToolResponse): RouterError {
  const text = response.content?.find((item) => item.type === "text")?.text ?? "tool call failed";
  try {
    const parsed = JSON.parse(text) as { code?: string; message?: string };
    return {
      code: (parsed.code ?? "INTERNAL_ERROR") as RouterError["code"],
      message: parsed.message ?? text,
    };
  } catch {
    return { code: "INTERNAL_ERROR", message: text };
  }
}

function structured<T>(response: ToolResponse, schema: RuntimeSchema<T>): Result<T, RouterError> {
  if (response.isError) return { ok: false, error: errorFromResponse(response) };
  if (response.structuredContent === undefined) {
    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "fff-routerd returned no structured content" },
    };
  }
  const parsed = schema.safeParse(response.structuredContent);
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "result"}: ${issue.message}`)
      .join("; ");
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: `fff-routerd returned incompatible structured content: ${details}`,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

function resolveWithin(
  within: string | string[] | undefined,
  cwd: string,
  env: NodeJS.ProcessEnv,
): string[] {
  const values = within === undefined ? [cwd] : Array.isArray(within) ? within : [within];
  return values.map((value) => {
    const expanded = expandHomePath(value, env);
    if (!expanded.ok) throw new Error(expanded.error.message);
    return path.isAbsolute(expanded.value)
      ? path.normalize(expanded.value)
      : path.resolve(cwd, expanded.value);
  });
}

function encodeMcpHeader(value: string): string {
  if (/^[\x21-\x7e](?:[\x20-\x7e]*[\x21-\x7e])?$/.test(value) && !value.startsWith("=?base64?")) {
    return value;
  }
  return `=?base64?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class RouterClient {
  private endpoint: string | null = null;
  private authToken: string | null = null;
  private connecting: Promise<void> | null = null;
  private closed = false;
  private requestId = 0;
  private readonly env: NodeJS.ProcessEnv;
  private readonly cwd: string;
  private readonly autoStart: boolean;

  get isClosed(): boolean {
    return this.closed;
  }

  constructor(options: RouterClientOptions = {}) {
    this.env = options.env ?? process.env;
    this.cwd = path.resolve(options.cwd ?? process.cwd());
    this.autoStart = options.autoStart !== false;
  }

  private async connect(): Promise<void> {
    if (this.closed) throw new Error("fff-router client is closed");
    if (this.endpoint && this.authToken) return;
    if (this.connecting) return await this.connecting;
    this.connecting = (async () => {
      if (this.autoStart) await ensureDaemonRunning(this.env);
      const authToken = await readDaemonAuthToken(this.env);
      if (!authToken)
        throw new Error("fff-routerd authentication token is missing; restart the daemon");
      this.endpoint = getDaemonEndpoint({ env: this.env });
      this.authToken = authToken;
    })();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private disconnect(): void {
    this.endpoint = null;
    this.authToken = null;
  }

  private async request(
    method: string,
    params: Record<string, unknown>,
    name?: string,
  ): Promise<unknown> {
    await this.connect();
    const id = ++this.requestId;
    const body = {
      jsonrpc: "2.0",
      id,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientInfo": {
            name: "fff-router-client",
            version: PACKAGE_VERSION,
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    };
    const response = await requestJson(this.endpoint!, {
      method: "POST",
      headers: {
        ...bearerHeaders(this.authToken!),
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": MCP_PROTOCOL_VERSION,
        "mcp-method": method,
        ...(name ? { "mcp-name": encodeMcpHeader(name) } : {}),
      },
      body: JSON.stringify(body),
    });
    const payload = response.payload;
    if (!isRecord(payload) || payload.jsonrpc !== "2.0" || payload.id !== id) {
      throw new Error(`fff-routerd returned an invalid MCP response (HTTP ${response.status})`);
    }
    if (isRecord(payload.error)) {
      const code = typeof payload.error.code === "number" ? payload.error.code : -32603;
      const message =
        typeof payload.error.message === "string" ? payload.error.message : "MCP request failed";
      throw new Error(`MCP ${code}: ${message}`);
    }
    if (!("result" in payload)) throw new Error("fff-routerd MCP response has no result");
    return payload.result;
  }

  async callMcpTool(
    name: string,
    input: Record<string, unknown>,
    allowReconnect = true,
  ): Promise<ToolResponse> {
    try {
      return (await this.request("tools/call", { name, arguments: input }, name)) as ToolResponse;
    } catch (caught) {
      this.disconnect();
      if (allowReconnect) return await this.callMcpTool(name, input, false);
      throw caught;
    }
  }

  private async callTool<T>(
    name: string,
    input: Record<string, unknown>,
    schema: RuntimeSchema<T>,
  ): Promise<Result<T, RouterError>> {
    try {
      return structured(await this.callMcpTool(name, input), schema);
    } catch (caught) {
      return clientError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async findFiles(input: FindFilesClientInput): Promise<Result<FindFilesResult, RouterError>> {
    return await this.callTool(
      "find_files",
      { ...input, within: resolveWithin(input.within, this.cwd, this.env) },
      findFilesResultSchema,
    );
  }

  async grep(input: GrepClientInput): Promise<Result<GrepResult, RouterError>> {
    return await this.callTool(
      "grep",
      {
        ...input,
        patterns: Array.isArray(input.patterns) ? input.patterns : [input.patterns],
        within: resolveWithin(input.within, this.cwd, this.env),
      },
      grepResultSchema,
    );
  }

  async warm(
    within: string | string[],
  ): Promise<Result<{ workers: WorkerDiagnostic[] }, RouterError>> {
    return await this.callTool(
      "router_warm",
      { within: resolveWithin(within, this.cwd, this.env) },
      warmResultSchema,
    );
  }

  async evict(within: string | string[]): Promise<Result<{ evicted: string[] }, RouterError>> {
    return await this.callTool(
      "router_evict",
      { within: resolveWithin(within, this.cwd, this.env) },
      evictResultSchema,
    );
  }

  async status(): Promise<Result<RouterStatus, RouterError>> {
    return await this.callTool("router_status", {}, routerStatusSchema);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.disconnect();
  }
}

export async function connectRouter(options: RouterClientOptions = {}): Promise<RouterClient> {
  const client = new RouterClient(options);
  const status = await client.status();
  if (!status.ok) {
    await client.close();
    throw new Error(`${status.error.code}: ${status.error.message}`);
  }
  return client;
}

const CLIENTS_KEY = "__fffRouterClientsV2__";

function globalClients(): Map<string, Promise<RouterClient>> {
  const global = globalThis as typeof globalThis & {
    [CLIENTS_KEY]?: Map<string, Promise<RouterClient>>;
  };
  return (global[CLIENTS_KEY] ??= new Map());
}

export async function getRouterClient(options: RouterClientOptions = {}): Promise<RouterClient> {
  const env = options.env ?? process.env;
  const key = `${getDaemonEndpoint({ env })}::${getDaemonPaths({ env }).authTokenPath}::${path.resolve(options.cwd ?? process.cwd())}::${options.autoStart !== false}`;
  const clients = globalClients();
  let client = clients.get(key);
  if (!client) {
    client = connectRouter(options).catch((caught) => {
      clients.delete(key);
      throw caught;
    });
    clients.set(key, client);
  }
  const resolved = await client;
  if (resolved.isClosed) {
    clients.delete(key);
    return await getRouterClient(options);
  }
  return resolved;
}
