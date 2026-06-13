import { PassThrough } from "node:stream";
import { describe, expect, test, vi } from "vitest";
import { connectMcpSocket, runMcpSocketBridge } from "./mcp-bridge";

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("connectMcpSocket", () => {
  test("ensures the daemon before connecting to the daemon MCP socket", async () => {
    const ensureDaemonRunning = vi.fn(async () => {});
    const socket = new PassThrough();
    const connectSocket = vi.fn(() => {
      queueMicrotask(() => socket.emit("connect"));
      return socket as any;
    });

    const connected = await connectMcpSocket({
      env: { HOME: "/home/test" } as NodeJS.ProcessEnv,
      ensureDaemonRunning,
      connectSocket,
    });

    expect(ensureDaemonRunning.mock.invocationCallOrder[0]).toBeLessThan(
      connectSocket.mock.invocationCallOrder[0]!,
    );
    expect(connectSocket).toHaveBeenCalledWith(
      expect.stringMatching(/^\/tmp\/fff-routerd-[a-f0-9]{16}\.sock$/),
    );
    expect(connected).toBe(socket);
  });

  test("rechecks the daemon and reconnects once after an initial socket failure", async () => {
    const ensureDaemonRunning = vi.fn(async () => {});
    const failedSocket = new PassThrough();
    const connectedSocket = new PassThrough();
    const connectSocket = vi
      .fn()
      .mockImplementationOnce(() => {
        queueMicrotask(() => failedSocket.emit("error", new Error("ECONNREFUSED")));
        return failedSocket as any;
      })
      .mockImplementationOnce(() => {
        queueMicrotask(() => connectedSocket.emit("connect"));
        return connectedSocket as any;
      });

    const connected = await connectMcpSocket({
      env: { HOME: "/home/test" } as NodeJS.ProcessEnv,
      ensureDaemonRunning,
      connectSocket,
    });

    expect(connected).toBe(connectedSocket);
    expect(ensureDaemonRunning).toHaveBeenCalledTimes(2);
    expect(connectSocket).toHaveBeenCalledTimes(2);
  });

  test("reports socket connection failure after the retry is exhausted", async () => {
    const ensureDaemonRunning = vi.fn(async () => {});
    const connectSocket = vi.fn(() => {
      const socket = new PassThrough();
      queueMicrotask(() => socket.emit("error", new Error("ECONNREFUSED")));
      return socket as any;
    });

    await expect(
      connectMcpSocket({
        env: { HOME: "/home/test" } as NodeJS.ProcessEnv,
        ensureDaemonRunning,
        connectSocket,
      }),
    ).rejects.toThrow(/failed to connect to fff-routerd MCP socket/i);
    expect(ensureDaemonRunning).toHaveBeenCalledTimes(2);
    expect(connectSocket).toHaveBeenCalledTimes(2);
  });
});

describe("runMcpSocketBridge", () => {
  test("fails when the daemon MCP socket closes before stdin ends", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const socket = new PassThrough();
    const run = runMcpSocketBridge({
      stdin: input,
      stdout: output,
      ensureDaemonRunning: async () => {},
      connectSocket: () => {
        queueMicrotask(() => socket.emit("connect"));
        return socket as any;
      },
    });

    await tick();
    socket.emit("close");

    await expect(run).rejects.toThrow(/MCP socket closed unexpectedly/i);
  });

  test("exits cleanly when stdin ends and the socket closes", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const socket = new PassThrough();
    const run = runMcpSocketBridge({
      stdin: input,
      stdout: output,
      ensureDaemonRunning: async () => {},
      connectSocket: () => {
        queueMicrotask(() => socket.emit("connect"));
        return socket as any;
      },
    });

    await tick();
    input.end();
    socket.emit("close");

    await expect(run).resolves.toBeUndefined();
  });
});
