import { createConnection, type Socket } from "node:net";
import { type Readable, type Writable } from "node:stream";
import { ensureDaemonRunning as defaultEnsureDaemonRunning } from "./daemon-autostart";
import { getDaemonPaths } from "./daemon-config";

export type McpSocketBridgeOptions = {
  env?: NodeJS.ProcessEnv;
  stdin?: Readable;
  stdout?: Writable;
  ensureDaemonRunning?: () => Promise<void>;
  connectSocket?: (socketPath: string) => Socket;
};

function waitForSocketConnect(socket: Socket): Promise<void> {
  if (socket.readyState === "open") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      socket.off("connect", onConnect);
      socket.off("error", onError);
    };
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    socket.once("connect", onConnect);
    socket.once("error", onError);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function openMcpSocket(
  socketPath: string,
  connectSocket: (socketPath: string) => Socket,
): Promise<Socket> {
  const socket = connectSocket(socketPath);
  try {
    await waitForSocketConnect(socket);
    return socket;
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

export async function connectMcpSocket(options: McpSocketBridgeOptions = {}): Promise<Socket> {
  const env = options.env ?? process.env;
  const ensureDaemonRunning = options.ensureDaemonRunning ?? defaultEnsureDaemonRunning;
  const connectSocket = options.connectSocket ?? createConnection;
  const socketPath = getDaemonPaths({ env }).mcpSocketPath;

  let lastError: unknown;
  for (const _attempt of [0, 1]) {
    await ensureDaemonRunning();
    try {
      return await openMcpSocket(socketPath, connectSocket);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `failed to connect to fff-routerd MCP socket at ${socketPath}: ${errorMessage(lastError)}`,
  );
}

export async function runMcpSocketBridge(options: McpSocketBridgeOptions = {}): Promise<void> {
  const socket = await connectMcpSocket(options);
  const input = options.stdin ?? process.stdin;
  const output = options.stdout ?? process.stdout;
  let inputEnded = false;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      input.off("end", onInputEnd);
      input.off("close", onInputEnd);
      input.off("error", onInputError);
      output.off("error", onOutputError);
      socket.off("close", onSocketClose);
      socket.off("error", onSocketError);
      input.unpipe(socket);
      socket.unpipe(output);
    };
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      socket.destroy();
      reject(error);
    };
    const onInputEnd = () => {
      inputEnded = true;
      socket.end();
    };
    const onSocketClose = () => {
      setTimeout(() => {
        if (inputEnded || input.readableEnded || input.destroyed) {
          finish();
          return;
        }
        fail(new Error("MCP socket closed unexpectedly before stdin ended"));
      }, 0);
    };
    const onSocketError = (error: Error) => {
      fail(error);
    };
    const onInputError = (error: Error) => {
      fail(error);
    };
    const onOutputError = (error: Error) => {
      fail(error);
    };

    input.once("end", onInputEnd);
    input.once("close", onInputEnd);
    input.once("error", onInputError);
    output.once("error", onOutputError);
    socket.once("close", onSocketClose);
    socket.once("error", onSocketError);
    input.pipe(socket);
    socket.pipe(output, { end: false });
  });
}
