import path from "node:path";
import * as z from "zod/v4";
import {
  findFilesInputSchema,
  grepInputSchema,
  normalizePublicToolInput,
  PUBLIC_TOOL_DEFINITIONS,
} from "./public-api";
import type { PublicToolName, PublicToolResult, RouterService } from "./types";

export type RouterMcpToolName = PublicToolName | "router_status" | "router_warm" | "router_evict";

const absoluteWithin = z
  .string()
  .min(1)
  .refine((value) => path.isAbsolute(value), "within paths must be absolute");

const adminWithinSchema = z.strictObject({
  within: z.union([absoluteWithin, z.array(absoluteWithin).min(1).max(32)]),
});

export const MCP_TOOLS = [
  ...PUBLIC_TOOL_DEFINITIONS,
  {
    name: "router_status" as const,
    description: "Show the shared fff-routerd worker pool and health state.",
    inputSchema: z.strictObject({}),
  },
  {
    name: "router_warm" as const,
    description: "Start and retain warm fff-mcp workers for one or more absolute paths.",
    inputSchema: adminWithinSchema,
  },
  {
    name: "router_evict" as const,
    description: "Drain and remove fff-mcp workers for one or more absolute paths.",
    inputSchema: adminWithinSchema,
  },
] as const;

function formatResult(result: PublicToolResult): string {
  if (result.displayText) {
    return result.displayText;
  }
  if (result.tool === "find_files") {
    return result.items.length > 0
      ? result.items.map((item) => item.path).join("\n")
      : "0 results.";
  }
  return result.items.length > 0
    ? result.items.map((item) => `${item.path}\n  ${item.line}: ${item.text}`).join("\n--\n")
    : "0 matches.";
}

function errorResponse(code: string, message: string) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ ok: false, code, message }),
      },
    ],
  };
}

function successResponse(text: string, structuredContent: Record<string, unknown>) {
  return {
    isError: false,
    content: [{ type: "text" as const, text }],
    structuredContent,
  };
}

function normalizeAdminWithin(input: unknown): string[] {
  const parsed = adminWithinSchema.parse(input);
  const values = Array.isArray(parsed.within) ? parsed.within : [parsed.within];
  return values.map((value) => path.normalize(value));
}

export function listMcpTools() {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.inputSchema),
  }));
}

export async function executeMcpTool(args: {
  service: RouterService;
  name: RouterMcpToolName;
  input: unknown;
  env?: NodeJS.ProcessEnv;
}) {
  try {
    switch (args.name) {
      case "find_files":
      case "grep": {
        const normalized = normalizePublicToolInput(args.name, args.input, args.env);
        if (!normalized.ok) {
          return errorResponse(normalized.error.code, normalized.error.message);
        }
        const result = await args.service.execute(normalized.value);
        if (!result.ok) {
          return errorResponse(result.error.code, result.error.message);
        }
        return successResponse(
          formatResult(result.value),
          result.value as unknown as Record<string, unknown>,
        );
      }
      case "router_status": {
        const status = args.service.status();
        return successResponse(
          JSON.stringify(status, null, 2),
          status as unknown as Record<string, unknown>,
        );
      }
      case "router_warm": {
        const result = await args.service.warm(normalizeAdminWithin(args.input));
        if (!result.ok) {
          return errorResponse(result.error.code, result.error.message);
        }
        const payload = { workers: result.value };
        return successResponse(
          JSON.stringify(payload, null, 2),
          payload as unknown as Record<string, unknown>,
        );
      }
      case "router_evict": {
        const result = await args.service.evict(normalizeAdminWithin(args.input));
        if (!result.ok) {
          return errorResponse(result.error.code, result.error.message);
        }
        return successResponse(
          JSON.stringify(result.value, null, 2),
          result.value as unknown as Record<string, unknown>,
        );
      }
    }
  } catch (caught) {
    if (caught instanceof z.ZodError) {
      return errorResponse(
        "INVALID_REQUEST",
        caught.issues.map((issue) => issue.message).join("; "),
      );
    }
    return errorResponse(
      "INTERNAL_ERROR",
      caught instanceof Error ? caught.message : String(caught),
    );
  }
}

export const MCP_INPUT_SCHEMAS = {
  find_files: findFilesInputSchema,
  grep: grepInputSchema,
  router_status: z.strictObject({}),
  router_warm: adminWithinSchema,
  router_evict: adminWithinSchema,
} as const;
