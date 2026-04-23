import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { filterItems } from "./common";
import type {
  BackendSearchResult,
  BackendSearchSummary,
  SearchBackendAdapter,
  SearchBackendRuntime,
} from "./types";

type FffMcpRuntime = SearchBackendRuntime & {
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>;
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

function discoverFffMcpCommand(): string {
  return process.env.FFF_ROUTER_FFF_MCP_BIN || "fff-mcp";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inheritedStringEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function normalizeRelative(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function formatExcludeConstraint(excludePath: string): string {
  return excludePath.includes(".") || excludePath.endsWith("/")
    ? `!${excludePath}`
    : `!${excludePath}/`;
}

function buildConstraintTokens(request: {
  persistenceRoot: string;
  basePath: string;
  fileRestriction?: string;
  glob?: string;
  extensions: string[];
  excludePaths: string[];
}): string[] {
  const tokens: string[] = [];
  if (request.fileRestriction) {
    // fff-mcp's constraint DSL treats a bare path token (`deep/sub/target.ts`)
    // as a fuzzy filename hint, not an exact-file pin. Probing against
    // fff-mcp directly shows the anchored-glob form `**/deep/sub/target.ts`
    // is the only reliable way to restrict matches to a single file — it
    // selects just that path even when siblings share the basename. The
    // adapter still post-filters via `filterRenderedCompactText` so
    // correctness does not depend on fff-mcp honouring the glob, but
    // emitting the tighter token keeps the backend from scanning unrelated
    // files in the first place.
    const relativeFile = normalizeRelative(
      path.relative(request.persistenceRoot, request.fileRestriction),
    );
    if (relativeFile && relativeFile !== ".") {
      tokens.push(`**/${relativeFile}`);
    }
  } else {
    const baseRelative = normalizeRelative(
      path.relative(request.persistenceRoot, request.basePath),
    );
    if (baseRelative && baseRelative !== ".") {
      tokens.push(baseRelative.endsWith("/") ? baseRelative : `${baseRelative}/`);
    }
  }

  if (request.glob) {
    tokens.push(request.glob);
  }

  for (const extension of request.extensions) {
    tokens.push(`*.${extension}`);
  }

  for (const excludePath of request.excludePaths) {
    tokens.push(formatExcludeConstraint(excludePath));
  }

  return tokens;
}

function compileFindFilesQuery(request: {
  query: string;
  persistenceRoot: string;
  basePath: string;
  fileRestriction?: string;
  glob?: string;
  extensions: string[];
  excludePaths: string[];
}): string {
  return [request.query, ...buildConstraintTokens(request)].filter(Boolean).join(" ");
}

function compileConstraints(request: {
  persistenceRoot: string;
  basePath: string;
  fileRestriction?: string;
  glob?: string;
  extensions: string[];
  excludePaths: string[];
}): string {
  return buildConstraintTokens(request).join(" ");
}

function compileGrepQuery(request: {
  patterns: string[];
  persistenceRoot: string;
  basePath: string;
  fileRestriction?: string;
  glob?: string;
  extensions: string[];
  excludePaths: string[];
}): string {
  // fff-mcp's `grep` tool takes a single space-delimited query where the final
  // token is the pattern and earlier tokens are constraints. Raw whitespace in
  // the pattern would be shredded into extra constraint tokens, so we encode
  // any literal spaces/tabs as `\s` (supported by fff-mcp's Rust regex engine).
  const encodedPatterns = request.patterns.map(encodeFffMcpGrepPattern);
  const combinedPattern =
    encodedPatterns.length === 1
      ? (encodedPatterns[0] ?? "")
      : encodedPatterns.map((pattern) => `(?:${pattern})`).join("|");
  return [...buildConstraintTokens(request), combinedPattern].filter(Boolean).join(" ");
}

/**
 * Encode whitespace in a regex pattern so fff-mcp's whitespace-delimited grep
 * DSL doesn't split the pattern into multiple constraint tokens. `\s` matches
 * any whitespace char; callers who need exact single-space semantics should
 * write `\x20` explicitly.
 */
function encodeFffMcpGrepPattern(pattern: string): string {
  return pattern.replace(/[ \t]/g, "\\s");
}

function stripFindFilesSuffix(line: string): string {
  return line
    .replace(/\s+-\s+(hot|warm|frequent)(\s+git:[^\s]+)?$/, "")
    .replace(/\s+git:[^\s]+$/, "")
    .trim();
}

function parseFindFilesOutput(text: string, persistenceRoot: string) {
  const items: Array<{ path: string; relativePath: string }> = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (
      !line ||
      line.startsWith("→") ||
      line.startsWith("cursor:") ||
      /^\d+\/\d+\s+matches/.test(line) ||
      /^0\s+results/.test(line)
    ) {
      continue;
    }

    const relativePath = stripFindFilesSuffix(line);
    if (!relativePath) {
      continue;
    }

    items.push({
      path: path.join(persistenceRoot, relativePath),
      relativePath,
    });
  }

  return items;
}

function parseReadRecommendation(
  line: string,
): BackendSearchSummary["readRecommendation"] | undefined {
  const match = line.match(/^→\s+Read\s+(.+?)(?:\s+\((.+)\))?$/);
  if (!match) {
    return undefined;
  }

  const relativePath = match[1];
  const reason = match[2];
  if (!relativePath) {
    return undefined;
  }

  return {
    relativePath: normalizeRelative(relativePath.trim().replace(/\s+\[def\]$/, "")),
    ...(reason ? { reason: reason.trim() } : {}),
  };
}

function parseShownSummary(line: string): Pick<BackendSearchSummary, "shownCount" | "totalCount"> {
  const match = line.match(/^(\d+)\/(\d+)\s+matches\s+shown$/);
  if (!match) {
    return {};
  }

  return {
    shownCount: Number(match[1]),
    totalCount: Number(match[2]),
  };
}

/**
 * Walks an fff-mcp compact-text response and keeps only the path blocks whose
 * header relative-path satisfies `keep`. Preamble lines (`N/M matches shown`,
 * `0 matches`, `0 exact matches`, `cursor:…`, blanks) are always preserved;
 * `→ Read <path>` recommendations are dropped when the recommended path has
 * been filtered out so the rendered preamble never points at a file we just
 * removed from the body. Indented numbered lines (`  N:`, `  N-`, `  N|`)
 * and `--` block separators are emitted only while the active header is
 * accepted.
 *
 * The predicate mirrors the one the adapter applies to `items` via
 * `filterItems` so that `items` and `renderedCompact` describe the same set
 * of paths. fff-mcp's multi_grep/grep DSL treats bare path tokens as fuzzy
 * filename hints (not strict filters), so even with a tight constraint it
 * can still return path blocks from siblings of the restricted file. This
 * filter is the correctness gate; the anchored-glob constraint token in
 * `buildConstraintTokens` is just a performance hint to reduce the amount
 * of unrelated scanning fff-mcp has to do.
 */
export function filterRenderedCompactText(
  text: string,
  keep: (relativePath: string) => boolean,
): string {
  const out: string[] = [];
  // Preamble before any header always passes through; flips on each header.
  let currentAccepted = true;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    // `→ Read <rel> (reason)`: drop when the recommended path failed `keep`
    // so the rendered preamble never points at a filtered-out file.
    const readMatch = line.match(/^→\s+Read\s+(.+?)(?:\s+\((.+)\))?$/);
    if (readMatch) {
      const recPath = normalizeRelative((readMatch[1] ?? "").replace(/\s+\[def\]$/, "").trim());
      if (keep(recPath)) {
        out.push(rawLine);
      }
      continue;
    }

    // Preamble / summary / end markers: always pass through.
    if (
      !line ||
      line.startsWith("cursor:") ||
      /^\d+\/\d+\s+matches\s+shown$/.test(line) ||
      /^0\s+matches/.test(line) ||
      /^0\s+exact\s+matches/.test(line)
    ) {
      out.push(rawLine);
      continue;
    }

    // Indented numbered lines and `--` separators belong to the active block.
    if (line === "--" || /^\s+\d+[:\-|]/.test(line)) {
      if (currentAccepted) {
        out.push(rawLine);
      }
      continue;
    }

    // Otherwise: a new path-header line. Strip any `[def]` / `[hot]` /
    // `[warm]` / `[frequent]` suffix before normalising — mirrors the
    // header parsing in `parseTextMatchOutput` so acceptance is decided
    // against the same relative-path shape `filterItems` saw.
    const headerPath = normalizeRelative(line.replace(/\s+\[[^\]]+\]$/, ""));
    currentAccepted = keep(headerPath);
    if (currentAccepted) {
      out.push(rawLine);
    }
  }

  return out.join("\n");
}

