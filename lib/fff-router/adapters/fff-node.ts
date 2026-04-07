import { filterItems } from "./common";
import { buildFffScopeTokens, buildScopedQuery } from "./fff-scope";
import type {
  BackendResultItem,
  BackendSearchResult,
  SearchBackendAdapter,
  SearchBackendRuntime,
} from "./types";

type GrepCursorLike = {
  readonly __brand: "GrepCursor";
  readonly _offset: number;
};

type FileSearchResultLike = {
  ok: boolean;
  value?: {
    items: Array<{ path: string; relativePath: string }>;
    totalMatched?: number;
  };
  error?: string;
};

type GrepResultLike = {
  ok: boolean;
  value?: {
    items: Array<{
      path: string;
      relativePath: string;
      lineNumber: number;
      lineContent: string;
    }>;
    nextCursor?: GrepCursorLike | null;
  };
  error?: string;
};

type FffFinderLike = {
  fileSearch: (
    query: string,
    options?: { pageSize?: number; pageIndex?: number },
  ) => FileSearchResultLike;
  multiGrep: (options: {
    patterns: string[];
    constraints?: string;
    beforeContext: number;
    afterContext: number;
    cursor?: GrepCursorLike | null;
  }) => GrepResultLike;
  grep: (
    query: string,
    options: {
      mode: "regex";
      beforeContext: number;
      afterContext: number;
      cursor?: GrepCursorLike | null;
    },
  ) => GrepResultLike;
};

export type FffRuntime = SearchBackendRuntime & {
  finder: FffFinderLike;
};

const MAX_PAGES = 50;

function backendUnavailable(message: string): BackendSearchResult {
  return {
    ok: false,
    error: {
      code: "BACKEND_UNAVAILABLE",
      backendId: "fff-node",
      message,
    },
  };
}

function searchFailed(message: string): BackendSearchResult {
  return {
    ok: false,
    error: {
      code: "SEARCH_FAILED",
      backendId: "fff-node",
      message,
    },
  };
}

function normalizeRegexPattern(pattern: string, caseSensitive: boolean): string {
  if (caseSensitive) {
    return pattern;
  }

  return `(?i:${pattern})`;
}

function mapFileItems(
  result: NonNullable<FileSearchResultLike["value"]>["items"],
): BackendResultItem[] {
  return result.map((item) => ({
    path: item.path,
    relativePath: item.relativePath,
  }));
}

function mapTextItems(result: NonNullable<GrepResultLike["value"]>["items"]): BackendResultItem[] {
  return result.map((item) => ({
    path: item.path,
    relativePath: item.relativePath,
    line: item.lineNumber,
    text: item.lineContent,
  }));
}

function success(
  queryKind: "find_files" | "search_terms" | "grep",
  items: BackendResultItem[],
): BackendSearchResult {
  return {
    ok: true,
    value: {
      backendId: "fff-node",
      queryKind,
      items,
      nextCursor: null,
    },
  };
}

export function createFffNodeAdapter(): SearchBackendAdapter<FffRuntime> {
  return {
    backendId: "fff-node",
    supportedQueryKinds: ["find_files", "search_terms", "grep"],
    async startRuntime(args) {
      let fffNode: typeof import("@ff-labs/fff-node");
      try {
        fffNode = await import("@ff-labs/fff-node");
      } catch (error) {
        throw new Error(
          `Failed to load @ff-labs/fff-node: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const created = fffNode.FileFinder.create({
        basePath: args.persistenceRoot,
      });
      if (!created.ok) {
        throw new Error(String(created.error));
      }

      await created.value.waitForScan(5_000);
      return {
        id: `fff-node::${args.persistenceRoot}`,
        finder: created.value,
        close: async () => {
          created.value.destroy();
        },
      };
    },
    async execute(args) {
      if (!args.runtime) {
        return backendUnavailable("FFF runtime is not available");
      }

      if (args.request.limit === 0) {
        return success(args.request.queryKind, []);
      }

      const scope = buildFffScopeTokens(args.request);
      const maxPages = scope.fallbackRequired ? Number.MAX_SAFE_INTEGER : MAX_PAGES;

      switch (args.request.queryKind) {
        case "find_files": {
          const query = buildScopedQuery(scope.tokens, args.request.query);
          const pageSize = Math.max(args.request.limit, 1);
          const collected: BackendResultItem[] = [];

          for (
            let pageIndex = 0;
            pageIndex < maxPages && collected.length < args.request.limit;
            pageIndex += 1
          ) {
            const result = args.runtime.finder.fileSearch(query, {
              pageSize,
              pageIndex,
            });
            if (!result.ok || !result.value) {
              return searchFailed(result.error ?? "FFF file search failed");
            }

            const filtered = filterItems(args.request, mapFileItems(result.value.items));
            collected.push(...filtered);

            if (result.value.items.length < pageSize) {
              break;
            }
          }

          return success("find_files", collected.slice(0, args.request.limit));
        }
        case "search_terms": {
          const constraints = scope.tokens.join(" ");
          const collected: BackendResultItem[] = [];
          let cursor: GrepCursorLike | null = null;

          for (let page = 0; page < maxPages && collected.length < args.request.limit; page += 1) {
            const result = args.runtime.finder.multiGrep({
              patterns: args.request.terms,
              constraints: constraints || undefined,
              beforeContext: args.request.contextLines,
              afterContext: args.request.contextLines,
              cursor,
            });
            if (!result.ok || !result.value) {
              return searchFailed(result.error ?? "FFF multi_grep failed");
            }

            const filtered = filterItems(args.request, mapTextItems(result.value.items));
            collected.push(...filtered);

            if (!result.value.nextCursor) {
              break;
            }
            cursor = result.value.nextCursor;
          }

          return success("search_terms", collected.slice(0, args.request.limit));
        }
        case "grep": {
          const query = buildScopedQuery(
            scope.tokens,
            normalizeRegexPattern(args.request.pattern, args.request.caseSensitive),
          );
          const collected: BackendResultItem[] = [];
          let cursor: GrepCursorLike | null = null;

          for (let page = 0; page < maxPages && collected.length < args.request.limit; page += 1) {
            const result = args.runtime.finder.grep(query, {
              mode: "regex",
              beforeContext: args.request.contextLines,
              afterContext: args.request.contextLines,
              cursor,
            });
            if (!result.ok || !result.value) {
              return searchFailed(result.error ?? "FFF grep failed");
            }

            const filtered = filterItems(args.request, mapTextItems(result.value.items));
            collected.push(...filtered);

            if (!result.value.nextCursor) {
              break;
            }
            cursor = result.value.nextCursor;
          }

          return success("grep", collected.slice(0, args.request.limit));
        }
      }
    },
  };
}
