import path from "node:path";
import {
  evictResultJsonSchema,
  findFilesInputSchema,
  findFilesResultJsonSchema,
  grepInputSchema,
  grepResultJsonSchema,
  normalizePublicToolInput,
  ProtocolValidationError,
  PUBLIC_TOOL_DEFINITIONS,
  routerStatusJsonSchema,
  warmResultJsonSchema,
  type JsonSchema,
} from "./public-api";
import type { PublicToolName, PublicToolResult, RouterService } from "./types";

export type RouterMcpToolName = PublicToolName | "router_status" | "router_warm" | "router_evict";

const adminWithinJsonSchema: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["within"],
  properties: {
    within: {
      oneOf: [
        { type: "string", minLength: 1 },
        {
          type: "array",
          minItems: 1,
          maxItems: 32,
          items: { type: "string", minLength: 1 },
        },
      ],
    },
  },
};

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

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const MCP_TOOLS: readonly McpToolDefinition[] = [
  ...PUBLIC_TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema.jsonSchema,
    outputSchema: tool.outputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
  })),
  {
    name: "router_status",
    description: "Show the shared fff-routerd worker pool, resource usage, and health state.",
    inputSchema: {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
    },
    outputSchema: routerStatusJsonSchema,
    annotations: READ_ONLY_ANNOTATIONS,
  },
  {
    name: "router_warm",
    description: "Start and retain warm fff-mcp workers for one or more absolute paths.",
    inputSchema: adminWithinJsonSchema,
    outputSchema: warmResultJsonSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "router_evict",
    description: "Drain and remove fff-mcp workers for one or more absolute paths.",
    inputSchema: adminWithinJsonSchema,
    outputSchema: evictResultJsonSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

export type McpTextContent = { type: "text"; text: string };
export type McpToolResponse = {
  resultType: "complete";
  isError: boolean;
  content: McpTextContent[];
  structuredContent?: unknown;
};

function formatResult(result: PublicToolResult): string {
  if (result.displayText) return result.displayText;
  if (result.tool === "find_files") {
    return result.items.length > 0
      ? result.items.map((item) => item.path).join("\n")
      : "0 results.";
  }
  return result.items.length > 0
    ? result.items.map((item) => `${item.path}\n  ${item.line}: ${item.text}`).join("\n--\n")
    : "0 matches.";
}

function errorResponse(code: string, message: string): McpToolResponse {
  return {
    resultType: "complete",
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ ok: false, code, message }) }],
  };
}

function successResponse(text: string, structuredContent: unknown): McpToolResponse {
  return {
    resultType: "complete",
    isError: false,
    content: [{ type: "text", text }],
    structuredContent,
  };
}

function normalizeAdminWithin(input: unknown): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ProtocolValidationError([{ path: [], message: "request must be an object" }]);
  }
  const record = input as Record<string, unknown>;
  const unknown = Object.keys(record).find((key) => key !== "within");
  if (unknown) {
    throw new ProtocolValidationError([{ path: [unknown], message: "unknown field" }]);
  }
  const values = Array.isArray(record.within) ? record.within : [record.within];
  if (values.length === 0 || values.length > 32) {
    throw new ProtocolValidationError([
      { path: ["within"], message: "must contain between 1 and 32 paths" },
    ]);
  }
  return values.map((value, index) => {
    if (typeof value !== "string" || value.length === 0 || !path.isAbsolute(value)) {
      throw new ProtocolValidationError([
        { path: ["within", index], message: "within paths must be absolute" },
      ]);
    }
    return path.normalize(value);
  });
}

export function listMcpTools() {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    annotations: tool.annotations,
  }));
}

export async function executeMcpTool(args: {
  service: RouterService;
  name: RouterMcpToolName;
  input: unknown;
  env?: NodeJS.ProcessEnv;
}): Promise<McpToolResponse> {
  try {
    switch (args.name) {
      case "find_files":
      case "grep": {
        const normalized = normalizePublicToolInput(args.name, args.input, args.env);
        if (!normalized.ok) return errorResponse(normalized.error.code, normalized.error.message);
        const result = await args.service.execute(normalized.value);
        if (!result.ok) return errorResponse(result.error.code, result.error.message);
        return successResponse(formatResult(result.value), result.value);
      }
      case "router_status": {
        if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) {
          return errorResponse("INVALID_REQUEST", "request must be an object");
        }
        if (Object.keys(args.input as Record<string, unknown>).length > 0) {
          return errorResponse("INVALID_REQUEST", "router_status accepts no arguments");
        }
        const status = args.service.status();
        return successResponse(JSON.stringify(status, null, 2), status);
      }
      case "router_warm": {
        const result = await args.service.warm(normalizeAdminWithin(args.input));
        if (!result.ok) return errorResponse(result.error.code, result.error.message);
        const payload = { workers: result.value };
        return successResponse(JSON.stringify(payload, null, 2), payload);
      }
      case "router_evict": {
        const result = await args.service.evict(normalizeAdminWithin(args.input));
        if (!result.ok) return errorResponse(result.error.code, result.error.message);
        return successResponse(JSON.stringify(result.value, null, 2), result.value);
      }
    }
  } catch (caught) {
    if (caught instanceof ProtocolValidationError) {
      return errorResponse(
        "INVALID_REQUEST",
        caught.issues
          .map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
          .join("; "),
      );
    }
    return errorResponse(
      "INTERNAL_ERROR",
      caught instanceof Error ? caught.message : String(caught),
    );
  }
}

export const MCP_INPUT_SCHEMAS = {
  find_files: findFilesInputSchema.jsonSchema,
  grep: grepInputSchema.jsonSchema,
  router_status: MCP_TOOLS.find((tool) => tool.name === "router_status")!.inputSchema,
  router_warm: adminWithinJsonSchema,
  router_evict: adminWithinJsonSchema,
} as const;

export const MCP_OUTPUT_SCHEMAS = {
  find_files: findFilesResultJsonSchema,
  grep: grepResultJsonSchema,
  router_status: routerStatusJsonSchema,
  router_warm: warmResultJsonSchema,
  router_evict: evictResultJsonSchema,
} as const;