function parseTextMatchOutput(text: string, persistenceRoot: string) {
  const items: Array<{
    path: string;
    relativePath: string;
    line: number;
    text: string;
    contextBefore?: string[];
    contextAfter?: string[];
    isDefinition?: boolean;
    definitionBody?: string[];
  }> = [];

  const summary: BackendSearchSummary = {};
  let currentPath: string | null = null;
  let currentPathIsDefinition = false;
  let pendingBefore: string[] = [];
  let currentMatch: {
    path: string;
    relativePath: string;
    line: number;
    text: string;
    contextBefore?: string[];
    contextAfter?: string[];
    isDefinition?: boolean;
    definitionBody?: string[];
  } | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith("cursor:")) {
      continue;
    }

    const readRecommendation = parseReadRecommendation(line);
    if (readRecommendation) {
      summary.readRecommendation = readRecommendation;
      continue;
    }

    const shownSummary = parseShownSummary(line);
    if (shownSummary.shownCount !== undefined || shownSummary.totalCount !== undefined) {
      Object.assign(summary, shownSummary);
      continue;
    }

    if (/^0\s+matches/.test(line) || /^0\s+exact\s+matches/.test(line)) {
      continue;
    }

    if (line === "--") {
      currentMatch = null;
      pendingBefore = [];
      continue;
    }

    const numbered = line.match(/^\s+(\d+)([:\-|])\s?(.*)$/);
    if (numbered) {
      const [, lineNumberRaw, kind, contentRaw] = numbered;
      const lineNumber = Number(lineNumberRaw);
      const content = (contentRaw ?? "").trim();

      if (kind === ":") {
        if (!currentPath) {
          continue;
        }
        currentMatch = {
          path: path.join(persistenceRoot, currentPath),
          relativePath: currentPath,
          line: lineNumber,
          text: content,
          ...(pendingBefore.length > 0 ? { contextBefore: [...pendingBefore] } : {}),
          ...(currentPathIsDefinition ? { isDefinition: true } : {}),
        };
        items.push(currentMatch);
        pendingBefore = [];
        continue;
      }

      if (kind === "-") {
        if (currentMatch) {
          currentMatch.contextAfter = [...(currentMatch.contextAfter ?? []), content];
        } else {
          pendingBefore.push(content);
        }
        continue;
      }

      if (kind === "|") {
        if (currentMatch) {
          if (currentMatch.isDefinition) {
            currentMatch.definitionBody = [...(currentMatch.definitionBody ?? []), content];
          } else {
            currentMatch.contextAfter = [...(currentMatch.contextAfter ?? []), content];
          }
        }
        continue;
      }
    }

    currentPathIsDefinition = /\s+\[def\]$/.test(line);
    currentPath = normalizeRelative(line.replace(/\s+\[[^\]]+\]$/, ""));
    currentMatch = null;
    pendingBefore = [];
  }

  return { items, summary };
}

