import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createFffNodeAdapter } from "./fff-node";
import type {
  FindFilesBackendRequest,
  GrepBackendRequest,
  SearchBackendRuntime,
  SearchTermsBackendRequest,
} from "./types";

type FileItem = { path: string; relativePath: string };
type TextItem = {
  path: string;
  relativePath: string;
  lineNumber: number;
  lineContent: string;
};

type FileSearchPage = {
  items: FileItem[];
};

type GrepCursor = { readonly __brand: "GrepCursor"; readonly _offset: number };

type GrepPage = {
  items: TextItem[];
  nextCursor?: GrepCursor | null;
};

type FinderCallLog = {
  fileSearch: Array<{ query: string; pageSize?: number; pageIndex?: number }>;
  multiGrep: Array<{
    patterns: string[];
    constraints?: string;
    beforeContext: number;
    afterContext: number;
    cursorOffset?: number;
  }>;
  grep: Array<{
    query: string;
    mode: string;
    beforeContext: number;
    afterContext: number;
    cursorOffset?: number;
  }>;
};

function cursor(offset: number): GrepCursor {
  return { __brand: "GrepCursor", _offset: offset };
}

function makeLog(): FinderCallLog {
  return {
    fileSearch: [],
    multiGrep: [],
    grep: [],
  };
}

function makeRuntime(args: {
  log: FinderCallLog;
  fileSearchPages?: FileSearchPage[];
  multiGrepPages?: GrepPage[];
  grepPages?: GrepPage[];
}): SearchBackendRuntime & {
  finder: {
    fileSearch: (
      query: string,
      options?: { pageSize?: number; pageIndex?: number },
    ) => {
      ok: true;
      value: FileSearchPage;
    };
    multiGrep: (options: {
      patterns: string[];
      constraints?: string;
      beforeContext: number;
      afterContext: number;
      cursor?: GrepCursor | null;
    }) => {
      ok: true;
      value: GrepPage;
    };
    grep: (
      query: string,
      options: {
        mode: string;
        beforeContext: number;
        afterContext: number;
        cursor?: GrepCursor | null;
      },
    ) => {
      ok: true;
      value: GrepPage;
    };
  };
} {
  const defaultFileSearchPages: FileSearchPage[] = [
    {
      items: [
        { path: "/repo/src/router.ts", relativePath: "src/router.ts" },
        { path: "/repo/dist/router.js", relativePath: "dist/router.js" },
      ],
    },
  ];
  const defaultMultiGrepPages: GrepPage[] = [
    {
      items: [
        {
          path: "/repo/src/router.ts",
          relativePath: "src/router.ts",
          lineNumber: 8,
          lineContent: "const router = createRouter();",
        },
        {
          path: "/repo/dist/router.js",
          relativePath: "dist/router.js",
          lineNumber: 3,
          lineContent: "const router = createRouter();",
        },
      ],
      nextCursor: null,
    },
  ];
  const defaultGrepPages: GrepPage[] = [
    {
      items: [
        {
          path: "/repo/src/router.ts",
          relativePath: "src/router.ts",
          lineNumber: 12,
          lineContent: "export function planRequest() {}",
        },
      ],
      nextCursor: null,
    },
  ];

  const fileSearchPages = args.fileSearchPages ?? defaultFileSearchPages;
  const multiGrepPages = args.multiGrepPages ?? defaultMultiGrepPages;
  const grepPages = args.grepPages ?? defaultGrepPages;

  return {
    id: "fff-runtime",
    close: async () => {},
    finder: {
      fileSearch(query, options) {
        args.log.fileSearch.push({
          query,
          pageSize: options?.pageSize,
          pageIndex: options?.pageIndex,
        });
        return {
          ok: true,
          value: fileSearchPages[options?.pageIndex ?? 0] ?? { items: [] },
        };
      },
      multiGrep(options) {
        args.log.multiGrep.push({
          patterns: options.patterns,
          constraints: options.constraints,
          beforeContext: options.beforeContext,
          afterContext: options.afterContext,
          cursorOffset: options.cursor?._offset,
        });
        return {
          ok: true,
          value: multiGrepPages[options.cursor?._offset ?? 0] ?? { items: [], nextCursor: null },
        };
      },
      grep(query, options) {
        args.log.grep.push({
          query,
          mode: options.mode,
          beforeContext: options.beforeContext,
          afterContext: options.afterContext,
          cursorOffset: options.cursor?._offset,
        });
        return {
          ok: true,
          value: grepPages[options.cursor?._offset ?? 0] ?? { items: [], nextCursor: null },
        };
      },
    },
  };
}

const findFilesRequest: FindFilesBackendRequest = {
  backendId: "fff-node",
  persistenceRoot: "/repo",
  queryKind: "find_files",
  within: "/repo/src",
  basePath: "/repo/src",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 20,
  query: "router",
};

