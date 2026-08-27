import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startHttpDaemon } from "../dist/lib/fff-router/server.js";

const protocolVersion = "2026-07-28";
const repository = path.resolve(
  process.argv.slice(2).find((entry) => entry !== "--") ?? process.cwd(),
);
const home = await mkdtemp(path.join(os.tmpdir(), "fff-router-live-"));
const env = {
  ...process.env,
  HOME: home,
  XDG_CONFIG_HOME: path.join(home, "config"),
  XDG_STATE_HOME: path.join(home, "state"),
};

let daemon;
try {
  daemon = await startHttpDaemon({ env, port: 0, watchConfig: false });
  const token = (await readFile(daemon.paths.authTokenPath, "utf8")).trim();
  let requestId = 0;
  const call = async (name, argumentsValue) => {
    const response = await fetch(daemon.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": protocolVersion,
        "mcp-method": "tools/call",
        "mcp-name": name,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++requestId,
        method: "tools/call",
        params: {
          name,
          arguments: argumentsValue,
          _meta: {
            "io.modelcontextprotocol/protocolVersion": protocolVersion,
            "io.modelcontextprotocol/clientInfo": { name: "fff-live-smoke", version: "1" },
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error || payload.result?.isError) {
      throw new Error(JSON.stringify(payload));
    }
    return payload.result.structuredContent;
  };

  const warmed = await call("router_warm", { within: repository });
  const found = await call("find_files", { query: "router", within: repository, limit: 3 });
  const grep = await call("grep", {
    patterns: ["createRouterService"],
    literal: true,
    within: repository,
    limit: 3,
  });
  const status = await call("router_status", {});
  const generations = new Set([
    found.stats.workerGeneration,
    grep.stats.workerGeneration,
    ...warmed.workers.map((worker) => worker.generation),
  ]);
  if (generations.size !== 1) throw new Error("live calls did not reuse one worker generation");
  process.stdout.write(
    `${JSON.stringify({
      workerGeneration: found.stats.workerGeneration,
      findResults: found.items.length,
      grepResults: grep.items.length,
      resources: status.resources,
    })}\n`,
  );
} finally {
  await daemon?.close().catch(() => {});
  await rm(home, { recursive: true, force: true });
}
