import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getDaemonEndpoint } from "./daemon-config";
import type {
  PublicCompactFindFilesResult,
  PublicCompactGrepResult,
  PublicCompactRenderedTextResult,
  PublicCompactSearchTermsResult,
  PublicErrorCode,
  PublicFindFilesRequest,
  PublicGrepRequest,
  PublicJsonResult,
  PublicSearchTermsRequest,
  PublicToolName,
  PublicToolRequest,
  SearchCoordinatorResult,
} from "./types";

function toToolCall(request: PublicToolRequest): {
  name: PublicToolName;
  input: Record<string, unknown>;
} {
  const common: Record<string, unknown> = {
    within: request.within,
    extensions: request.extensions,
    exclude_paths: request.excludePaths,
    limit: request.limit,
    cursor: request.cursor,
    output_mode: request.outputMode,
  };

  switch (request.tool) {
    case "fff_find_files": {
      const findRequest = request as PublicFindFilesRequest;
      return {
        name: request.tool,
        input: {
          query: findRequest.query,
          ...common,
        },
      };
    }
    case "fff_search_terms": {
      const searchTermsRequest = request as PublicSearchTermsRequest;
      return {
        name: request.tool,
        input: {
          terms: searchTermsRequest.terms,
          context_lines: searchTermsRequest.contextLines,
          ...common,
        },
      };
    }
    case "fff_grep": {
      const grepRequest = request as PublicGrepRequest;
      return {
        name: request.tool,
        input: {
          pattern: grepRequest.pattern,
          case_sensitive: grepRequest.caseSensitive,
          context_lines: grepRequest.contextLines,
          ...common,
        },
      };
    }
  }
}

export function unwrapToolResponse(response: {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
}): SearchCoordinatorResult {
  const first = response.content?.[0];
  if (!first || first.type !== "text" || typeof first.text !== "string") {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "daemon returned a non-text MCP tool response",
      },
    };
  }

  const parsed = JSON.parse(first.text) as
    | PublicCompactFindFilesResult
    | PublicCompactSearchTermsResult
    | PublicCompactGrepResult
    | PublicCompactRenderedTextResult
    | PublicJsonResult
    | { code?: PublicErrorCode; message?: string };
  if (response.isError) {
    return {
      ok: false,
      error: {
        code:
          typeof parsed === "object" &&
          parsed &&
          "code" in parsed &&
          typeof parsed.code === "string"
            ? parsed.code
            : "INTERNAL_ERROR",
        message:
          typeof parsed === "object" &&
          parsed &&
          "message" in parsed &&
          typeof parsed.message === "string"
            ? parsed.message
            : "daemon call failed",
      },
    };
  }

  return {
    ok: true,
    value: parsed as any,
  };
}

export async function createPersistentHttpToolClient(env?: NodeJS.ProcessEnv) {
  const transport = new StreamableHTTPClientTransport(new URL(getDaemonEndpoint({ env })));
  const client = new Client(
    { name: "fff-router-http-client", version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(transport);

  return {
    async callPublicTool(request: PublicToolRequest): Promise<SearchCoordinatorResult> {
      const toolCall = toToolCall(request);
      const response = (await client.callTool({
        name: toolCall.name,
        arguments: toolCall.input,
      })) as {
        isError?: boolean;
        content?: Array<{ type: string; text?: string }>;
      };
      return unwrapToolResponse(response);
    },
    async close() {
      await client.close().catch(() => {});
      await transport.close().catch(() => {});
    },
  };
}

export async function callPublicToolOverHttp(
  request: PublicToolRequest,
  env?: NodeJS.ProcessEnv,
): Promise<SearchCoordinatorResult> {
  const client = await createPersistentHttpToolClient(env);

  try {
    return await client.callPublicTool(request);
  } finally {
    await client.close();
  }
}