const searchTermsRequest: SearchTermsBackendRequest = {
  backendId: "fff-node",
  persistenceRoot: "/repo",
  queryKind: "search_terms",
  within: "/repo/src",
  basePath: "/repo/src",
  extensions: ["ts"],
  excludePaths: ["dist"],
  limit: 20,
  terms: ["router", "createRouter"],
  contextLines: 2,
};

const grepRequest: GrepBackendRequest = {
  backendId: "fff-node",
  persistenceRoot: "/repo",
  queryKind: "grep",
  within: "/repo/src",
  basePath: "/repo/src",
  extensions: ["ts"],
  excludePaths: [],
  limit: 20,
  patterns: ["plan(Request)?", "build(Request)?"],
  caseSensitive: false,
  contextLines: 1,
};

describe("createFffNodeAdapter", () => {
  test("lowers find_files requests into scoped FFF file search and filters results", async () => {
    const log = makeLog();
    const adapter = createFffNodeAdapter();

    const result = await adapter.execute({
      request: findFilesRequest,
      runtime: makeRuntime({ log }),
    });

    expect(log.fileSearch).toEqual([
      {
        query: "src/ !dist/ router",
        pageSize: 20,
        pageIndex: 0,
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([
      { path: "/repo/src/router.ts", relativePath: "src/router.ts" },
    ]);
  });

  test("lowers search_terms requests into FFF multi_grep with native constraints", async () => {
    const log = makeLog();
    const adapter = createFffNodeAdapter();

    const result = await adapter.execute({
      request: searchTermsRequest,
      runtime: makeRuntime({ log }),
    });

    expect(log.multiGrep).toEqual([
      {
        patterns: ["router", "createRouter"],
        constraints: "src/ !dist/",
        beforeContext: 2,
        afterContext: 2,
        cursorOffset: undefined,
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([
      {
        path: "/repo/src/router.ts",
        relativePath: "src/router.ts",
        line: 8,
        text: "const router = createRouter();",
      },
    ]);
  });

  test("keeps grep on the FFF-backed regex path while scoping to within", async () => {
    const log = makeLog();
    const adapter = createFffNodeAdapter();

    const result = await adapter.execute({
      request: grepRequest,
      runtime: makeRuntime({ log }),
    });

    expect(log.grep).toEqual([
      {
        query: "src/ (?i:(?:plan(Request)?)|(?:build(Request)?))",
        mode: "regex",
        beforeContext: 1,
        afterContext: 1,
        cursorOffset: undefined,
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.queryKind).toBe("grep");
  });

  test("continues paginating file search until it finds enough in-scope results", async () => {
    const log = makeLog();
    const adapter = createFffNodeAdapter();

    const result = await adapter.execute({
      request: {
        ...findFilesRequest,
        within: "/repo/Vendor/libghostty/include",
        basePath: "/repo/Vendor/libghostty/include",
        extensions: ["h"],
        excludePaths: [],
        limit: 2,
        query: "ghostty",
      },
      runtime: makeRuntime({
        log,
        fileSearchPages: [
          {
            items: [
              {
                path: "/repo/VVTerm/GhosttyTerminalView.swift",
                relativePath: "VVTerm/GhosttyTerminalView.swift",
              },
              { path: "/repo/VVTerm/Ghostty.App.swift", relativePath: "VVTerm/Ghostty.App.swift" },
            ],
          },
          {
            items: [
              {
                path: "/repo/Vendor/libghostty/include/ghostty.h",
                relativePath: "Vendor/libghostty/include/ghostty.h",
              },
              {
                path: "/repo/Vendor/libghostty/include/ghostty/vt.h",
                relativePath: "Vendor/libghostty/include/ghostty/vt.h",
              },
            ],
          },
        ],
      }),
    });

    expect(log.fileSearch).toEqual([
      {
        query: "Vendor/libghostty/include/ ghostty",
        pageSize: 2,
        pageIndex: 0,
      },
      {
        query: "Vendor/libghostty/include/ ghostty",
        pageSize: 2,
        pageIndex: 1,
      },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([
      {
        path: "/repo/Vendor/libghostty/include/ghostty.h",
        relativePath: "Vendor/libghostty/include/ghostty.h",
      },
      {
        path: "/repo/Vendor/libghostty/include/ghostty/vt.h",
        relativePath: "Vendor/libghostty/include/ghostty/vt.h",
      },
    ]);
  });

  test("short-circuits zero-limit requests without calling FFF", async () => {
    const log = makeLog();
    const adapter = createFffNodeAdapter();

    const result = await adapter.execute({
      request: {
        ...findFilesRequest,
        limit: 0,
      },
      runtime: makeRuntime({ log }),
    });

    expect(log.fileSearch).toEqual([]);
    expect(log.multiGrep).toEqual([]);
    expect(log.grep).toEqual([]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([]);
  });

  test("uses an exact file token when within targets a single file", async () => {
    const log = makeLog();
    const adapter = createFffNodeAdapter();

    await adapter.execute({
      request: {
        ...grepRequest,
        within: "/repo/src/router.ts",
        basePath: "/repo/src",
        fileRestriction: "/repo/src/router.ts",
        patterns: ["planRequest"],
        caseSensitive: true,
      },
      runtime: makeRuntime({ log }),
    });

    expect(log.grep[0]?.query).toBe("src/router.ts planRequest");
  });

  test("continues past the default page cap when native scope encoding is not possible", async () => {
    const log = makeLog();
    const adapter = createFffNodeAdapter();
    const within = "/repo/has space";

    const grepPages: GrepPage[] = Array.from({ length: 56 }, (_, index) => {
      if (index === 55) {
        return {
          items: [
            {
              path: "/repo/has space/needle.txt",
              relativePath: "has space/needle.txt",
              lineNumber: 1,
              lineContent: "needle",
            },
          ],
          nextCursor: null,
        };
      }

      return {
        items: [
          {
            path: `/repo/outside-${index}.txt`,
            relativePath: `outside-${index}.txt`,
            lineNumber: 1,
            lineContent: "needle",
          },
        ],
        nextCursor: cursor(index + 1),
      };
    });

    const result = await adapter.execute({
      request: {
        backendId: "fff-node",
        persistenceRoot: "/repo",
        queryKind: "grep",
        within,
        basePath: within,
        extensions: [],
        excludePaths: [],
        limit: 1,
        patterns: ["needle"],
        caseSensitive: true,
        contextLines: 0,
      },
      runtime: makeRuntime({ log, grepPages }),
    });

    expect(log.grep).toHaveLength(56);
    expect(log.grep[0]?.query).toBe("needle");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.items).toEqual([
      {
        path: "/repo/has space/needle.txt",
        relativePath: "has space/needle.txt",
        line: 1,
        text: "needle",
      },
    ]);
  });

  test("uses real fff-node constraint parsing for subtree grep and file search", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fff-router-scope-"));
    const subtree = path.join(tempRoot, "Vendor/libghostty/include");
    const excluded = path.join(subtree, "generated");
    const outside = path.join(tempRoot, "VVTerm");

    await fs.mkdir(subtree, { recursive: true });
    await fs.mkdir(excluded, { recursive: true });
    await fs.mkdir(outside, { recursive: true });
    await fs.writeFile(path.join(subtree, "ghostty.h"), "ghostty_ visible\n");
    await fs.writeFile(path.join(excluded, "generated.h"), "ghostty_ hidden\n");
    await fs.writeFile(path.join(outside, "GhosttyTerminalView.swift"), "ghostty_ outside\n");

    const adapter = createFffNodeAdapter();
    const runtime = await adapter.startRuntime?.({
      backendId: "fff-node",
      persistenceRoot: tempRoot,
    });
    if (!runtime) throw new Error("expected runtime");

    try {
      const grepResult = await adapter.execute({
        request: {
          backendId: "fff-node",
          persistenceRoot: tempRoot,
          queryKind: "grep",
          within: subtree,
          basePath: subtree,
          extensions: [],
          excludePaths: ["Vendor/libghostty/include/generated"],
          limit: 20,
          patterns: ["ghostty_"],
          caseSensitive: false,
          contextLines: 0,
        },
        runtime,
      });

      expect(grepResult.ok).toBe(true);
      if (!grepResult.ok) throw new Error("expected grep success");
      expect(grepResult.value.items).toEqual([
        {
          path: path.join(subtree, "ghostty.h"),
          relativePath: "Vendor/libghostty/include/ghostty.h",
          line: 1,
          text: "ghostty_ visible",
        },
      ]);

      const fileResult = await adapter.execute({
        request: {
          backendId: "fff-node",
          persistenceRoot: tempRoot,
          queryKind: "find_files",
          within: subtree,
          basePath: subtree,
          extensions: ["h"],
          excludePaths: ["Vendor/libghostty/include/generated"],
          limit: 20,
          query: "ghostty",
        },
        runtime,
      });

      expect(fileResult.ok).toBe(true);
      if (!fileResult.ok) throw new Error("expected file search success");
      expect(fileResult.value.items).toEqual([
        {
          path: path.join(subtree, "ghostty.h"),
          relativePath: "Vendor/libghostty/include/ghostty.h",
        },
      ]);
    } finally {
      await runtime.close();
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
