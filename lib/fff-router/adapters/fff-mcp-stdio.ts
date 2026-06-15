import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ValidatedWithinEntry } from "../types";
import { filterItems } from "./common";
import { resolveToolCommand } from "../tool-resolution";
import type {
  BackendResultItem,
  BackendSearchResult,
  BackendSearchSummary,
  SearchBackendAdapter,
  SearchBackendRuntime,
} from "./types";

type FffMcpRuntime = SearchBackendRuntime & {
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>;
};

type TextMatchRequest = Extract<
  Parameters<SearchBackendAdapter<FffMcpRuntime>["execute"]>[0]["request"],
  { queryKind: "search_terms" | "grep" }
>;
type TextMatchItem = ReturnType<typeof parseTextMatchOutput>["items"][number];
type EvaluatedTextMatchPage = ReturnType<typeof evaluateTextMatchPage>;

const MAX_FILTERED_CURSOR_PAGES = 20;

type FffMcpClient = {
  connect: (transport: FffMcpTransport) => Promise<void>;
  close: () => Promise<void> | void;
  callTool: (args: { name: string; arguments: Record<string, unknown> }) => Promise<unknown>;
};

type FffMcpTransport = {
  pid?: number | null;
  onclose?: () => void;
  close: () => Promise<void> | void;
};

type FffMcpTransportParams = ConstructorParameters<typeof StdioClientTransport>[0];

