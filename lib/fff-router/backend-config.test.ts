import { describe, expect, test } from "vitest";
import { getDefaultFallbackBackend, parseBackend } from "./backend-config";

describe("backend config helpers", () => {
  test("parses supported backend names", () => {
    expect(parseBackend("fff-node")).toBe("fff-node");
    expect(parseBackend("fff-mcp")).toBe("fff-mcp");
    expect(parseBackend("rg")).toBe("rg");
    expect(parseBackend(undefined)).toBe("fff-node");
  });

  test("maps fff-mcp to rg fallback and rg to no fallback", () => {
    expect(getDefaultFallbackBackend("fff-node")).toBe("rg");
    expect(getDefaultFallbackBackend("fff-mcp")).toBe("rg");
    expect(getDefaultFallbackBackend("rg")).toBeNull();
  });

  test("rejects invalid backend names", () => {
    expect(() => parseBackend("nope")).toThrow(/invalid backend/i);
  });
});
