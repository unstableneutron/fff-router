import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createCoordinatorRuntimeConfigRef, type CoordinatorRuntimeConfigRef } from "./coordinator";
import { callPublicToolOverHttp } from "./http-client";
import { getDaemonReloadFingerprint, loadDaemonReloadConfig } from "./daemon-config";
import { startHttpDaemon } from "./http-daemon";
import type { PublicToolRequest, SearchCoordinator, SearchCoordinatorResult } from "./types";

const tempDirs: string[] = [];
const startedDaemons: Array<Awaited<ReturnType<typeof startHttpDaemon>>> = [];

async function makeTempHome(): Promise<string> {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "fff-router-http-daemon-"));
  tempDirs.push(tempHome);
  return tempHome;
}

async function writeConfigFile(args: {
  home: string;
  port: number;
  backend?: "fff-node" | "rg" | "fff-mcp";
  text?: string;
  fileName?: "config.json" | "config.jsonc";
}): Promise<void> {
  const dir = path.join(args.home, ".config", "fff-routerd");
  await mkdir(dir, { recursive: true });
  const content =
    args.text ??
    `{
      "host": "127.0.0.1",
      "port": ${args.port},
      "mcpPath": "/mcp",
      "backend": "${args.backend ?? "fff-node"}"
    }`;
  await writeFile(path.join(dir, args.fileName ?? "config.json"), content);
}

function toCoordinatorRuntimeConfigRef(env: NodeJS.ProcessEnv): CoordinatorRuntimeConfigRef {
  const reloadConfig = loadDaemonReloadConfig({ env });
  return createCoordinatorRuntimeConfigRef({
    config: reloadConfig.router,
    primaryBackendId: reloadConfig.backend.primaryBackendId,
    fallbackBackendId: reloadConfig.backend.fallbackBackendId,
  });
}

function makeCoordinator(liveConfig: CoordinatorRuntimeConfigRef): SearchCoordinator {
  return {
    async execute(request): Promise<SearchCoordinatorResult> {
      if (!request.within) {
        throw new Error("within is required");
      }

      const backendId = liveConfig.current.primaryBackendId;
      const itemPath =
        backendId === "rg" ? `${request.within}/from-rg.ts` : `${request.within}/from-fff-node.ts`;
      return {
        ok: true,
        value: {
          mode: "json",
          base_path: request.within,
          next_cursor: null,
          items: [{ path: itemPath, absolute_path: itemPath }],
          backend_used: backendId,
          fallback_applied: false,
          stats: { result_count: 1 },
        },
      };
    },
  };
}

function makeRequest(within: string): PublicToolRequest {
  return {
    tool: "fff_find_files",
    query: "router",
    within,
    extensions: [],
    excludePaths: [],
    limit: 20,
    cursor: null,
    outputMode: "json",
  };
}

async function waitFor<T>(
  getValue: () => Promise<T>,
  predicate: (value: T) => boolean,
): Promise<T> {
  let lastValue = await getValue();
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate(lastValue)) {
      return lastValue;
    }
    await new Promise((r) => setTimeout(r, 20));
    lastValue = await getValue();
  }
  return lastValue;
}

afterEach(async () => {
  while (startedDaemons.length > 0) {
    await startedDaemons.pop()?.close();
  }
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("startHttpDaemon", () => {
  test("health metadata exposes separate server and reload fingerprints", async () => {
    const home = await makeTempHome();
    const port = 46201;
    await writeConfigFile({ home, port, backend: "fff-node" });
    const env = { HOME: home } as NodeJS.ProcessEnv;

    const daemon = await startHttpDaemon({ env });
    startedDaemons.push(daemon);

    expect(daemon.metadata.serverFingerprint).toBeDefined();
    expect(daemon.metadata.reloadFingerprint).toBeDefined();
    expect(daemon.metadata.reloadFingerprint).toBe(getDaemonReloadFingerprint({ env }));
  });

  test("reload updates metadata and request behavior from config file changes", async () => {
    const home = await makeTempHome();
    const port = 46202;
    await writeConfigFile({ home, port, backend: "fff-node" });
    const env = { HOME: home } as NodeJS.ProcessEnv;
    const liveConfigRef = toCoordinatorRuntimeConfigRef(env);

    const daemon = await startHttpDaemon({
      env,
      createCoordinator: ({ liveConfigRef }) => makeCoordinator(liveConfigRef),
      liveConfigRef,
      watchConfig: false,
    });
    startedDaemons.push(daemon);

    const before = await callPublicToolOverHttp(makeRequest("/repo"), env);
    expect(before.ok).toBe(true);
    if (!before.ok) throw new Error("expected success");
    if (!("backend_used" in before.value)) throw new Error("expected json result");
    expect(before.value.backend_used).toBe("fff-node");

    await writeConfigFile({ home, port, backend: "rg" });
    await daemon.reload();

    const after = await callPublicToolOverHttp(makeRequest("/repo"), env);
    expect(after.ok).toBe(true);
    if (!after.ok) throw new Error("expected success");
    if (!("backend_used" in after.value)) throw new Error("expected json result");
    expect(after.value.backend_used).toBe("rg");
    expect(daemon.metadata.reloadFingerprint).toBe(getDaemonReloadFingerprint({ env }));
  });

  test("watcher reloads when config files change", async () => {
    const home = await makeTempHome();
    const port = 46203;
    await writeConfigFile({ home, port, backend: "fff-node" });
    const env = { HOME: home } as NodeJS.ProcessEnv;
    const liveConfigRef = toCoordinatorRuntimeConfigRef(env);

    const daemon = await startHttpDaemon({
      env,
      createCoordinator: ({ liveConfigRef }) => makeCoordinator(liveConfigRef),
      liveConfigRef,
      watchConfig: true,
    });
    startedDaemons.push(daemon);

    const beforeFingerprint = daemon.metadata.reloadFingerprint;
    await new Promise((resolve) => setTimeout(resolve, 50));
    await writeConfigFile({ home, port, backend: "rg" });

    const updatedMetadata = await waitFor(
      async () => daemon.metadata.reloadFingerprint,
      (fingerprint) => fingerprint !== beforeFingerprint,
    );

    expect(updatedMetadata).toBe(getDaemonReloadFingerprint({ env }));

    const result = await callPublicToolOverHttp(makeRequest("/repo"), env);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    if (!("backend_used" in result.value)) throw new Error("expected json result");
    expect(result.value.backend_used).toBe("rg");
  });

  test("failed reload keeps the last-known-good metadata", async () => {
    const home = await makeTempHome();
    const port = 46204;
    await writeConfigFile({ home, port, backend: "fff-node" });
    const env = { HOME: home } as NodeJS.ProcessEnv;
    const liveConfigRef = toCoordinatorRuntimeConfigRef(env);

    const daemon = await startHttpDaemon({
      env,
      createCoordinator: ({ liveConfigRef }) => makeCoordinator(liveConfigRef),
      liveConfigRef,
      watchConfig: false,
    });
    startedDaemons.push(daemon);

    const beforeFingerprint = daemon.metadata.reloadFingerprint;
    await writeConfigFile({ home, port, text: `{ invalid json` });

    await expect(daemon.reload()).rejects.toThrow();
    expect(daemon.metadata.reloadFingerprint).toBe(beforeFingerprint);
  });
});
