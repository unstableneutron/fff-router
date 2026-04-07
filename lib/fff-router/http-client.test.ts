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
});