/**
 * If `filterItems` dropped any relative paths returned by fff-mcp, rewrite the
 * compact text to match the filtered view. When nothing was dropped we keep
 * the original text verbatim — this preserves the backend's exact formatting
 * (spacing, ordering, newline style) for the common case and only rebuilds
 * when the item/text invariant would otherwise break.
 */
function rewriteRenderedCompactIfNeeded(
  text: string,
  originalItems: Array<{ relativePath: string }>,
  filteredItems: Array<{ relativePath: string }>,
): string {
  const survivingPaths = new Set(filteredItems.map((item) => item.relativePath));
  const somethingDropped = originalItems.some((item) => !survivingPaths.has(item.relativePath));
  if (!somethingDropped) {
    return text;
  }
  return filterRenderedCompactText(text, (relativePath) => survivingPaths.has(relativePath));
}

/**
 * Drop a read recommendation when its path is no longer in the item set. We
 * deliberately leave `shownCount` / `totalCount` alone: those reflect what
 * fff-mcp saw before our post-filter and recomputing them here would be
 * speculative (fff-mcp's `totalCount` counts pre-truncation matches we can
 * never observe). The rendered-text filter mirrors this decision.
 */
function narrowSummaryToSurvivingPaths(
  summary: BackendSearchSummary,
  filteredItems: Array<{ relativePath: string }>,
): BackendSearchSummary {
  if (!summary.readRecommendation) {
    return summary;
  }
  const survivingPaths = new Set(filteredItems.map((item) => item.relativePath));
  if (survivingPaths.has(summary.readRecommendation.relativePath)) {
    return summary;
  }
  const { readRecommendation: _dropped, ...rest } = summary;
  return rest;
}

