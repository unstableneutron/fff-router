import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  createFffMcpStdioAdapter,
  filterRenderedCompactText,
  waitForFffMcpReady,
} from "./fff-mcp-stdio";
import type {
  BackendResultItem,
  BackendTextMatch,
  FindFilesBackendRequest,
  GrepBackendRequest,
  SearchTermsBackendRequest,
} from "./types";

function expectTextMatches(items: BackendResultItem[]): BackendTextMatch[] {
  expect(
    items.every(
      (item) =>
        typeof (item as { line?: unknown }).line === "number" &&
        typeof (item as { text?: unknown }).text === "string",
    ),
  ).toBe(true);
  return items as BackendTextMatch[];
}

const findFilesRequest: FindFilesBackendRequest = {
  backendId: "fff-mcp",
  persistenceRoot: "/repo",
  queryKind: "find_files",
  within: "/repo/lib",
  basePath: "/repo/lib",
  glob: "**/*.ts",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 5,
  cursor: null,
  query: "router",
};

const searchTermsRequest: SearchTermsBackendRequest = {
  backendId: "fff-mcp",
  persistenceRoot: "/repo",
  queryKind: "search_terms",
  within: "/repo/lib",
  basePath: "/repo/lib",
  glob: "**/*.ts",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 5,
  cursor: null,
  terms: ["createSearchCoordinator"],
  contextLines: 1,
};

const grepRequest: GrepBackendRequest = {
  backendId: "fff-mcp",
  persistenceRoot: "/repo",
  queryKind: "grep",
  within: "/repo/lib",
  basePath: "/repo/lib",
  glob: "**/*.ts",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 5,
  cursor: null,
  patterns: ["createSearchCoordinator", "buildSearchCoordinator"],
  literal: false,
  caseSensitive: true,
  contextLines: 1,
};

describe("waitForFffMcpReady", () => {
  test("polls until stock fff-mcp reports a non-zero indexed corpus", async () => {
    const callTool = async (_name: string, _args: Record<string, unknown>) => {
      responses += 1;
      return responses === 1 ? "0 results (0 indexed)" : "lib/fff-router/coordinator.ts git:clean";
    };
    let responses = 0;

    await waitForFffMcpReady(callTool, { delay: async () => {} });

    expect(responses).toBe(2);
  });

  test("keeps polling across a slow cold-index until it finishes", async () => {
    // Simulate a large monorepo whose first ten probes still show
    // `(0 indexed)` before the corpus finishes warming up. The old
    // six-probe schedule would have bailed out here; the deadline-driven
    // loop should keep going until either the corpus is ready or the
    // budget runs out.
    let probes = 0;
    const callTool = async () => {
      probes += 1;
      if (probes <= 10) {
        return "0 results (0 indexed)";
      }
      return "lib/fff-router/coordinator.ts git:clean";
    };

    await waitForFffMcpReady(callTool, {
      delay: async () => {},
      now: (() => {
        // Monotonic fake clock that advances by 1ms per read, well under
        // the default deadline, so the timeout branch stays inactive.
        let t = 0;
        return () => ++t;
      })(),
    });

    expect(probes).toBe(11);
  });

  test("throws with context when the deadline elapses before fff-mcp reports progress", async () => {
    const callTool = async () => "0 results (0 indexed)";
    let t = 0;
    const now = () => {
      // Advance 10ms per probe so a 30ms deadline accepts ~3 probes
      // before the timeout branch fires.
      t += 10;
      return t;
    };

    await expect(
      waitForFffMcpReady(callTool, {
        deadlineMs: 30,
        delay: async () => {},
        now,
      }),
    ).rejects.toThrow(/did not finish indexing within.*last probe reported 0 indexed/);
  });

  test("honours an explicit deadlineMs over the env default", async () => {
    // Env var would normally expand the deadline; an explicit option
    // must still take precedence so callers can opt into a tight budget.
    const previous = process.env.FFF_ROUTER_FFF_MCP_READY_TIMEOUT_MS;
    process.env.FFF_ROUTER_FFF_MCP_READY_TIMEOUT_MS = "600000";
    try {
      const callTool = async () => "0 results (0 indexed)";
      let t = 0;
      const now = () => {
        t += 50;
        return t;
      };

      await expect(
        waitForFffMcpReady(callTool, {
          deadlineMs: 10,
          delay: async () => {},
          now,
        }),
      ).rejects.toThrow(/did not finish indexing/);
    } finally {
      if (previous === undefined) {
        delete process.env.FFF_ROUTER_FFF_MCP_READY_TIMEOUT_MS;
      } else {
        process.env.FFF_ROUTER_FFF_MCP_READY_TIMEOUT_MS = previous;
      }
    }
  });
});

