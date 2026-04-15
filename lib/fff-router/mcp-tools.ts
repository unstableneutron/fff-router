import * as z from "zod/v4";
import { normalizePublicToolInput, PUBLIC_TOOL_DEFINITIONS } from "./public-api";
import type { PublicToolName, SearchCoordinator } from "./types";

const zodInputShapes = {
  fff_find_files: {
    query: z.string().min(1),
    within: z.string().optional(),
    extensions: z.array(z.string().min(1)).optional(),
    exclude_paths: z.array(z.string().min(1)).optional(),
    limit: z.number().int().min(0).optional(),
    cursor: z.null().optional(),
    output_mode: z.enum(["compact", "json"]).optional(),
  },
  fff_search_terms: {
    terms: z.array(z.string().min(1)).min(1),
    within: z.string().optional(),
    extensions: z.array(z.string().min(1)).optional(),
    exclude_paths: z.array(z.string().min(1)).optional(),
    context_lines: z.number().int().min(0).optional(),
    limit: z.number().int().min(0).optional(),
    cursor: z.null().optional(),
    output_mode: z.enum(["compact", "json"]).optional(),
  },
  fff_grep: {
    patterns: z.array(z.string().min(1)).min(1),
    within: z.string().optional(),
    glob: z.string().optional(),
    case_sensitive: z.boolean().optional(),
    extensions: z.array(z.string().min(1)).optional(),
    exclude_paths: z.array(z.string().min(1)).optional(),
    context_lines: z.number().int().min(0).optional(),
    limit: z.number().int().min(0).optional(),
    cursor: z.null().optional(),
    output_mode: z.enum(["compact", "json"]).optional(),
  },
} as const satisfies Record<PublicToolName, z.ZodRawShape>;

export const MCP_TOOLS = PUBLIC_TOOL_DEFINITIONS.map((tool) => ({
  ...tool,
  zodInputShape: zodInputShapes[tool.name],
}));

export function listMcpTools() {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    snippet: tool.snippet,
  }));
}

export async function executeMcpTool(args: {
  coordinator: SearchCoordinator;
  name: PublicToolName;
  input: unknown;
}) {
  const normalized = normalizePublicToolInput(args.name, args.input);
  if (!normalized.ok) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              ok: false,
              code: normalized.error.code,
              message: normalized.error.message,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  const result = await args.coordinator.execute(normalized.value);
  if (!result.ok) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              ok: false,
              code: result.error.code,
              message: result.error.message,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  return {
    isError: false,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result.value, null, 2),
      },
    ],
  };
}
