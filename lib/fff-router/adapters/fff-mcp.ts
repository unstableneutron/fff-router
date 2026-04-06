import { filterItems } from "./common";
import type { BackendSearchResult, SearchBackendAdapter, SearchBackendRuntime } from "./types";

type FffFinderLike = {
  fileSearch: (query: string) => {
    ok: boolean;
    value?: {
      items: Array<{ path: string; relativePath: string }>;
    };
    error?: string;
  };
  multiGrep: (options: { patterns: string[]; beforeContext: number; afterContext: number }) => {
    ok: boolean;
    value?: {
      items: Array<{
        path: string;
        relativePath: string;
        lineNumber: number;
        lineContent: string;
      }>;
    };
    error?: string;
  };
  grep: (
    query: string,
    options: {
      mode: "regex";
      beforeContext: number;
      afterContext: number;
    },
  ) => {
    ok: boolean;
    value?: {
      items: Array<{
        path: string;
        relativePath: string;
        lineNumber: number;
        lineContent: string;
      }>;
    };
    error?: string;
  };
};

export type FffRuntime = SearchBackendRuntime & {
  finder: FffFinderLike;
};

function backendUnavailable(message: string): BackendSearchResult {
  return {
    ok: false,
    error: {
      code: "BACKEND_UNAVAILABLE",
      backendId: "fff-mcp",
      message,
    },
  };
}

function searchFailed(message: string): BackendSearchResult {
  return {
    ok: false,
    error: {
      code: "SEARCH_FAILED",
      backendId: "fff-mcp",
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

export function createFffMcpAdapter(): SearchBackendAdapter<FffRuntime> {
  return {
    backendId: "fff-mcp",
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
        id: `fff-mcp::${args.persistenceRoot}`,
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

      switch (args.request.queryKind) {
        case "find_files": {
          const result = args.runtime.finder.fileSearch(args.request.query);
          if (!result.ok || !result.value) {
            return searchFailed(result.error ?? "FFF file search failed");
          }

          const items = filterItems(
            args.request,
            result.value.items.map((item) => ({
              path: item.path,
              relativePath: item.relativePath,
            })),
          );

          return {
            ok: true,
            value: {
              backendId: "fff-mcp",
              queryKind: "find_files",
              items,
              nextCursor: null,
            },
          };
        }
        case "search_terms": {
          const result = args.runtime.finder.multiGrep({
            patterns: args.request.terms,
            beforeContext: args.request.contextLines,
            afterContext: args.request.contextLines,
          });
          if (!result.ok || !result.value) {
            return searchFailed(result.error ?? "FFF multi_grep failed");
          }

          const items = filterItems(
            args.request,
            result.value.items.map((item) => ({
              path: item.path,
              relativePath: item.relativePath,
              line: item.lineNumber,
              text: item.lineContent,
            })),
          );

          return {
            ok: true,
            value: {
              backendId: "fff-mcp",
              queryKind: "search_terms",
              items,
              nextCursor: null,
            },
          };
        }
        case "grep": {
          const result = args.runtime.finder.grep(
            normalizeRegexPattern(args.request.pattern, args.request.caseSensitive),
            {
              mode: "regex",
              beforeContext: args.request.contextLines,
              afterContext: args.request.contextLines,
            },
          );
          if (!result.ok || !result.value) {
            return searchFailed(result.error ?? "FFF grep failed");
          }

          const items = filterItems(
            args.request,
            result.value.items.map((item) => ({
              path: item.path,
              relativePath: item.relativePath,
              line: item.lineNumber,
              text: item.lineContent,
            })),
          );

          return {
            ok: true,
            value: {
              backendId: "fff-mcp",
              queryKind: "grep",
              items,
              nextCursor: null,
            },
          };
        }
      }
    },
  };
}
