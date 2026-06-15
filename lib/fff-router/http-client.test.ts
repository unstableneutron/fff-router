import { describe, expect, test } from "vitest";
import { unwrapToolResponse } from "./http-client";

describe("unwrapToolResponse", () => {
  test("unwraps compact passthrough text results", () => {
    const result = unwrapToolResponse({
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            mode: "compact",
            base_path: "/repo/src",
            next_cursor: null,
            text: "→ Read src/router.ts (only match)",
          }),
        },
      ],
    });

    expect(result).toEqual({
      ok: true,
      value: {
        mode: "compact",
        base_path: "/repo/src",
        next_cursor: null,
        text: "→ Read src/router.ts (only match)",
      },
    });
  });

  test("surfaces non-JSON MCP error text without throwing", () => {
    const result = unwrapToolResponse({
      isError: true,
      content: [
        {
          type: "text",
          text: "MCP error -32602: Invalid arguments for tool fff_find_files",
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "MCP error -32602: Invalid arguments for tool fff_find_files",
      },
    });
  });
});