type CreateFffMcpStdioAdapterOptions = {
  createClient?: () => FffMcpClient;
  createTransport?: (params: FffMcpTransportParams) => FffMcpTransport;
  waitForReady?: (
    callTool: (name: string, args: Record<string, unknown>) => Promise<string>,
  ) => Promise<string>;
  closeTimeoutMs?: number;
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
  const resolution = resolveToolCommand("fff-mcp");
  if (!resolution.command || !resolution.executable) {
    throw new Error(resolution.remediation ?? "fff-mcp is not available");
  }
  return resolution.command;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function closeBestEffort(
  close: () => Promise<void> | void,
  timeoutMs: number,
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      Promise.resolve()
        .then(close)
        .catch(() => {}),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, timeoutMs);
        timeout.unref?.();
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
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

const GLOB_META_PATTERN = /[*?[\]{}!]/;

function compileFffMcpGlobConstraint(glob: string): string {
  const normalized = normalizeRelative(glob);
  if (
    !normalized.includes("/") ||
    normalized.startsWith("**/") ||
    normalized.endsWith("/") ||
    GLOB_META_PATTERN.test(normalized)
  ) {
    return glob;
  }

  return `**/${normalized}`;
}

function formatExcludeConstraint(excludePath: string): string {
  return excludePath.includes(".") || excludePath.endsWith("/")
    ? `!${excludePath}`
    : `!${excludePath}/`;
}

/**
 * Encode a single validated within entry into the DSL token fff-mcp uses for
 * file-vs-directory scoping:
 *
 * - File entries become anchored-glob tokens `**\/rel/path/file.ts` — the
 *   only form fff-mcp treats as an exact-file pin (bare path tokens are
 *   fuzzy filename hints, not filters).
 * - Directory entries become recursive-glob tokens `rel/dir/**` — trailing
 *   `/` alone does NOT restrict to that dir's files in fff-mcp's DSL
 *   (probing shows it matches nothing). `**` is required for the intended
 *   "files anywhere under this dir" semantics.
 *
 * Returns null if the entry normalizes to the persistence root itself,
 * meaning no scoping constraint is needed.
 */
function encodeWithinEntryToken(
  entry: Pick<ValidatedWithinEntry, "basePath" | "fileRestriction">,
  persistenceRoot: string,
): string | null {
  if (entry.fileRestriction) {
    const relativeFile = normalizeRelative(path.relative(persistenceRoot, entry.fileRestriction));
    if (!relativeFile || relativeFile === ".") {
      return null;
    }
    return `**/${relativeFile}`;
  }

  const baseRelative = normalizeRelative(path.relative(persistenceRoot, entry.basePath));
  if (!baseRelative || baseRelative === ".") {
    return null;
  }
  const withoutTrailingSlash = baseRelative.replace(/\/+$/, "");
  return `${withoutTrailingSlash}/**`;
}

/**
 * Compile a brace-expanded within token `{tokenA,tokenB,...}` for multi-path
 * requests. fff-mcp's constraint DSL supports brace expansion for both files
 * and directories as long as each directory term carries a `/**\/` or `*`
 * suffix; `encodeWithinEntryToken` handles that. Returns null if every entry
 * collapses to the persistence root (no scoping needed).
 */
function compileMultiWithinConstraint(
  entries: Array<Pick<ValidatedWithinEntry, "basePath" | "fileRestriction">>,
  persistenceRoot: string,
): string | null {
  const tokens: string[] = [];
  for (const entry of entries) {
    const token = encodeWithinEntryToken(entry, persistenceRoot);
    if (token !== null) {
      tokens.push(token);
    }
  }
  if (tokens.length === 0) {
    return null;
  }
  if (tokens.length === 1) {
    return tokens[0] ?? null;
  }
  return `{${tokens.join(",")}}`;
}

function buildConstraintTokens(request: {
  persistenceRoot: string;
  basePath: string;
  fileRestriction?: string;
  additionalWithinEntries?: ValidatedWithinEntry[];
  glob?: string;
  extensions: string[];
  excludePaths: string[];
}): string[] {
  const tokens: string[] = [];
  const additional = request.additionalWithinEntries ?? [];

  if (additional.length > 0) {
    // Multi-path: compile `{entryA,entryB,...}` from every entry (primary
    // plus extras). fff-mcp unions the brace alternatives, which matches
    // the union semantics of `grep PAT file1 file2 ...`.
    const multi = compileMultiWithinConstraint(
      [
        {
          basePath: request.basePath,
          ...(request.fileRestriction !== undefined
            ? { fileRestriction: request.fileRestriction }
            : {}),
        },
        ...additional,
      ],
      request.persistenceRoot,
    );
    if (multi !== null) {
      tokens.push(multi);
    }
  } else if (request.fileRestriction) {
    // Single-file form — anchored glob. See `encodeWithinEntryToken` for
    // the rationale (bare path tokens are fuzzy hints, not exact pins).
    const relativeFile = normalizeRelative(
      path.relative(request.persistenceRoot, request.fileRestriction),
    );
    if (relativeFile && relativeFile !== ".") {
      tokens.push(`**/${relativeFile}`);
    }
  } else {
    // Single-dir form — dir-prefix token with trailing slash.
    const baseRelative = normalizeRelative(
      path.relative(request.persistenceRoot, request.basePath),
    );
    if (baseRelative && baseRelative !== ".") {
      tokens.push(baseRelative.endsWith("/") ? baseRelative : `${baseRelative}/`);
    }
  }

  if (request.glob) {
    tokens.push(compileFffMcpGlobConstraint(request.glob));
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

function parseNextCursor(line: string): string | null {
  const cursorLine = line.match(/^cursor:\s*(.+)$/);
  if (cursorLine?.[1]) {
    return cursorLine[1].trim().replace(/^"|"$/g, "");
  }

  const quoted = line.match(/\bcursor="([^"]+)"/);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  const bare = line.match(/\bcursor=([^\s\]]+)/);
  if (bare?.[1]) {
    return bare[1].trim().replace(/^"|"$/g, "");
  }

  return null;
}

function parseFindFilesOutput(text: string, persistenceRoot: string) {
  const items: Array<{ path: string; relativePath: string }> = [];
  const summary: BackendSearchSummary = {};
  let nextCursor: string | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const cursor = parseNextCursor(line);
    if (cursor) {
      nextCursor = cursor;
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

    if (!line || line.startsWith("→") || /^0\s+results/.test(line)) {
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

  return { items, summary, nextCursor };
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
  const match = line.match(/^(\d+)\/(\d+)\s+matches(?:\s+shown)?$/);
  if (!match) {
    return {};
  }

  return {
    shownCount: Number(match[1]),
    totalCount: Number(match[2]),
  };
}

function filterRenderedFindFilesText(
  text: string,
  keep: (relativePath: string) => boolean,
): string {
  const out: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    const readRecommendation = parseReadRecommendation(line);
    if (readRecommendation) {
      if (keep(readRecommendation.relativePath)) {
        out.push(rawLine);
      }
      continue;
    }

    if (
      !line ||
      parseNextCursor(line) !== null ||
      /^\d+\/\d+\s+matches(?:\s+shown)?$/.test(line) ||
      /^0\s+results/.test(line)
    ) {
      out.push(rawLine);
      continue;
    }

    const relativePath = stripFindFilesSuffix(line);
    if (relativePath && keep(relativePath)) {
      out.push(rawLine);
    }
  }

  return out.join("\n");
}

/**
 * Walks an fff-mcp compact-text response and keeps only the path blocks whose
 * header relative-path satisfies `keep`. Preamble lines (`N/M matches shown`,
 * `0 matches`, `0 exact matches`, `cursor:…`, blanks) pass through this
 * low-level filter so callers can decide which metadata to preserve or strip;
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
  let nextCursor: string | null = null;
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
    if (!line) {
      continue;
    }

    const cursor = parseNextCursor(line);
    if (cursor) {
      nextCursor = cursor;
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

  return { items, summary, nextCursor };
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
): string | undefined {
  const survivingPaths = new Set(filteredItems.map((item) => item.relativePath));
  const somethingDropped = originalItems.some((item) => !survivingPaths.has(item.relativePath));
  const filteredText = somethingDropped
    ? filterRenderedCompactText(text, (relativePath) => survivingPaths.has(relativePath))
    : text;
  const withoutCursor = stripUnsupportedCursorLines(filteredText);

  if (isMetadataOnlyCompactText(withoutCursor)) {
    return undefined;
  }

  return withoutCursor;
}

function stripUnsupportedCursorLines(text: string): string {
  let removed = false;
  const lines = text.split(/\r?\n/).filter((rawLine) => {
    const line = rawLine.trimEnd();
    if (line.startsWith("cursor:")) {
      removed = true;
      return false;
    }
    return true;
  });

  return removed ? lines.join("\n").trimEnd() : text;
}

function isMetadataOnlyCompactText(text: string): boolean {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || /^\d+\/\d+\s+matches\s+shown$/.test(line)) {
      continue;
    }
    return false;
  }

  return true;
}

function extractUnsupportedCursor(text: string): string | null {
  for (const rawLine of text.split(/\r?\n/)) {
    const match = rawLine.trimEnd().match(/^cursor:\s*(\S+)\s*$/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function evaluateTextMatchPage(request: TextMatchRequest, text: string) {
  const parsed = parseTextMatchOutput(text, request.persistenceRoot);
  const filteredItems = filterItems(request, parsed.items).filter(isTextMatchItem);

  return {
    text,
    parsed,
    filteredItems,
  };
}

function isTextMatchItem(item: BackendResultItem): item is TextMatchItem {
  return (
    typeof (item as { line?: unknown }).line === "number" &&
    typeof (item as { text?: unknown }).text === "string"
  );
}

function renderSyntheticTextMatchCompact(items: TextMatchItem[]): string | undefined {
  if (items.length === 0) {
    return undefined;
  }

  const label = items.length === 1 ? "filtered match" : "filtered matches";
  const lines = [`${items.length} ${label} shown`];
  for (const item of items) {
    lines.push(`${item.relativePath}${item.isDefinition ? " [def]" : ""}`);
    lines.push(` ${item.line}: ${item.text}`);
  }

  return lines.join("\n");
}

function renderDrainedTextMatchCompact(
  pages: EvaluatedTextMatchPage[],
  items: TextMatchItem[],
): string | undefined {
  if (pages.length <= 1) {
    const page = pages[0];
    if (!page) {
      return undefined;
    }
    return rewriteRenderedCompactIfNeeded(page.text, page.parsed.items, page.filteredItems);
  }

  return renderSyntheticTextMatchCompact(items);
}

function summarizeDrainedTextMatchPages(
  pages: EvaluatedTextMatchPage[],
  collectedItems: TextMatchItem[],
): BackendSearchSummary {
  if (pages.length <= 1) {
    const page = pages[0];
    if (!page) {
      return {};
    }
    return summarizeFilteredTextMatchPage(page.parsed.summary, page.filteredItems);
  }

  if (collectedItems.length === 0) {
    return {};
  }

  return { shownCount: collectedItems.length };
}

function summarizeFilteredTextMatchPage(
  summary: BackendSearchSummary,
  filteredItems: Array<{ relativePath: string }>,
): BackendSearchSummary {
  if (filteredItems.length === 0) {
    return {};
  }

  return narrowSummaryToSurvivingPaths(summary, filteredItems);
}

async function executeTextMatchWithFilteredCursorDrain(
  runtime: FffMcpRuntime,
  toolName: "multi_grep" | "grep",
  baseArguments: Record<string, unknown>,
  request: TextMatchRequest,
) {
  let text = await callToolText(runtime, toolName, baseArguments);
  let page = evaluateTextMatchPage(request, text);
  const pages = [page];
  const collectedItems: TextMatchItem[] = [...page.filteredItems];
  const seenCursors = new Set<string>();
  let repeatedCursor: string | undefined;
  let pageCapHit = false;
  let nextCursor = page.parsed.nextCursor ?? extractUnsupportedCursor(text);

  while (collectedItems.length < request.limit) {
    if (nextCursor === null) {
      break;
    }
    if (seenCursors.has(nextCursor)) {
      repeatedCursor = nextCursor;
      break;
    }
    if (pages.length >= MAX_FILTERED_CURSOR_PAGES) {
      pageCapHit = true;
      break;
    }

    seenCursors.add(nextCursor);
    text = await callToolText(runtime, toolName, { ...baseArguments, cursor: nextCursor });
    page = evaluateTextMatchPage(request, text);
    pages.push(page);
    collectedItems.push(...page.filteredItems);
    nextCursor = page.parsed.nextCursor ?? extractUnsupportedCursor(text);
  }

  const items = collectedItems.slice(0, request.limit);
  const filteredOutCount = pages.reduce(
    (count, drainedPage) =>
      count + Math.max(0, drainedPage.parsed.items.length - drainedPage.filteredItems.length),
    0,
  );
  return {
    items,
    nextCursor,
    renderedCompact: renderDrainedTextMatchCompact(pages, items),
    summary: summarizeDrainedTextMatchPages(pages, items),
    diagnostics: {
      cursorDrain: {
        pagesFetched: pages.length,
        filteredOutCount,
        ...(repeatedCursor ? { repeatedCursor } : {}),
        pageCapHit,
      },
    },
  };
}

function rewriteRenderedFindFilesIfNeeded(
  text: string,
  originalItems: Array<{ relativePath: string }>,
  filteredItems: Array<{ relativePath: string }>,
): string {
  const survivingPaths = new Set(filteredItems.map((item) => item.relativePath));
  const somethingDropped = originalItems.some((item) => !survivingPaths.has(item.relativePath));
  if (!somethingDropped) {
    return text;
  }
  return filterRenderedFindFilesText(text, (relativePath) => survivingPaths.has(relativePath));
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

export function createFffMcpStdioAdapter(
  options: CreateFffMcpStdioAdapterOptions = {},
): SearchBackendAdapter<FffMcpRuntime> {
  return {
    backendId: "fff-mcp",
    supportedQueryKinds: ["find_files", "search_terms", "grep"],
    async startRuntime(args) {
      const transportParams = {
        command: discoverFffMcpCommand(),
        args: [args.persistenceRoot],
        cwd: args.persistenceRoot,
        env: inheritedStringEnv(),
        stderr: "pipe",
      } satisfies FffMcpTransportParams;
      const transport: FffMcpTransport =
        options.createTransport?.(transportParams) ??
        (new StdioClientTransport(transportParams) as FffMcpTransport);
      const client: FffMcpClient =
        options.createClient?.() ??
        (new Client(
          { name: "fff-router-fff-mcp", version: "1.0.0" },
          { capabilities: {} },
        ) as unknown as FffMcpClient);
      await client.connect(transport);

      let closed = false;
      const closeHandlers = new Set<() => void>();
      const markClosed = () => {
        if (closed) {
          return;
        }
        closed = true;
        for (const handler of closeHandlers) {
          handler();
        }
      };
      const previousOnClose = transport.onclose;
      transport.onclose = () => {
        markClosed();
        previousOnClose?.();
      };

      const runtime: FffMcpRuntime = {
        id: `fff-mcp::${args.persistenceRoot}`,
        get pid() {
          return transport.pid ?? null;
        },
        onClose(handler) {
          closeHandlers.add(handler);
          return () => {
            closeHandlers.delete(handler);
          };
        },
        async close() {
          markClosed();
          const closeTimeoutMs = options.closeTimeoutMs ?? 500;
          await closeBestEffort(() => client.close(), closeTimeoutMs);
          await closeBestEffort(() => transport.close(), closeTimeoutMs);
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
        await (options.waitForReady ?? waitForFffMcpReady)(runtime.callTool.bind(runtime));
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
              ...(args.request.cursor !== null && args.request.cursor !== undefined
                ? { cursor: args.request.cursor }
                : {}),
            });
            const parsed = parseFindFilesOutput(text, args.request.persistenceRoot);
            const filteredItems = filterItems(args.request, parsed.items);
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "find_files",
                items: filteredItems,
                nextCursor: parsed.nextCursor,
                renderedCompact: rewriteRenderedFindFilesIfNeeded(
                  text,
                  parsed.items,
                  filteredItems,
                ),
                summary: narrowSummaryToSurvivingPaths(parsed.summary, filteredItems),
              },
            };
          }
          case "search_terms": {
            const value = await executeTextMatchWithFilteredCursorDrain(
              args.runtime,
              "multi_grep",
              {
                patterns: args.request.terms,
                constraints: compileConstraints(args.request),
                maxResults: args.request.limit,
                context: args.request.contextLines,
                ...(args.request.cursor !== null && args.request.cursor !== undefined
                  ? { cursor: args.request.cursor }
                  : {}),
              },
              args.request,
            );
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "search_terms",
                ...value,
              },
            };
          }
          case "grep": {
            // Route based on the caller's explicit literal flag. `multi_grep`
            // is fff-mcp's literal-only path (patterns stay intact, no DSL
            // shredding). `grep` is the regex path, with whitespace encoded
            // so the DSL parser doesn't split the pattern into tokens.
            const toolName = args.request.literal ? "multi_grep" : "grep";
            const toolArguments = args.request.literal
              ? {
                  patterns: args.request.patterns,
                  constraints: compileConstraints(args.request),
                  maxResults: args.request.limit,
                  context: args.request.contextLines,
                  ...(args.request.cursor !== null && args.request.cursor !== undefined
                    ? { cursor: args.request.cursor }
                    : {}),
                }
              : {
                  query: compileGrepQuery(args.request),
                  maxResults: args.request.limit,
                  ...(args.request.cursor !== null && args.request.cursor !== undefined
                    ? { cursor: args.request.cursor }
                    : {}),
                };
            const value = await executeTextMatchWithFilteredCursorDrain(
              args.runtime,
              toolName,
              toolArguments,
              args.request,
            );
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "grep",
                ...value,
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
