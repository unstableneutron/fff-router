import { describe, expect, test, vi } from "vitest";
import { runMcpHttpBridge } from "./mcp-bridge";

describe("HTTP-backed stdio MCP bridge", () => {
  test("forwards MCP calls to one authenticated daemon client", async () => {
    const callMcpTool = vi.fn(async () => ({
      isError: false,
      content: [{ type: "text", text: "result" }],
      structuredContent: { tool: "find_files", items: [] },
    }));
    const close = vi.fn(async () => {});
    let closeBridge: (() => void) | undefined;

    await runMcpHttpBridge({
      connectClient: async () => ({ callMcpTool, close }),
      connectStdio: async (handler, onClose) => {
        closeBridge = onClose;
        expect(await handler("find_files", { query: "router", within: ["/repo"] })).toMatchObject({
          structuredContent: { tool: "find_files" },
        });
      },
    });

    expect(callMcpTool).toHaveBeenCalledWith("find_files", {
      query: "router",
      within: ["/repo"],
    });
    closeBridge?.();
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
  });

  test("closes the daemon client when stdio setup fails", async () => {
    const close = vi.fn(async () => {});
    await expect(
      runMcpHttpBridge({
        connectClient: async () => ({
          callMcpTool: vi.fn(),
          close,
        }),
        connectStdio: async () => {
          throw new Error("stdio unavailable");
        },
      }),
    ).rejects.toThrow("stdio unavailable");
    expect(close).toHaveBeenCalledOnce();
  });
});