describe("createFffMcpStdioAdapter", () => {
  test("reports non-executable fff-mcp override before spawning", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "fff-router-fff-mcp-nonexec-"));
    const binaryPath = path.join(dir, "fff-mcp");
    await writeFile(binaryPath, "#!/bin/sh\nexit 0\n", { mode: 0o644 });
    const previous = process.env.FFF_ROUTER_FFF_MCP_BIN;
    process.env.FFF_ROUTER_FFF_MCP_BIN = binaryPath;
    try {
      const adapter = createFffMcpStdioAdapter();

      await expect(
        adapter.startRuntime?.({ backendId: "fff-mcp", persistenceRoot: "/repo" }),
      ).rejects.toThrow(/FFF_ROUTER_FFF_MCP_BIN/);
    } finally {
      if (previous === undefined) {
        delete process.env.FFF_ROUTER_FFF_MCP_BIN;
      } else {
        process.env.FFF_ROUTER_FFF_MCP_BIN = previous;
      }
    }
  });

  test("maps find_files requests onto stock fff-mcp and parses file results", async () => {
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const adapter = createFffMcpStdioAdapter();

    const result = await adapter.execute({
      request: findFilesRequest,
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          return "lib/fff-router/coordinator.test.ts git:clean\nlib/fff-router/coordinator.ts git:clean";
        },
      },
    });

    expect(calls).toEqual([
      {
        name: "find_files",
        arguments: {
          query: "router lib/ **/*.ts *.ts !dist/",
          maxResults: 5,
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([
      {
        path: "/repo/lib/fff-router/coordinator.test.ts",
        relativePath: "lib/fff-router/coordinator.test.ts",
      },
      {
        path: "/repo/lib/fff-router/coordinator.ts",
        relativePath: "lib/fff-router/coordinator.ts",
      },
    ]);
  });

  test("forwards find_files cursors and preserves native compact output", async () => {
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const adapter = createFffMcpStdioAdapter();

    const text = [
      "→ Read lib/fff-router/coordinator.ts (best match)",
      "5/13 matches",
      "lib/fff-router/coordinator.test.ts git:clean",
      "lib/fff-router/coordinator.ts git:clean",
      "cursor: 8",
    ].join("\n");

    const result = await adapter.execute({
      request: { ...findFilesRequest, cursor: "7" },
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          return text;
        },
      },
    });

    expect(calls).toEqual([
      {
        name: "find_files",
        arguments: {
          query: "router lib/ **/*.ts *.ts !dist/",
          maxResults: 5,
          cursor: "7",
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.nextCursor).toBe("8");
    expect((result.value as { renderedCompact?: string }).renderedCompact).toBe(text);
    expect((result.value as { summary?: unknown }).summary).toEqual({
      shownCount: 5,
      totalCount: 13,
      readRecommendation: {
        relativePath: "lib/fff-router/coordinator.ts",
        reason: "best match",
      },
    });
  });

  test("applies router-side filtering to parsed stock fff-mcp results", async () => {
    const adapter = createFffMcpStdioAdapter();

    const result = await adapter.execute({
      request: {
        ...findFilesRequest,
        limit: 1,
      },
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async () =>
          ["lib/fff-router/coordinator.test.ts git:clean", "outside/escape.ts git:clean"].join(
            "\n",
          ),
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([
      {
        path: "/repo/lib/fff-router/coordinator.test.ts",
        relativePath: "lib/fff-router/coordinator.test.ts",
      },
    ]);
  });

  test("narrows find_files renderedCompact when fff-mcp leaks paths outside scope", async () => {
    const adapter = createFffMcpStdioAdapter();
    const text = [
      "→ Read outside/escape.ts (best match)",
      "2/2 matches",
      "lib/fff-router/coordinator.test.ts git:clean",
      "outside/escape.ts git:clean",
      "cursor: 2",
    ].join("\n");

    const result = await adapter.execute({
      request: findFilesRequest,
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async () => text,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    const rendered = (result.value as { renderedCompact?: string }).renderedCompact ?? "";
    expect(rendered).toContain("lib/fff-router/coordinator.test.ts git:clean");
    expect(rendered).toContain("cursor: 2");
    expect(rendered).not.toContain("outside/escape.ts");
    expect(rendered).not.toMatch(/^→\s+Read\s+outside\//m);
  });

  test("maps multi_grep requests, preserves compact passthrough, and parses content output with context", async () => {
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const adapter = createFffMcpStdioAdapter();

    const text = [
      "→ Read lib/fff-router/coordinator.test.ts (only match)",
      "1/1 matches shown",
      "lib/fff-router/coordinator.test.ts [def]",
      ' 9: import { createSearchCoordinator } from "./coordinator";',
      ' 10| import { RuntimeManager } from "./runtime-manager";',
      ' 11| import type { PublicToolRequest } from "./types";',
      "cursor: fff_c2",
      "--",
    ].join("\n");

    const result = await adapter.execute({
      request: { ...searchTermsRequest, cursor: "fff_c1" },
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          return text;
        },
      },
    });

    expect(calls).toEqual([
      {
        name: "multi_grep",
        arguments: {
          patterns: ["createSearchCoordinator"],
          constraints: "lib/ **/*.ts *.ts !dist/",
          maxResults: 5,
          context: 1,
          cursor: "fff_c1",
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.nextCursor).toBe("fff_c2");
    expect((result.value as any).renderedCompact).toBe(text);
    expect((result.value as any).summary).toEqual({
      shownCount: 1,
      totalCount: 1,
      readRecommendation: {
        relativePath: "lib/fff-router/coordinator.test.ts",
        reason: "only match",
      },
    });
    expect(result.value.items).toEqual([
      {
        path: "/repo/lib/fff-router/coordinator.test.ts",
        relativePath: "lib/fff-router/coordinator.test.ts",
        line: 9,
        text: 'import { createSearchCoordinator } from "./coordinator";',
        isDefinition: true,
        definitionBody: [
          'import { RuntimeManager } from "./runtime-manager";',
          'import type { PublicToolRequest } from "./types";',
        ],
      },
    ]);
  });

  test("maps grep requests, preserves compact passthrough, and parses line metadata", async () => {
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const adapter = createFffMcpStdioAdapter();

    const text = [
      "→ Read lib/fff-router/coordinator.test.ts (only match)",
      "5/13 matches shown",
      "lib/fff-router/coordinator.test.ts [def]",
      ' 84: describe("createSearchCoordinator", () => {',
      " 85| const config: RouterConfig = {",
      " 86| };",
      "lib/fff-router/coordinator.test.ts",
      " 96: const coordinator = createSearchCoordinator({",
      "cursor: fff_c4",
    ].join("\n");

    const result = await adapter.execute({
      request: { ...grepRequest, cursor: "fff_c3" },
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          return text;
        },
      },
    });

    expect(calls).toEqual([
      {
        name: "grep",
        arguments: {
          query: "lib/ **/*.ts *.ts !dist/ (?:createSearchCoordinator)|(?:buildSearchCoordinator)",
          maxResults: 5,
          cursor: "fff_c3",
        },
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.nextCursor).toBe("fff_c4");
    expect((result.value as any).renderedCompact).toBe(text);
    expect((result.value as any).summary).toEqual({
      shownCount: 5,
      totalCount: 13,
      readRecommendation: {
        relativePath: "lib/fff-router/coordinator.test.ts",
        reason: "only match",
      },
    });
    expect(result.value.items).toEqual([
      {
        path: "/repo/lib/fff-router/coordinator.test.ts",
        relativePath: "lib/fff-router/coordinator.test.ts",
        line: 84,
        text: 'describe("createSearchCoordinator", () => {',
        isDefinition: true,
        definitionBody: ["const config: RouterConfig = {", "};"],
      },
      {
        path: "/repo/lib/fff-router/coordinator.test.ts",
        relativePath: "lib/fff-router/coordinator.test.ts",
        line: 96,
        text: "const coordinator = createSearchCoordinator({",
      },
    ]);
  });

  test("strips [def] suffix from read recommendations", async () => {
    const adapter = createFffMcpStdioAdapter();

    const result = await adapter.execute({
      request: searchTermsRequest,
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async () =>
          [
            "→ Read lib/fff-router/coordinator.ts [def]",
            "8/28 matches shown",
            "lib/fff-router/coordinator.ts",
            " 596: export function createSearchCoordinator(deps: CoordinatorDeps): SearchCoordinator {",
          ].join("\n"),
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect((result.value as any).summary).toEqual({
      shownCount: 8,
      totalCount: 28,
      readRecommendation: {
        relativePath: "lib/fff-router/coordinator.ts",
      },
    });
  });
});

describe("createFffMcpStdioAdapter grep literal routing", () => {
  const literalGrepRequest: GrepBackendRequest = {
    backendId: "fff-mcp",
    persistenceRoot: "/repo",
    queryKind: "grep",
    within: "/repo/lib",
    basePath: "/repo/lib",
    glob: "**/*.ts",
    extensions: ["ts"],
    excludePaths: ["dist"],
    limit: 5,
    patterns: ['provider: "anthropic"'],
    literal: true,
    caseSensitive: true,
    contextLines: 1,
  };

  test("routes literal=true grep to multi_grep with patterns intact", async () => {
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const adapter = createFffMcpStdioAdapter();

    await adapter.execute({
      request: literalGrepRequest,
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          return "0 matches.";
        },
      },
    });

    expect(calls).toEqual([
      {
        name: "multi_grep",
        arguments: {
          patterns: ['provider: "anthropic"'],
          constraints: "lib/ **/*.ts *.ts !dist/",
          maxResults: 5,
          context: 1,
        },
      },
    ]);
  });

  test("routes literal=false grep to grep with whitespace-encoded pattern", async () => {
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const adapter = createFffMcpStdioAdapter();

    await adapter.execute({
      request: { ...literalGrepRequest, literal: false },
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          return "0 matches.";
        },
      },
    });

    expect(calls).toEqual([
      {
        name: "grep",
        arguments: {
          // Literal whitespace in the pattern is encoded as `\s` so fff-mcp's
          // space-delimited DSL doesn't treat it as an extra constraint.
          query: 'lib/ **/*.ts *.ts !dist/ provider:\\s"anthropic"',
          maxResults: 5,
        },
      },
    ]);
  });

  test("encodes whitespace in every alternation branch for multi-pattern regex", async () => {
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const adapter = createFffMcpStdioAdapter();

    await adapter.execute({
      request: {
        ...literalGrepRequest,
        literal: false,
        patterns: ["foo bar", "baz\tqux"],
      },
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          return "0 matches.";
        },
      },
    });

    expect(calls[0]?.arguments.query).toBe("lib/ **/*.ts *.ts !dist/ (?:foo\\sbar)|(?:baz\\squx)");
  });

  test("anchors exact relative-file glob hints for fff-mcp", async () => {
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const adapter = createFffMcpStdioAdapter();

    await adapter.execute({
      request: {
        ...literalGrepRequest,
        within: "/repo",
        basePath: "/repo",
        glob: "sdk/cliproxy/service.go",
        extensions: [],
        excludePaths: [],
        patterns: ["UsageStatisticsEnabled"],
      },
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          return "0 matches.";
        },
      },
    });

    expect(calls[0]?.arguments.constraints).toBe("**/sdk/cliproxy/service.go");
  });
});

describe("createFffMcpStdioAdapter fileRestriction + rendered compact", () => {
  const fileRestrictedGrep: GrepBackendRequest = {
    backendId: "fff-mcp",
    persistenceRoot: "/repo",
    queryKind: "grep",
    within: "/repo/internal/adapter/treehouse/treehouse_test.go",
    basePath: "/repo/internal/adapter/treehouse",
    fileRestriction: "/repo/internal/adapter/treehouse/treehouse_test.go",
    extensions: [],
    excludePaths: [],
    limit: 50,
    patterns: ["2026-"],
    literal: true,
    caseSensitive: true,
    contextLines: 1,
  };

  const fileRestrictedSearchTerms: SearchTermsBackendRequest = {
    backendId: "fff-mcp",
    persistenceRoot: "/repo",
    queryKind: "search_terms",
    within: "/repo/internal/adapter/treehouse/treehouse_test.go",
    basePath: "/repo/internal/adapter/treehouse",
    fileRestriction: "/repo/internal/adapter/treehouse/treehouse_test.go",
    extensions: [],
    excludePaths: [],
    limit: 50,
    terms: ["2026-"],
    contextLines: 1,
  };

  // fff-mcp fuzzy-matches a bare relative-path constraint against its filename
  // index, so it can return hits in unrelated files. This synthetic response
  // mirrors the real fuzzy-leak we observed in the jj-bonsai repo: two
  // sibling paths plus the restricted one, interleaved with context and a
  // read recommendation that points at a filtered-out file.
  const fuzzyLeakText = [
    "→ Read internal/adapter/treehouse/assets/manifest.json (best match)",
    "7/7 matches shown",
    "internal/adapter/treehouse/assets/manifest.json",
    ' 2- "adapter": "treehouse",',
    ' 3: "version": "2026-04-21",',
    ' 4- "files": [',
    "--",
    "internal/adapter/treehouse/treehouse_test.go",
    " 116- newerRepoContent := []byte(strings.ReplaceAll(",
    ' 117: string(assets[0].Content), "2026-04-16", "2026-04-20"))',
    " 118- if err != nil {",
    "internal/core/seeds_test.go",
    ' 117: "# jj-bonsai-version: 2026-04-17\\n" +',
  ].join("\n");

  test("uses anchored-glob constraint token for fileRestriction", async () => {
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
    const adapter = createFffMcpStdioAdapter();

    await adapter.execute({
      request: fileRestrictedGrep,
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          return "0 matches.";
        },
      },
    });

    // `**/<relativeFile>` is the only fff-mcp constraint form that actually
    // pins a match to a single file — verified by probing fff-mcp directly.
    // A bare `<relativeFile>` token would fuzzy-match against siblings.
    expect(calls[0]?.arguments.constraints).toBe("**/internal/adapter/treehouse/treehouse_test.go");
  });

  test("narrows grep items and renderedCompact when fff-mcp leaks sibling matches", async () => {
    const adapter = createFffMcpStdioAdapter();

    const result = await adapter.execute({
      request: fileRestrictedGrep,
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async () => fuzzyLeakText,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");

    // Items agree with the restriction.
    expect(result.value.items.map((item) => item.relativePath)).toEqual([
      "internal/adapter/treehouse/treehouse_test.go",
    ]);

    // renderedCompact no longer surfaces sibling paths.
    const rendered = (result.value as { renderedCompact?: string }).renderedCompact ?? "";
    expect(rendered).not.toContain("assets/manifest.json");
    expect(rendered).not.toContain("internal/core/seeds_test.go");
    expect(rendered).toContain("internal/adapter/treehouse/treehouse_test.go");
    // And the read recommendation — which pointed at a filtered-out path —
    // was dropped instead of misleading the caller.
    expect(rendered).not.toMatch(/^→\s+Read\s+internal\/adapter\/treehouse\/assets\//m);
    expect(result.value.summary?.readRecommendation).toBeUndefined();
    // The summary counts are left as fff-mcp reported them; recomputing them
    // would be speculative since fff-mcp's total pre-dates our post-filter.
    expect(result.value.summary?.shownCount).toBe(7);
    expect(result.value.summary?.totalCount).toBe(7);
  });

  test("narrows search_terms items and renderedCompact identically", async () => {
    const adapter = createFffMcpStdioAdapter();

    const result = await adapter.execute({
      request: fileRestrictedSearchTerms,
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async () => fuzzyLeakText,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");

    expect(result.value.items.map((item) => item.relativePath)).toEqual([
      "internal/adapter/treehouse/treehouse_test.go",
    ]);
    const rendered = (result.value as { renderedCompact?: string }).renderedCompact ?? "";
    expect(rendered).not.toContain("assets/manifest.json");
    expect(rendered).not.toContain("internal/core/seeds_test.go");
  });

  test("passes renderedCompact through verbatim when nothing is filtered out", async () => {
    const adapter = createFffMcpStdioAdapter();
    const cleanText = [
      "→ Read internal/adapter/treehouse/treehouse_test.go (only match)",
      "1/1 matches shown",
      "internal/adapter/treehouse/treehouse_test.go",
      " 116- newerRepoContent := []byte(strings.ReplaceAll(",
      ' 117: string(assets[0].Content), "2026-04-16", "2026-04-20"))',
    ].join("\n");

    const result = await adapter.execute({
      request: fileRestrictedGrep,
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async () => cleanText,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    // No path was dropped, so the adapter must return the backend's text
    // byte-for-byte — this is the common case and preserves fff-mcp's exact
    // formatting.
    expect((result.value as { renderedCompact?: string }).renderedCompact).toBe(cleanText);
  });

  test("renderedCompact also respects glob and excludePaths mismatches", async () => {
    const adapter = createFffMcpStdioAdapter();
    // Directory-scoped request that excludes `assets/**` and restricts to
    // `.go` extensions. fff-mcp's fuzzy filter can still leak `.json` hits
    // from `assets/`, so we want the rendered text to match the items view
    // for all filter criteria, not just fileRestriction.
    const request: SearchTermsBackendRequest = {
      backendId: "fff-mcp",
      persistenceRoot: "/repo",
      queryKind: "search_terms",
      within: "/repo/internal/adapter/treehouse",
      basePath: "/repo/internal/adapter/treehouse",
      extensions: ["go"],
      excludePaths: ["internal/adapter/treehouse/assets"],
      limit: 50,
      terms: ["2026-"],
      contextLines: 0,
    };

    const result = await adapter.execute({
      request,
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async () => fuzzyLeakText,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");

    const renderedPaths = ((result.value as { renderedCompact?: string }).renderedCompact ?? "")
      .split("\n")
      .filter((line) => line && !line.startsWith(" ") && line !== "--" && !line.startsWith("→"))
      .filter((line) => !/^\d+\/\d+\s+matches\s+shown$/.test(line));
    // Only the `.go` file inside the treehouse directory survives.
    expect(renderedPaths).toEqual(["internal/adapter/treehouse/treehouse_test.go"]);
    // And the core/seeds_test.go path, which is outside `within`, is gone.
    expect((result.value as { renderedCompact?: string }).renderedCompact).not.toContain(
      "internal/core/seeds_test.go",
    );
  });

  test("continues backend cursor pages when post-filtering drops the current page", async () => {
    const adapter = createFffMcpStdioAdapter();
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    const result = await adapter.execute({
      request: {
        ...fileRestrictedSearchTerms,
        within: "/repo",
        basePath: "/repo",
        fileRestriction: undefined,
        glob: "sdk/cliproxy/service.go",
        terms: ["UsageStatisticsEnabled"],
      },
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          if (args.cursor === "9") {
            return [
              "1/1 matches shown",
              "sdk/cliproxy/service.go",
              " 804: redisqueue.SetUsageStatisticsEnabled(false)",
            ].join("\n");
          }
          return [
            "1/1 matches shown",
            "sdk/cliproxy/other.go",
            " 12: UsageStatisticsEnabled",
            "",
            "cursor: 9",
          ].join("\n");
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(calls).toEqual([
      {
        name: "multi_grep",
        arguments: {
          patterns: ["UsageStatisticsEnabled"],
          constraints: "**/sdk/cliproxy/service.go",
          maxResults: 50,
          context: 1,
        },
      },
      {
        name: "multi_grep",
        arguments: {
          patterns: ["UsageStatisticsEnabled"],
          constraints: "**/sdk/cliproxy/service.go",
          maxResults: 50,
          context: 1,
          cursor: "9",
        },
      },
    ]);
    expect(result.value.items).toEqual([
      {
        path: "/repo/sdk/cliproxy/service.go",
        relativePath: "sdk/cliproxy/service.go",
        line: 804,
        text: "redisqueue.SetUsageStatisticsEnabled(false)",
      },
    ]);
    expect((result.value as { renderedCompact?: string }).renderedCompact).toBe(
      "1 filtered match shown\nsdk/cliproxy/service.go\n 804: redisqueue.SetUsageStatisticsEnabled(false)",
    );
    expect((result.value as { renderedCompact?: string }).renderedCompact).not.toContain("cursor:");
  });

  test("does not report backend-only summary after cursor pages are fully filtered out", async () => {
    const adapter = createFffMcpStdioAdapter();
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    const result = await adapter.execute({
      request: {
        ...fileRestrictedSearchTerms,
        within: "/repo",
        basePath: "/repo",
        fileRestriction: undefined,
        glob: "sdk/cliproxy/service.go",
        terms: ["UsageStatisticsEnabled"],
      },
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          if (args.cursor === "9") {
            return [
              "1/1 matches shown",
              "sdk/cliproxy/second-other.go",
              " 44: UsageStatisticsEnabled",
            ].join("\n");
          }
          return [
            "1/1 matches shown",
            "sdk/cliproxy/first-other.go",
            " 12: UsageStatisticsEnabled",
            "",
            "cursor: 9",
          ].join("\n");
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(calls).toHaveLength(2);
    expect(result.value.items).toEqual([]);
    expect((result.value as { renderedCompact?: string }).renderedCompact).toBeUndefined();
    expect(result.value.summary).toEqual({});
  });

  test("continues partial cursor pages until enough filtered items are collected", async () => {
    const adapter = createFffMcpStdioAdapter();
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    const result = await adapter.execute({
      request: {
        ...fileRestrictedSearchTerms,
        within: "/repo",
        basePath: "/repo",
        fileRestriction: undefined,
        glob: "sdk/cliproxy/service.go",
        limit: 3,
        terms: ["UsageStatisticsEnabled"],
      },
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          if (args.cursor === "9") {
            return [
              "1/1 matches shown",
              "sdk/cliproxy/service.go",
              " 804: redisqueue.SetUsageStatisticsEnabled(false)",
            ].join("\n");
          }
          return [
            "2/2 matches shown",
            "sdk/cliproxy/service.go",
            " 99: redisqueue.SetUsageStatisticsEnabled(true)",
            "sdk/cliproxy/other.go",
            " 12: UsageStatisticsEnabled",
            "",
            "cursor: 9",
          ].join("\n");
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(calls).toEqual([
      {
        name: "multi_grep",
        arguments: {
          patterns: ["UsageStatisticsEnabled"],
          constraints: "**/sdk/cliproxy/service.go",
          maxResults: 3,
          context: 1,
        },
      },
      {
        name: "multi_grep",
        arguments: {
          patterns: ["UsageStatisticsEnabled"],
          constraints: "**/sdk/cliproxy/service.go",
          maxResults: 3,
          context: 1,
          cursor: "9",
        },
      },
    ]);
    expect(
      expectTextMatches(result.value.items).map((item) => `${item.relativePath}:${item.line}`),
    ).toEqual(["sdk/cliproxy/service.go:99", "sdk/cliproxy/service.go:804"]);
    expect((result.value as { renderedCompact?: string }).renderedCompact).toBe(
      [
        "2 filtered matches shown",
        "sdk/cliproxy/service.go",
        " 99: redisqueue.SetUsageStatisticsEnabled(true)",
        "sdk/cliproxy/service.go",
        " 804: redisqueue.SetUsageStatisticsEnabled(false)",
      ].join("\n"),
    );
    expect(result.value.summary).toEqual({ shownCount: 2 });
  });

  test("stops cursor drain when the backend repeats a cursor", async () => {
    const adapter = createFffMcpStdioAdapter();
    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    const result = await adapter.execute({
      request: {
        ...fileRestrictedSearchTerms,
        within: "/repo",
        basePath: "/repo",
        fileRestriction: undefined,
        glob: "sdk/cliproxy/service.go",
        terms: ["UsageStatisticsEnabled"],
      },
      runtime: {
        id: "fff-mcp::/repo",
        close: async () => {},
        callTool: async (name, args) => {
          calls.push({ name, arguments: args });
          return [
            "1/1 matches shown",
            "sdk/cliproxy/other.go",
            " 12: UsageStatisticsEnabled",
            "",
            "cursor: 9",
          ].join("\n");
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(calls.map((call) => call.arguments.cursor)).toEqual([undefined, "9"]);
    expect(result.value.items).toEqual([]);
    expect((result.value as { renderedCompact?: string }).renderedCompact).toBeUndefined();
    expect(result.value.summary).toEqual({});
    expect(result.value.diagnostics).toEqual({
      cursorDrain: {
        pagesFetched: 2,
        filteredOutCount: 2,
        repeatedCursor: "9",
        pageCapHit: false,
      },
    });
  });
});

describe("filterRenderedCompactText", () => {
  const synthetic = [
    "→ Read a/keep.ts (best match)",
    "3/3 matches shown",
    "a/keep.ts",
    " 10: const keep = true;",
    " 11- keep context",
    "--",
    "b/drop.ts",
    " 20: const drop = true;",
    "a/keep.ts [def]",
    " 30: export function keep() {}",
    " 31| const inner = true;",
  ].join("\n");

  test("keeps accepted blocks together with their context and separators", () => {
    const out = filterRenderedCompactText(synthetic, (p) => p === "a/keep.ts");
    expect(out).toContain("a/keep.ts\n 10: const keep = true;");
    expect(out).toContain(" 11- keep context");
    expect(out).toContain("a/keep.ts [def]");
    expect(out).toContain(" 30: export function keep() {}");
    expect(out).toContain(" 31| const inner = true;");
    expect(out).not.toContain("b/drop.ts");
    expect(out).not.toContain("const drop = true;");
  });

  test("drops a → Read recommendation that was filtered out", () => {
    const out = filterRenderedCompactText(synthetic, (p) => p === "b/drop.ts");
    expect(out).not.toMatch(/^→\s+Read\s+a\/keep\.ts/m);
    expect(out).toContain("b/drop.ts");
  });

  test("preserves summary lines even when every block is dropped", () => {
    const out = filterRenderedCompactText(synthetic, () => false);
    expect(out).toContain("3/3 matches shown");
    expect(out).not.toContain("a/keep.ts");
    expect(out).not.toContain("b/drop.ts");
    expect(out).not.toMatch(/^→\s+Read/m);
  });

  test("is a byte-for-byte identity when every block is accepted", () => {
    const out = filterRenderedCompactText(synthetic, () => true);
    expect(out).toBe(synthetic);
  });
});

describe("createFffMcpStdioAdapter multi-path within", () => {
  // The adapter compiles multi-path within into a single brace-expanded
  // constraint token and sends ONE call to fff-mcp. We capture the outgoing
  // constraint string to assert shape without needing a live backend.
  function captureConstraint(): {
    runtime: Parameters<
      NonNullable<ReturnType<typeof createFffMcpStdioAdapter>["startRuntime"]>
    > extends infer _A
      ? {
          id: string;
          close: () => void;
          callTool: (name: string, args: Record<string, unknown>) => Promise<string>;
        }
      : never;
    captured: { name: string; args: Record<string, unknown> }[];
  } {
    const captured: { name: string; args: Record<string, unknown> }[] = [];
    return {
      captured,
      runtime: {
        id: "fff-mcp::/repo",
        close: () => {},
        callTool: async (name, args) => {
          captured.push({ name, args });
          // Empty response with shownCount/totalCount absent — enough for
          // the adapter to produce a result without us having to fake
          // parse-compatible content.
          return "0 matches shown\n";
        },
      },
    };
  }

  test("multi-dir within compiles to a brace-expanded {dirA/**,dirB/**} constraint", async () => {
    const adapter = createFffMcpStdioAdapter();
    const { runtime, captured } = captureConstraint();

    const request: GrepBackendRequest = {
      backendId: "fff-mcp",
      persistenceRoot: "/repo",
      queryKind: "grep",
      within: "/repo/crates/portl-cli",
      basePath: "/repo/crates/portl-cli",
      additionalWithinEntries: [
        { resolvedWithin: "/repo/crates/portl-agent", basePath: "/repo/crates/portl-agent" },
      ],
      extensions: [],
      excludePaths: [],
      limit: 5,
      patterns: ["rustls"],
      literal: true,
      caseSensitive: false,
      contextLines: 0,
    };

    const result = await adapter.execute({ request, runtime });
    expect(result.ok).toBe(true);

    expect(captured).toHaveLength(1);
    // Single call, constraints field carries the brace expansion.
    const constraints = String((captured[0]!.args as { constraints?: string }).constraints ?? "");
    expect(constraints).toContain("{crates/portl-cli/**,crates/portl-agent/**}");
  });

  test("multi-file within compiles to {**/fileA,**/fileB} anchored-glob pins", async () => {
    const adapter = createFffMcpStdioAdapter();
    const { runtime, captured } = captureConstraint();

    const request: GrepBackendRequest = {
      backendId: "fff-mcp",
      persistenceRoot: "/repo",
      queryKind: "grep",
      within: "/repo/crates/portl-cli/Cargo.toml",
      basePath: "/repo/crates/portl-cli",
      fileRestriction: "/repo/crates/portl-cli/Cargo.toml",
      additionalWithinEntries: [
        {
          resolvedWithin: "/repo/Cargo.toml",
          basePath: "/repo",
          fileRestriction: "/repo/Cargo.toml",
        },
      ],
      extensions: [],
      excludePaths: [],
      limit: 5,
      patterns: ["rustls"],
      literal: true,
      caseSensitive: false,
      contextLines: 0,
    };

    const result = await adapter.execute({ request, runtime });
    expect(result.ok).toBe(true);

    const constraints = String((captured[0]!.args as { constraints?: string }).constraints ?? "");
    expect(constraints).toContain("{**/crates/portl-cli/Cargo.toml,**/Cargo.toml}");
  });

  test("mixed file + dir entries emit {**/file,dir/**} in brace", async () => {
    const adapter = createFffMcpStdioAdapter();
    const { runtime, captured } = captureConstraint();

    const request: GrepBackendRequest = {
      backendId: "fff-mcp",
      persistenceRoot: "/repo",
      queryKind: "grep",
      within: "/repo/Cargo.toml",
      basePath: "/repo",
      fileRestriction: "/repo/Cargo.toml",
      additionalWithinEntries: [
        { resolvedWithin: "/repo/crates/portl-cli", basePath: "/repo/crates/portl-cli" },
      ],
      extensions: [],
      excludePaths: [],
      limit: 5,
      patterns: ["rustls"],
      literal: true,
      caseSensitive: false,
      contextLines: 0,
    };

    const result = await adapter.execute({ request, runtime });
    expect(result.ok).toBe(true);

    const constraints = String((captured[0]!.args as { constraints?: string }).constraints ?? "");
    expect(constraints).toContain("{**/Cargo.toml,crates/portl-cli/**}");
  });

  test("single-path within (no additional entries) still emits the single-path token", async () => {
    // Regression guard: the multi-path branch should be dormant when
    // `additionalWithinEntries` is absent or empty. Use literal so the
    // adapter routes through multi_grep (which exposes `constraints`).
    const adapter = createFffMcpStdioAdapter();
    const { runtime, captured } = captureConstraint();

    const literalRequest: GrepBackendRequest = {
      ...grepRequest,
      literal: true,
      patterns: ["createSearchCoordinator"],
    };
    const result = await adapter.execute({ request: literalRequest, runtime });
    expect(result.ok).toBe(true);

    const constraints = String((captured[0]!.args as { constraints?: string }).constraints ?? "");
    expect(constraints).not.toContain("{");
    expect(constraints).toContain("lib/");
  });
});
