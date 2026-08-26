import { mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { FffMcpRuntime } from "./adapters/fff-mcp-stdio";
import type { BackendSearchRequest, SearchBackendAdapter } from "./adapters/types";
import { createRouterService } from "./coordinator";
import { getDefaultRouterConfig } from "./daemon-config";
import { WorkerPool } from "./runtime-manager";
import type { PublicFindFilesRequest, RouterConfig } from "./types";

async function gitFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "fff-router-service-"));
  await mkdir(path.join(root, ".git"));
  await mkdir(path.join(root, "src"));
  return { root, src: path.join(root, "src") };
}

function request(
  within: string,
  overrides: Partial<PublicFindFilesRequest> = {},
): PublicFindFilesRequest {
  return {
    tool: "find_files",
    query: "router",
    within: [within],
    extensions: [],
    excludePaths: [],
    limit: 20,
    cursor: null,
    ...overrides,
  };
}

function harness(args: {
  config?: RouterConfig;
  execute?: SearchBackendAdapter<FffMcpRuntime>["execute"];
}) {
  let starts = 0;
  const closed: string[] = [];
  const requests: BackendSearchRequest[] = [];
  const adapter: SearchBackendAdapter<FffMcpRuntime> = {
    backendId: "fff-mcp",
    async startRuntime() {
      starts += 1;
      const id = `worker-${starts}`;
      return {
        id,
        close: async () => {
          closed.push(id);
        },
        callTool: async () => "",
      };
    },
    execute:
      args.execute ??
      (async ({ request: backendRequest }) => {
        requests.push(backendRequest);
        return {
          ok: true,
          value: {
            backendId: "fff-mcp",
            queryKind: backendRequest.queryKind,
            items: [
              {
                path: path.join(backendRequest.persistenceRoot, "src", "router.ts"),
                relativePath: "src/router.ts",
              },
            ],
            nextCursor: null,
          },
        };
      }),
  };
  const config = args.config ?? getDefaultRouterConfig();
  const workerPool = new WorkerPool<FffMcpRuntime>({
    maxWorkers: config.limits.maxWorkers,
    maxNonGitWorkers: config.limits.maxNonGitWorkers,
    sweepIntervalMs: 60_000,
    restartBackoffMs: 1,
  });
  const service = createRouterService({ configRef: { current: config }, adapter, workerPool });
  return {
    service,
    get starts() {
      return starts;
    },
    requests,
    closed,
  };
}

describe("RouterService", () => {
  test("reuses one warm worker and emits normalized TypeScript-friendly results", async () => {
    const repo = await gitFixture();
    const testHarness = harness({});

    const first = await testHarness.service.execute(request(repo.src));
    const second = await testHarness.service.execute(request(repo.src));

    expect(testHarness.starts).toBe(1);
    expect(first).toMatchObject({
      ok: true,
      value: {
        tool: "find_files",
        root: repo.root,
        backend: "fff-mcp",
        items: [{ path: "src/router.ts", absolutePath: path.join(repo.root, "src/router.ts") }],
        stats: { coldStart: true, workerId: "worker-1", workerGeneration: 1 },
      },
    });
    expect(second).toMatchObject({ ok: true, value: { stats: { coldStart: false } } });
    await testHarness.service.close();
  });

  test("wraps upstream cursors and unwraps them only for the same worker/query", async () => {
    const repo = await gitFixture();
    const seenCursors: Array<string | null> = [];
    const testHarness = harness({
      execute: async ({ request: backendRequest }) => {
        seenCursors.push(backendRequest.cursor);
        return {
          ok: true,
          value: {
            backendId: "fff-mcp",
            queryKind: "find_files",
            items: [],
            nextCursor: backendRequest.cursor ? null : "upstream-2",
            renderedCompact: "0 matches\ncursor: upstream-2",
          },
        };
      },
    });
    const first = await testHarness.service.execute(request(repo.src));
    if (!first.ok) throw new Error(first.error.message);
    expect(first.value.nextCursor).not.toBe("upstream-2");
    expect(first.value.displayText).toContain(`cursor: ${first.value.nextCursor}`);

    const second = await testHarness.service.execute(
      request(repo.src, { cursor: first.value.nextCursor }),
    );
    expect(second.ok).toBe(true);
    expect(seenCursors).toEqual([null, "upstream-2"]);

    const wrongQuery = await testHarness.service.execute(
      request(repo.src, { query: "different", cursor: first.value.nextCursor }),
    );
    expect(wrongQuery).toMatchObject({ ok: false, error: { code: "CURSOR_INVALID" } });
    await testHarness.service.close();
  });

  test("restarts a stale worker once on a first-page call", async () => {
    const repo = await gitFixture();
    let calls = 0;
    const testHarness = harness({
      execute: async () => {
        calls += 1;
        if (calls === 1) {
          return {
            ok: false,
            error: { code: "SEARCH_FAILED", backendId: "fff-mcp", message: "transport closed" },
          };
        }
        return {
          ok: true,
          value: {
            backendId: "fff-mcp",
            queryKind: "find_files",
            items: [],
            nextCursor: null,
          },
        };
      },
    });

    expect(await testHarness.service.execute(request(repo.src))).toMatchObject({ ok: true });
    expect(testHarness.starts).toBe(2);
    expect(calls).toBe(2);
    expect(testHarness.closed).toContain("worker-1");
    await testHarness.service.close();
  });

  test("rejects multiple non-Git paths that route to different roots", async () => {
    const prefix = await mkdtemp(path.join(os.tmpdir(), "fff-router-nongit-"));
    const a = path.join(prefix, "a", "src");
    const b = path.join(prefix, "b", "src");
    await mkdir(a, { recursive: true });
    await mkdir(b, { recursive: true });
    const config = getDefaultRouterConfig();
    config.allowlistedNonGitPrefixes = [{ prefix, mode: "first-child-root" }];
    const testHarness = harness({ config });

    expect(await testHarness.service.execute(request(a, { within: [a, b] }))).toMatchObject({
      ok: false,
      error: { code: "INVALID_REQUEST", message: expect.stringContaining("one routing root") },
    });
    expect(testHarness.starts).toBe(0);
    await testHarness.service.close();
  });

  test("deduplicates warm requests by discovered repository root", async () => {
    const repo = await gitFixture();
    const second = path.join(repo.root, "tests");
    await mkdir(second);
    const testHarness = harness({});
    const warmed = await testHarness.service.warm([repo.src, second]);
    expect(warmed.ok && warmed.value).toHaveLength(1);
    expect(testHarness.starts).toBe(1);
    await testHarness.service.close();
  });
});