async function callToolText(
  runtime: FffMcpRuntime,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  return await runtime.callTool(name, args);
}

/**
 * Default readiness-poll deadline. Measured cold-start times for stock
 * fff-mcp: ~0.5s for a typical personal repo (~30k files), ~5.5s for a
 * large monorepo (~617k files). 30s gives ~5× headroom on the worst
 * case we've observed while still failing fast when the backend is
 * genuinely broken. Callers can tighten or extend this via
 * `FFF_ROUTER_FFF_MCP_READY_TIMEOUT_MS` or by passing `deadlineMs`
 * explicitly.
 */
export const DEFAULT_FFF_MCP_READY_TIMEOUT_MS = 30_000;
const FFF_MCP_READY_INITIAL_DELAY_MS = 100;
const FFF_MCP_READY_MAX_DELAY_MS = 2_000;
const FFF_MCP_READY_BACKOFF_FACTOR = 1.5;

export interface WaitForFffMcpReadyOptions {
  /** Total budget (in ms) before we give up and throw. */
  deadlineMs?: number;
  /** Initial delay between polls; backs off exponentially. */
  initialDelayMs?: number;
  /** Upper bound for the exponential backoff between polls. */
  maxDelayMs?: number;
  /** Injectable `setTimeout`-style delay for tests. */
  delay?: (ms: number) => Promise<void>;
  /** Injectable wall-clock for tests. */
  now?: () => number;
}

function readEnvReadyTimeoutMs(): number {
  const raw = process.env.FFF_ROUTER_FFF_MCP_READY_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_FFF_MCP_READY_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_FFF_MCP_READY_TIMEOUT_MS;
  }
  return parsed;
}

/**
 * Poll fff-mcp until its corpus has finished indexing or the deadline
 * elapses. Returns the last probe text on success so callers can log or
 * forward it. On timeout, throws an error that includes the last observed
 * indexed count (if any) and how long we waited, to make "too slow" vs
 * "never started" debuggable from a single log line.
 *
 * Cold-start readiness is inferred from stock fff-mcp's `(N indexed)`
 * preamble on `find_files` output: `(0 indexed)` means the indexer has
 * not surfaced any files yet, anything else means it is queryable.
 */
export async function waitForFffMcpReady(
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>,
  optionsOrDelay: WaitForFffMcpReadyOptions | ((ms: number) => Promise<void>) = {},
): Promise<string> {
  // Back-compat: the previous signature accepted a bare delay function.
  const options: WaitForFffMcpReadyOptions =
    typeof optionsOrDelay === "function" ? { delay: optionsOrDelay } : optionsOrDelay;

  const delay = options.delay ?? sleep;
  const now = options.now ?? Date.now;
  const deadlineMs = options.deadlineMs ?? readEnvReadyTimeoutMs();
  const initialDelayMs = options.initialDelayMs ?? FFF_MCP_READY_INITIAL_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? FFF_MCP_READY_MAX_DELAY_MS;

  const started = now();
  const deadlineAt = started + deadlineMs;
  let nextDelay = initialDelayMs;
  let lastIndexedCount: number | null = null;

  // Always run at least one probe so a tiny `deadlineMs` still gets a
  // shot at observing a hot cache.
  while (true) {
    const text = await callTool("find_files", { query: "a", maxResults: 1 });
    const indexedMatch = text.match(/\((\d+)\s+indexed\)/i);
    if (!indexedMatch || Number(indexedMatch[1]) > 0) {
      return text;
    }
    lastIndexedCount = Number(indexedMatch[1]);

    const remaining = deadlineAt - now();
    if (remaining <= 0) {
      break;
    }

    const waitMs = Math.min(nextDelay, remaining, maxDelayMs);
    await delay(waitMs);
    nextDelay = Math.min(Math.ceil(nextDelay * FFF_MCP_READY_BACKOFF_FACTOR), maxDelayMs);
  }

  const waitedMs = now() - started;
  const indexedSuffix =
    lastIndexedCount === null ? "" : " (last probe reported " + lastIndexedCount + " indexed)";
  throw new Error(
    "fff-mcp did not finish indexing within " +
      waitedMs +
      "ms" +
      indexedSuffix +
      ". Raise FFF_ROUTER_FFF_MCP_READY_TIMEOUT_MS if this repository is large.",
  );
}

export function createFffMcpStdioAdapter(): SearchBackendAdapter<FffMcpRuntime> {
  return {
    backendId: "fff-mcp",
    supportedQueryKinds: ["find_files", "search_terms", "grep"],
    async startRuntime(args) {
      const transport = new StdioClientTransport({
        command: discoverFffMcpCommand(),
        args: [args.persistenceRoot],
        cwd: args.persistenceRoot,
        env: inheritedStringEnv(),
        stderr: "pipe",
      });
      const client = new Client(
        { name: "fff-router-fff-mcp", version: "1.0.0" },
        { capabilities: {} },
      );
      await client.connect(transport);

      const runtime: FffMcpRuntime = {
        id: `fff-mcp::${args.persistenceRoot}`,
        async close() {
          await client.close().catch(() => {});
          await transport.close().catch(() => {});
        },
        async callTool(name, args) {
          const response = (await client.callTool({ name, arguments: args })) as {
            isError?: boolean;
            content?: Array<{ type?: string; text?: string }>;
          };
          const text = response.content?.find((entry) => entry.type === "text")?.text;
          if (response.isError || typeof text !== "string") {
            throw new Error(text || `fff-mcp ${name} call failed`);
          }
          return text;
        },
      };

      // Warmup can be slow on large monorepos; any error here must tear
      // down the spawned child, otherwise it keeps running unsupervised
      // while the caller retries (leaking one fff-mcp per attempt).
      // RuntimeManager.getOrStartRuntime's catch branch deletes its map
      // entry but has no runtime handle to close, so the cleanup has to
      // happen here before we rethrow.
      try {
        await waitForFffMcpReady(runtime.callTool.bind(runtime));
      } catch (error) {
        await Promise.resolve(runtime.close()).catch(() => {});
        throw error;
      }
      return runtime;
    },
    async execute(args) {
      if (!args.runtime) {
        return backendUnavailable("fff-mcp runtime is not available");
      }

      try {
        switch (args.request.queryKind) {
          case "find_files": {
            const text = await callToolText(args.runtime, "find_files", {
              query: compileFindFilesQuery(args.request),
              maxResults: args.request.limit,
            });
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "find_files",
                items: filterItems(
                  args.request,
                  parseFindFilesOutput(text, args.request.persistenceRoot),
                ),
                nextCursor: null,
              },
            };
          }
          case "search_terms": {
            const text = await callToolText(args.runtime, "multi_grep", {
              patterns: args.request.terms,
              constraints: compileConstraints(args.request),
              maxResults: args.request.limit,
              context: args.request.contextLines,
            });
            const parsed = parseTextMatchOutput(text, args.request.persistenceRoot);
            const filteredItems = filterItems(args.request, parsed.items);
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "search_terms",
                items: filteredItems,
                nextCursor: null,
                renderedCompact: rewriteRenderedCompactIfNeeded(text, parsed.items, filteredItems),
                summary: narrowSummaryToSurvivingPaths(parsed.summary, filteredItems),
              },
            };
          }
          case "grep": {
            // Route based on the caller's explicit literal flag. `multi_grep`
            // is fff-mcp's literal-only path (patterns stay intact, no DSL
            // shredding). `grep` is the regex path, with whitespace encoded
            // so the DSL parser doesn't split the pattern into tokens.
            const text = args.request.literal
              ? await callToolText(args.runtime, "multi_grep", {
                  patterns: args.request.patterns,
                  constraints: compileConstraints(args.request),
                  maxResults: args.request.limit,
                  context: args.request.contextLines,
                })
              : await callToolText(args.runtime, "grep", {
                  query: compileGrepQuery(args.request),
                  maxResults: args.request.limit,
                });
            const parsed = parseTextMatchOutput(text, args.request.persistenceRoot);
            const filteredItems = filterItems(args.request, parsed.items);
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "grep",
                items: filteredItems,
                nextCursor: null,
                renderedCompact: rewriteRenderedCompactIfNeeded(text, parsed.items, filteredItems),
                summary: narrowSummaryToSurvivingPaths(parsed.summary, filteredItems),
              },
            };
          }
        }
      } catch (error) {
        return searchFailed(error instanceof Error ? error.message : String(error));
      }
    },
  };
}
