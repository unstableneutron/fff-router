// lib/fff-router/adapters/fff-mcp-stdio.ts
import path3 from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// lib/fff-router/adapters/common.ts
import path from "node:path";
import picomatch from "picomatch";
function normalizeRelativePath(relativePath) {
  return relativePath.replace(/\\/g, "/");
}
function matchesSingleEntry(entry, candidatePath) {
  if (entry.fileRestriction) {
    return candidatePath === entry.fileRestriction;
  }
  return candidatePath === entry.within || candidatePath.startsWith(entry.within + path.sep);
}
function pathWithinScope(request, candidatePath) {
  if (matchesSingleEntry(
    {
      within: request.within,
      ...request.fileRestriction !== void 0 ? { fileRestriction: request.fileRestriction } : {}
    },
    candidatePath
  )) {
    return true;
  }
  for (const entry of request.additionalWithinEntries ?? []) {
    if (matchesSingleEntry(
      {
        within: entry.resolvedWithin,
        ...entry.fileRestriction !== void 0 ? { fileRestriction: entry.fileRestriction } : {}
      },
      candidatePath
    )) {
      return true;
    }
  }
  return false;
}
function matchesExtension(extensions, relativePath) {
  if (extensions.length === 0) {
    return true;
  }
  return extensions.some(
    (extension2) => normalizeRelativePath(relativePath).endsWith(`.${extension2}`)
  );
}
function matchesGlob(glob2, relativePath) {
  if (!glob2) {
    return true;
  }
  return picomatch(glob2, {
    dot: true,
    basename: !glob2.includes("/")
  })(normalizeRelativePath(relativePath));
}
function matchesExcludePaths(excludePaths, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return !excludePaths.some((excludePath) => {
    if (/[*?[\]{}!]/.test(excludePath)) {
      return picomatch(excludePath, { dot: true, basename: !excludePath.includes("/") })(
        normalized
      );
    }
    return normalized === excludePath || normalized.startsWith(`${excludePath}/`);
  });
}
function filterItems(request, items) {
  return items.filter((item) => pathWithinScope(request, item.path)).filter((item) => matchesGlob(request.glob, item.relativePath)).filter((item) => matchesExtension(request.extensions, item.relativePath)).filter((item) => matchesExcludePaths(request.excludePaths, item.relativePath)).slice(0, request.limit);
}

// lib/fff-router/tool-resolution.ts
import { constants as fsConstants, accessSync, existsSync } from "node:fs";
import os from "node:os";
import path2 from "node:path";
var TOOL_ENV_VARS = {
  "fff-mcp": "FFF_ROUTER_FFF_MCP_BIN"
};
function managedInstallPath(env) {
  const installDir = env.FFF_MCP_INSTALL_DIR || path2.join(env.HOME || os.homedir(), ".local", "bin");
  return path2.join(installDir, process.platform === "win32" ? "fff-mcp.exe" : "fff-mcp");
}
function isExecutable(pathValue) {
  try {
    accessSync(pathValue, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function commandExtensions(env) {
  if (process.platform !== "win32") {
    return [""];
  }
  const pathExt = env.PATHEXT?.split(";").filter(Boolean);
  return pathExt && pathExt.length > 0 ? pathExt : [".EXE", ".CMD", ".BAT", ".COM"];
}
function resolveExecutableOnPath(command, env = process.env) {
  const pathValue = env.PATH || process.env.PATH || "";
  const directories = pathValue.split(path2.delimiter).filter(Boolean);
  const extensions = commandExtensions(env);
  for (const directory of directories) {
    for (const extension2 of extensions) {
      const candidatePath = process.platform === "win32" && extension2 && !command.toUpperCase().endsWith(extension2) ? path2.join(directory, `${command}${extension2}`) : path2.join(directory, command);
      if (existsSync(candidatePath) && isExecutable(candidatePath)) {
        return candidatePath;
      }
    }
  }
  return null;
}
function remediation(tool, envVar) {
  return `Install ${tool} or set ${envVar} to an executable path.`;
}
function resolveToolCommand(tool, deps = {}) {
  const env = deps.env ?? process.env;
  const envVar = TOOL_ENV_VARS[tool];
  const executableCheck = deps.isExecutable ?? isExecutable;
  const override = env[envVar];
  if (override) {
    const executable = executableCheck(override);
    return {
      tool,
      command: override,
      source: "env",
      envVar,
      executable,
      ...!executable ? { remediation: remediation(tool, envVar) } : {}
    };
  }
  const pathCommand = (deps.resolveExecutableOnPath ?? ((command) => resolveExecutableOnPath(command, env)))(tool);
  if (pathCommand) {
    return {
      tool,
      command: pathCommand,
      source: "path",
      envVar,
      executable: executableCheck(pathCommand),
      ...!executableCheck(pathCommand) ? { remediation: remediation(tool, envVar) } : {}
    };
  }
  const managedCommand = managedInstallPath(env);
  if (existsSync(managedCommand)) {
    const executable = executableCheck(managedCommand);
    return {
      tool,
      command: managedCommand,
      source: "managed",
      envVar,
      executable,
      ...!executable ? { remediation: remediation(tool, envVar) } : {}
    };
  }
  return {
    tool,
    command: null,
    source: "missing",
    envVar,
    executable: false,
    remediation: remediation(tool, envVar)
  };
}

// lib/fff-router/adapters/fff-mcp-stdio.ts
var MAX_FILTERED_CURSOR_PAGES = 20;
function searchFailed(message) {
  return {
    ok: false,
    error: {
      code: "SEARCH_FAILED",
      backendId: "fff-mcp",
      message
    }
  };
}
function discoverFffMcpCommand() {
  const resolution = resolveToolCommand("fff-mcp");
  if (!resolution.command || !resolution.executable) {
    throw new Error(resolution.remediation ?? "fff-mcp is not available");
  }
  return resolution.command;
}
async function closeBestEffort(close, timeoutMs) {
  let timeout = null;
  try {
    await Promise.race([
      Promise.resolve().then(close).catch(() => {
      }),
      new Promise((resolve) => {
        timeout = setTimeout(resolve, timeoutMs);
        timeout.unref?.();
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
function inheritedStringEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry) => typeof entry[1] === "string"
    )
  );
}
function normalizeRelative(relativePath) {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}
var GLOB_META_PATTERN = /[*?[\]{}!]/;
var UNSAFE_SCOPE_PATH_PATTERN = /[\s,*?[\]{}!]/;
function compileFffMcpGlobConstraint(glob2) {
  const normalized = normalizeRelative(glob2);
  if (!normalized.includes("/") || normalized.startsWith("**/") || normalized.endsWith("/") || GLOB_META_PATTERN.test(normalized)) {
    return glob2;
  }
  return `**/${normalized}`;
}
function formatExcludeConstraint(excludePath) {
  return excludePath.includes(".") || excludePath.endsWith("/") ? `!${excludePath}` : `!${excludePath}/`;
}
function encodeWithinEntryToken(entry, persistenceRoot) {
  if (entry.fileRestriction) {
    const relativeFile = normalizeRelative(path3.relative(persistenceRoot, entry.fileRestriction));
    if (!relativeFile || relativeFile === "." || UNSAFE_SCOPE_PATH_PATTERN.test(relativeFile)) {
      return null;
    }
    return `**/${relativeFile}`;
  }
  const baseRelative = normalizeRelative(path3.relative(persistenceRoot, entry.basePath));
  if (!baseRelative || baseRelative === "." || UNSAFE_SCOPE_PATH_PATTERN.test(baseRelative)) {
    return null;
  }
  const withoutTrailingSlash = baseRelative.replace(/\/+$/, "");
  return `${withoutTrailingSlash}/**`;
}
function compileMultiWithinConstraint(entries, persistenceRoot) {
  const tokens = [];
  for (const entry of entries) {
    const token = encodeWithinEntryToken(entry, persistenceRoot);
    if (token === null) {
      return null;
    }
    tokens.push(token);
  }
  if (tokens.length === 1) {
    return tokens[0] ?? null;
  }
  return `{${tokens.join(",")}}`;
}
function buildConstraintTokens(request) {
  const tokens = [];
  const additional = request.additionalWithinEntries ?? [];
  if (additional.length > 0) {
    const multi = compileMultiWithinConstraint(
      [
        {
          basePath: request.basePath,
          ...request.fileRestriction !== void 0 ? { fileRestriction: request.fileRestriction } : {}
        },
        ...additional
      ],
      request.persistenceRoot
    );
    if (multi !== null) {
      tokens.push(multi);
    }
  } else if (request.fileRestriction) {
    const token = encodeWithinEntryToken(
      {
        basePath: request.basePath,
        fileRestriction: request.fileRestriction
      },
      request.persistenceRoot
    );
    if (token !== null) {
      tokens.push(token);
    }
  } else {
    const token = encodeWithinEntryToken({ basePath: request.basePath }, request.persistenceRoot);
    if (token !== null) {
      tokens.push(token);
    }
  }
  if (request.glob) {
    tokens.push(compileFffMcpGlobConstraint(request.glob));
  }
  for (const extension2 of request.extensions) {
    tokens.push(`*.${extension2}`);
  }
  for (const excludePath of request.excludePaths) {
    tokens.push(formatExcludeConstraint(excludePath));
  }
  return tokens;
}
function compileFindFilesQuery(request) {
  return [request.query, ...buildConstraintTokens(request)].filter(Boolean).join(" ");
}
function compileConstraints(request) {
  return buildConstraintTokens(request).join(" ");
}
function compileGrepQuery(request) {
  const encodedPatterns = request.patterns.map(encodeFffMcpGrepPattern);
  const combinedPattern = encodedPatterns.length === 1 ? encodedPatterns[0] ?? "" : encodedPatterns.map((pattern) => `(?:${pattern})`).join("|");
  return [...buildConstraintTokens(request), combinedPattern].filter(Boolean).join(" ");
}
function encodeFffMcpGrepPattern(pattern) {
  return pattern.replace(/[ \t]/g, "\\s");
}
function stripFindFilesSuffix(line) {
  return line.replace(/\s+-\s+(hot|warm|frequent)(\s+git:[^\s]+)?$/, "").replace(/\s+git:[^\s]+$/, "").trim();
}
function parseNextCursor(line) {
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
function parseFindFilesOutput(text, persistenceRoot) {
  const items = [];
  const summary = {};
  let nextCursor = null;
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
    if (shownSummary.shownCount !== void 0 || shownSummary.totalCount !== void 0) {
      Object.assign(summary, shownSummary);
      continue;
    }
    if (!line || line.startsWith("\u2192") || /^0\s+results/.test(line)) {
      continue;
    }
    const relativePath = stripFindFilesSuffix(line);
    if (!relativePath) {
      continue;
    }
    items.push({
      path: path3.join(persistenceRoot, relativePath),
      relativePath
    });
  }
  return { items, summary, nextCursor };
}
function parseReadRecommendation(line) {
  const match = line.match(/^→\s+Read\s+(.+?)(?:\s+\((.+)\))?$/);
  if (!match) {
    return void 0;
  }
  const relativePath = match[1];
  const reason = match[2];
  if (!relativePath) {
    return void 0;
  }
  return {
    relativePath: normalizeRelative(relativePath.trim().replace(/\s+\[def\]$/, "")),
    ...reason ? { reason: reason.trim() } : {}
  };
}
function parseShownSummary(line) {
  const match = line.match(/^(\d+)\/(\d+)\s+matches(?:\s+shown)?$/);
  if (!match) {
    return {};
  }
  return {
    shownCount: Number(match[1]),
    totalCount: Number(match[2])
  };
}
function filterRenderedFindFilesText(text, keep) {
  const out = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const readRecommendation = parseReadRecommendation(line);
    if (readRecommendation) {
      if (keep(readRecommendation.relativePath)) {
        out.push(rawLine);
      }
      continue;
    }
    if (!line || parseNextCursor(line) !== null || /^\d+\/\d+\s+matches(?:\s+shown)?$/.test(line) || /^0\s+results/.test(line)) {
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
function filterRenderedCompactText(text, keep) {
  const out = [];
  let currentAccepted = true;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const readMatch = line.match(/^→\s+Read\s+(.+?)(?:\s+\((.+)\))?$/);
    if (readMatch) {
      const recPath = normalizeRelative((readMatch[1] ?? "").replace(/\s+\[def\]$/, "").trim());
      if (keep(recPath)) {
        out.push(rawLine);
      }
      continue;
    }
    if (!line || line.startsWith("cursor:") || /^\d+\/\d+\s+matches\s+shown$/.test(line) || /^0\s+matches/.test(line) || /^0\s+exact\s+matches/.test(line)) {
      out.push(rawLine);
      continue;
    }
    if (line === "--" || /^\s+\d+[:\-|]/.test(line)) {
      if (currentAccepted) {
        out.push(rawLine);
      }
      continue;
    }
    const headerPath = normalizeRelative(line.replace(/\s+\[[^\]]+\]$/, ""));
    currentAccepted = keep(headerPath);
    if (currentAccepted) {
      out.push(rawLine);
    }
  }
  return out.join("\n");
}
function parseTextMatchOutput(text, persistenceRoot) {
  const items = [];
  const summary = {};
  let nextCursor = null;
  let currentPath = null;
  let currentPathIsDefinition = false;
  let pendingBefore = [];
  let currentMatch = null;
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
    if (shownSummary.shownCount !== void 0 || shownSummary.totalCount !== void 0) {
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
          path: path3.join(persistenceRoot, currentPath),
          relativePath: currentPath,
          line: lineNumber,
          text: content,
          ...pendingBefore.length > 0 ? { contextBefore: [...pendingBefore] } : {},
          ...currentPathIsDefinition ? { isDefinition: true } : {}
        };
        items.push(currentMatch);
        pendingBefore = [];
        continue;
      }
      if (kind === "-") {
        if (currentMatch) {
          currentMatch.contextAfter = [...currentMatch.contextAfter ?? [], content];
        } else {
          pendingBefore.push(content);
        }
        continue;
      }
      if (kind === "|") {
        if (currentMatch) {
          if (currentMatch.isDefinition) {
            currentMatch.definitionBody = [...currentMatch.definitionBody ?? [], content];
          } else {
            currentMatch.contextAfter = [...currentMatch.contextAfter ?? [], content];
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
function rewriteRenderedCompactIfNeeded(text, originalItems, filteredItems) {
  const survivingPaths = new Set(filteredItems.map((item) => item.relativePath));
  const somethingDropped = originalItems.some((item) => !survivingPaths.has(item.relativePath));
  const filteredText = somethingDropped ? filterRenderedCompactText(text, (relativePath) => survivingPaths.has(relativePath)) : text;
  const renderedText = somethingDropped || filteredItems.length === 0 ? stripUnsupportedCursorLines(filteredText) : filteredText;
  if (isMetadataOnlyCompactText(renderedText)) {
    return void 0;
  }
  return renderedText;
}
function stripUnsupportedCursorLines(text) {
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
function isMetadataOnlyCompactText(text) {
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || /^\d+\/\d+\s+matches\s+shown$/.test(line)) {
      continue;
    }
    return false;
  }
  return true;
}
function extractUnsupportedCursor(text) {
  for (const rawLine of text.split(/\r?\n/)) {
    const match = rawLine.trimEnd().match(/^cursor:\s*(\S+)\s*$/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}
function evaluateTextMatchPage(request, text) {
  const parsed = parseTextMatchOutput(text, request.persistenceRoot);
  const filteredItems = filterItems(request, parsed.items).filter(isTextMatchItem);
  return {
    text,
    parsed,
    filteredItems
  };
}
function isTextMatchItem(item) {
  return typeof item.line === "number" && typeof item.text === "string";
}
function renderSyntheticTextMatchCompact(items) {
  if (items.length === 0) {
    return void 0;
  }
  const label = items.length === 1 ? "filtered match" : "filtered matches";
  const lines = [`${items.length} ${label} shown`];
  for (const item of items) {
    lines.push(`${item.relativePath}${item.isDefinition ? " [def]" : ""}`);
    lines.push(` ${item.line}: ${item.text}`);
  }
  return lines.join("\n");
}
function renderDrainedTextMatchCompact(pages, items) {
  if (pages.length <= 1) {
    const page = pages[0];
    if (!page) {
      return void 0;
    }
    return rewriteRenderedCompactIfNeeded(page.text, page.parsed.items, page.filteredItems);
  }
  return renderSyntheticTextMatchCompact(items);
}
function summarizeDrainedTextMatchPages(pages, collectedItems) {
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
function summarizeFilteredTextMatchPage(summary, filteredItems) {
  if (filteredItems.length === 0) {
    return {};
  }
  return narrowSummaryToSurvivingPaths(summary, filteredItems);
}
async function executeTextMatchWithFilteredCursorDrain(runtime, toolName, baseArguments, request) {
  let text = await callToolText(runtime, toolName, baseArguments);
  let page = evaluateTextMatchPage(request, text);
  const pages = [page];
  const collectedItems = [...page.filteredItems];
  const seenItems = new Set(
    collectedItems.map((item) => `${item.relativePath}\0${item.line}\0${item.text}`)
  );
  const seenCursors = /* @__PURE__ */ new Set();
  let repeatedCursor;
  let pageCapHit = false;
  let nextCursor = page.parsed.nextCursor ?? extractUnsupportedCursor(text);
  const shouldDrainFilteredPages = request.cursor === null || request.cursor === void 0;
  while (shouldDrainFilteredPages && collectedItems.length < request.limit) {
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
    text = await callToolText(runtime, toolName, {
      ...baseArguments,
      maxResults: Math.max(1, request.limit - collectedItems.length),
      cursor: nextCursor
    });
    page = evaluateTextMatchPage(request, text);
    pages.push(page);
    for (const item of page.filteredItems) {
      const key = `${item.relativePath}\0${item.line}\0${item.text}`;
      if (!seenItems.has(key)) {
        seenItems.add(key);
        collectedItems.push(item);
      }
    }
    nextCursor = page.parsed.nextCursor ?? extractUnsupportedCursor(text);
  }
  const items = collectedItems.slice(0, request.limit);
  const filteredOutCount = pages.reduce(
    (count, drainedPage) => count + Math.max(0, drainedPage.parsed.items.length - drainedPage.filteredItems.length),
    0
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
        ...repeatedCursor ? { repeatedCursor } : {},
        pageCapHit
      }
    }
  };
}
function rewriteRenderedFindFilesIfNeeded(text, originalItems, filteredItems) {
  const survivingPaths = new Set(filteredItems.map((item) => item.relativePath));
  const somethingDropped = originalItems.some((item) => !survivingPaths.has(item.relativePath));
  if (!somethingDropped) {
    return text;
  }
  const filtered = filterRenderedFindFilesText(
    text,
    (relativePath) => survivingPaths.has(relativePath)
  );
  const body = filtered.split(/\r?\n/).filter((line) => {
    const trimmed = line.trimEnd();
    return trimmed.length > 0 && parseNextCursor(trimmed) === null && !/^\d+\/\d+\s+matches(?:\s+shown)?$/.test(trimmed) && !/^0\s+results/.test(trimmed);
  });
  const label = filteredItems.length === 1 ? "filtered match" : "filtered matches";
  return [`${filteredItems.length} ${label} shown`, ...body].join("\n");
}
function evaluateFindFilesPage(request, text) {
  const parsed = parseFindFilesOutput(text, request.persistenceRoot);
  const filteredItems = filterItems(request, parsed.items).filter(isFindFileItem);
  return { text, parsed, filteredItems };
}
function isFindFileItem(item) {
  return !("line" in item);
}
function renderSyntheticFindFilesCompact(items) {
  const label = items.length === 1 ? "filtered match" : "filtered matches";
  return [`${items.length} ${label} shown`, ...items.map((item) => item.relativePath)].join("\n");
}
function renderDrainedFindFilesCompact(pages, items) {
  const page = pages[0];
  if (pages.length === 1 && page) {
    return rewriteRenderedFindFilesIfNeeded(page.text, page.parsed.items, page.filteredItems);
  }
  return renderSyntheticFindFilesCompact(items);
}
function summarizeDrainedFindFilesPages(pages, items) {
  const page = pages[0];
  if (pages.length === 1 && page) {
    return narrowSummaryToSurvivingPaths(page.parsed.summary, page.filteredItems);
  }
  return items.length > 0 ? { shownCount: items.length } : {};
}
async function executeFindFilesWithFilteredCursorDrain(runtime, request) {
  const query = compileFindFilesQuery(request);
  let text = await callToolText(runtime, "find_files", {
    query,
    maxResults: request.limit,
    ...request.cursor !== null && request.cursor !== void 0 ? { cursor: request.cursor } : {}
  });
  let page = evaluateFindFilesPage(request, text);
  const pages = [page];
  const collectedItems = [...page.filteredItems];
  const seenItems = new Set(collectedItems.map((item) => item.relativePath));
  const seenCursors = /* @__PURE__ */ new Set();
  let repeatedCursor;
  let pageCapHit = false;
  let nextCursor = page.parsed.nextCursor ?? extractUnsupportedCursor(text);
  const shouldDrainFilteredPages = request.cursor === null || request.cursor === void 0;
  while (shouldDrainFilteredPages && collectedItems.length < request.limit) {
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
    text = await callToolText(runtime, "find_files", {
      query,
      maxResults: Math.max(1, request.limit - collectedItems.length),
      cursor: nextCursor
    });
    page = evaluateFindFilesPage(request, text);
    pages.push(page);
    for (const item of page.filteredItems) {
      if (!seenItems.has(item.relativePath)) {
        seenItems.add(item.relativePath);
        collectedItems.push(item);
      }
    }
    nextCursor = page.parsed.nextCursor ?? extractUnsupportedCursor(text);
  }
  const items = collectedItems.slice(0, request.limit);
  const filteredOutCount = pages.reduce(
    (count, drainedPage) => count + Math.max(0, drainedPage.parsed.items.length - drainedPage.filteredItems.length),
    0
  );
  return {
    items,
    nextCursor,
    renderedCompact: renderDrainedFindFilesCompact(pages, items),
    summary: summarizeDrainedFindFilesPages(pages, items),
    diagnostics: {
      cursorDrain: {
        pagesFetched: pages.length,
        filteredOutCount,
        ...repeatedCursor ? { repeatedCursor } : {},
        pageCapHit
      }
    }
  };
}
function narrowSummaryToSurvivingPaths(summary, filteredItems) {
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
async function callToolText(runtime, name, args) {
  return await runtime.callTool(name, args);
}
var DEFAULT_FFF_MCP_READY_TIMEOUT_MS = 3e4;
function readEnvReadyTimeoutMs() {
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
async function waitForFffMcpReady(callTool, options = {}) {
  const deadlineMs = options.deadlineMs ?? readEnvReadyTimeoutMs();
  let timeout;
  try {
    return await Promise.race([
      callTool("find_files", { query: "a", maxResults: 1 }),
      new Promise((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(
            new Error(
              `fff-mcp readiness probe exceeded ${deadlineMs}ms. Raise FFF_ROUTER_FFF_MCP_READY_TIMEOUT_MS if this repository is large.`
            )
          ),
          deadlineMs
        );
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
function createFffMcpStdioAdapter(options = {}) {
  return {
    backendId: "fff-mcp",
    async startRuntime(args) {
      const transportParams = {
        command: (options.resolveCommand ?? discoverFffMcpCommand)(),
        args: [args.persistenceRoot, "--idle-timeout-secs", "0", "--no-update-check"],
        cwd: args.persistenceRoot,
        env: inheritedStringEnv(),
        stderr: "pipe"
      };
      const transport = options.createTransport?.(transportParams) ?? new StdioClientTransport(transportParams);
      const client = options.createClient?.() ?? new Client(
        { name: "fff-router-fff-mcp", version: "1.0.0" },
        { capabilities: {} }
      );
      try {
        await client.connect(transport);
      } catch (error2) {
        const closeTimeoutMs = options.closeTimeoutMs ?? 500;
        await closeBestEffort(() => client.close(), closeTimeoutMs);
        await closeBestEffort(() => transport.close(), closeTimeoutMs);
        throw error2;
      }
      let closed = false;
      const closeHandlers = /* @__PURE__ */ new Set();
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
      const runtime = {
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
        async callTool(name, args2) {
          const response = await client.callTool({ name, arguments: args2 });
          const text = response.content?.find((entry) => entry.type === "text")?.text;
          if (response.isError || typeof text !== "string") {
            throw new Error(text || `fff-mcp ${name} call failed`);
          }
          return text;
        }
      };
      try {
        await (options.waitForReady ?? waitForFffMcpReady)(runtime.callTool.bind(runtime));
      } catch (error2) {
        await Promise.resolve(runtime.close()).catch(() => {
        });
        throw error2;
      }
      return runtime;
    },
    async execute(args) {
      try {
        switch (args.request.queryKind) {
          case "find_files": {
            const value = await executeFindFilesWithFilteredCursorDrain(args.runtime, args.request);
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "find_files",
                ...value
              }
            };
          }
          case "grep": {
            const toolName = args.request.literal ? "multi_grep" : "grep";
            const toolArguments = args.request.literal ? {
              patterns: args.request.patterns,
              constraints: compileConstraints(args.request),
              maxResults: args.request.limit,
              context: args.request.contextLines,
              ...args.request.cursor !== null && args.request.cursor !== void 0 ? { cursor: args.request.cursor } : {}
            } : {
              query: compileGrepQuery(args.request),
              maxResults: args.request.limit,
              ...args.request.cursor !== null && args.request.cursor !== void 0 ? { cursor: args.request.cursor } : {}
            };
            const value = await executeTextMatchWithFilteredCursorDrain(
              args.runtime,
              toolName,
              toolArguments,
              args.request
            );
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "grep",
                ...value
              }
            };
          }
        }
      } catch (error2) {
        return searchFailed(error2 instanceof Error ? error2.message : String(error2));
      }
    }
  };
}

// lib/fff-router/coordinator.ts
import path8 from "node:path";

// lib/fff-router/cursor.ts
import { createHash } from "node:crypto";
function digest(value) {
  return createHash("sha256").update(value).digest("base64url").slice(0, 16);
}
function requestFingerprint(request) {
  const base = {
    tool: request.tool,
    within: request.within,
    glob: request.glob ?? null,
    extensions: request.extensions,
    excludePaths: request.excludePaths,
    limit: request.limit
  };
  const value = request.tool === "find_files" ? { ...base, query: request.query } : {
    ...base,
    patterns: request.patterns,
    literal: request.literal,
    contextLines: request.contextLines
  };
  return digest(JSON.stringify(value));
}
function encodeCursor(args) {
  const envelope = {
    v: 1,
    r: digest(args.root),
    q: requestFingerprint(args.request),
    g: args.generation,
    c: args.upstreamCursor
  };
  return Buffer.from(JSON.stringify(envelope)).toString("base64url");
}
function decodeCursor(args) {
  let value;
  try {
    value = JSON.parse(Buffer.from(args.cursor, "base64url").toString("utf8"));
  } catch {
    return {
      ok: false,
      error: { code: "CURSOR_INVALID", message: "cursor is not a valid fff-router cursor" }
    };
  }
  if (!value || typeof value !== "object" || value.v !== 1 || typeof value.r !== "string" || typeof value.q !== "string" || typeof value.g !== "number" || typeof value.c !== "string") {
    return {
      ok: false,
      error: { code: "CURSOR_INVALID", message: "cursor payload is invalid" }
    };
  }
  const envelope = value;
  if (envelope.r !== digest(args.root) || envelope.q !== requestFingerprint(args.request)) {
    return {
      ok: false,
      error: {
        code: "CURSOR_INVALID",
        message: "cursor belongs to a different search or repository"
      }
    };
  }
  if (envelope.g !== args.generation) {
    return {
      ok: false,
      error: {
        code: "CURSOR_EXPIRED",
        message: "cursor expired because its fff-mcp worker was restarted",
        retryable: false
      }
    };
  }
  return { ok: true, value: envelope.c };
}

// lib/fff-router/resolve-path.ts
import fs from "node:fs/promises";
import path4 from "node:path";
function searchPathError(code, message) {
  return { ok: false, error: { code, message } };
}
async function pathExists(candidatePath) {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}
async function discoverGitRoot(realPath, statType) {
  let current = statType === "directory" ? realPath : path4.dirname(realPath);
  while (true) {
    if (await pathExists(path4.join(current, ".git"))) {
      return current;
    }
    const parent = path4.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
function resolveStatType(stats) {
  if (stats.isDirectory()) {
    return { ok: true, value: "directory" };
  }
  if (stats.isFile()) {
    return { ok: true, value: "file" };
  }
  return searchPathError(
    "INVALID_REQUEST",
    "search_path must point to a regular file or directory"
  );
}
async function resolveSearchPath(searchPath) {
  let realPath;
  try {
    realPath = await fs.realpath(searchPath);
  } catch (error2) {
    const code = error2.code;
    if (code === "ENOENT") {
      return searchPathError("SEARCH_PATH_NOT_FOUND", `search_path '${searchPath}' does not exist`);
    }
    return searchPathError("SEARCH_PATH_REALPATH_FAILED", `failed to canonicalize '${searchPath}'`);
  }
  let stats;
  try {
    stats = await fs.stat(realPath);
  } catch {
    return searchPathError(
      "SEARCH_PATH_REALPATH_FAILED",
      `failed to stat '${realPath}' after canonicalization`
    );
  }
  const statType = resolveStatType(stats);
  if (!statType.ok) {
    return statType;
  }
  return {
    ok: true,
    value: {
      realPath,
      statType: statType.value,
      gitRoot: await discoverGitRoot(realPath, statType.value)
    }
  };
}

// lib/fff-router/resolve-within.ts
import fs2 from "node:fs/promises";
import path6 from "node:path";

// lib/fff-router/home-path.ts
import path5 from "node:path";
function invalid(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function joinHome(home, suffix) {
  return suffix ? path5.join(home, suffix) : home;
}
function expandHomePath(candidate, env = process.env) {
  const trimmed = candidate.trim();
  const home = env.HOME?.trim();
  if (trimmed === "~" || trimmed.startsWith("~/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path5.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice(2)) };
  }
  if (trimmed === "$HOME" || trimmed.startsWith("$HOME/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path5.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice("$HOME/".length)) };
  }
  if (trimmed === "${HOME}" || trimmed.startsWith("${HOME}/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path5.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice("${HOME}/".length)) };
  }
  return { ok: true, value: trimmed };
}

// lib/fff-router/resolve-within.ts
function invalid2(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function withinNotFound(within2) {
  return {
    ok: false,
    error: {
      code: "WITHIN_NOT_FOUND",
      message: `within '${within2}' does not exist`
    }
  };
}
function internalError(message) {
  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message
    }
  };
}
function validateAbsolutePath(candidate, field) {
  const trimmed = candidate.trim();
  if (trimmed === "") {
    return invalid2(`${field} must be a non-empty path`);
  }
  if (!path6.isAbsolute(trimmed)) {
    return invalid2(`${field} must be absolute`);
  }
  return { ok: true, value: trimmed };
}
function resolveStatType2(stats) {
  if (stats.isDirectory()) {
    return { ok: true, value: "directory" };
  }
  if (stats.isFile()) {
    return { ok: true, value: "file" };
  }
  return invalid2("within must point to a regular file or directory");
}
async function validateResolvedWithinEntry(candidate) {
  const within2 = validateAbsolutePath(candidate, "within");
  if (!within2.ok) {
    return within2;
  }
  let resolvedWithin;
  try {
    resolvedWithin = await fs2.realpath(within2.value);
  } catch (error2) {
    const code = error2.code;
    if (code === "ENOENT") {
      return withinNotFound(within2.value);
    }
    return internalError(`failed to canonicalize within '${within2.value}'`);
  }
  let stats;
  try {
    stats = await fs2.stat(resolvedWithin);
  } catch {
    return internalError(`failed to stat resolved within '${resolvedWithin}'`);
  }
  const statType = resolveStatType2(stats);
  if (!statType.ok) {
    return statType;
  }
  if (statType.value === "directory") {
    return {
      ok: true,
      value: {
        resolvedWithin,
        basePath: resolvedWithin
      }
    };
  }
  return {
    ok: true,
    value: {
      resolvedWithin,
      basePath: path6.dirname(resolvedWithin),
      fileRestriction: resolvedWithin
    }
  };
}
async function validateResolvedWithinPaths(args) {
  if (args.withinPaths.length === 0) {
    return invalid2("withinPaths must contain at least one entry");
  }
  const entries = [];
  for (const candidate of args.withinPaths) {
    const entry = await validateResolvedWithinEntry(candidate);
    if (!entry.ok) {
      return entry;
    }
    entries.push(entry.value);
  }
  const [primary, ...rest] = entries;
  return {
    ok: true,
    value: {
      resolvedWithin: primary.resolvedWithin,
      basePath: primary.basePath,
      ...primary.fileRestriction !== void 0 ? { fileRestriction: primary.fileRestriction } : {},
      ...rest.length > 0 ? { additionalEntries: rest } : {}
    }
  };
}

// lib/fff-router/routing.ts
import path7 from "node:path";
function invalidConfig(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function outsideAllowedScope(realPath) {
  return {
    ok: false,
    error: {
      code: "OUTSIDE_ALLOWED_SCOPE",
      message: `search_path '${realPath}' is outside a git repo and not under an allowlisted non-git prefix`
    }
  };
}
function normalizeAllowlistedPrefixes(config) {
  const normalized = /* @__PURE__ */ new Set();
  for (const entry of config.allowlistedNonGitPrefixes) {
    if (!path7.isAbsolute(entry.prefix)) {
      return invalidConfig("allowlisted non-git prefixes must be absolute paths");
    }
    normalized.add(path7.normalize(entry.prefix));
  }
  return {
    ok: true,
    value: [...normalized].sort((a, b) => b.length - a.length)
  };
}
function longestMatchingPrefix(realPath, prefixes) {
  for (const prefix of prefixes) {
    if (realPath === prefix || realPath.startsWith(prefix + path7.sep)) {
      return prefix;
    }
  }
  return null;
}
function deriveFirstChildRoot(prefix, realPath) {
  const relative = path7.relative(prefix, realPath);
  if (!relative || relative.startsWith("..") || path7.isAbsolute(relative)) {
    return null;
  }
  const firstSegment = relative.split(path7.sep)[0];
  if (!firstSegment) {
    return null;
  }
  return path7.join(prefix, firstSegment);
}
function deriveRoutingTarget(args) {
  if (args.gitRoot) {
    return {
      ok: true,
      value: {
        rootType: "git",
        persistenceRoot: path7.normalize(args.gitRoot),
        searchScope: args.realPath,
        ttlMs: args.config.ttl.gitMs
      }
    };
  }
  const prefixes = normalizeAllowlistedPrefixes(args.config);
  if (!prefixes.ok) {
    return prefixes;
  }
  const matchedPrefix = longestMatchingPrefix(args.realPath, prefixes.value);
  if (!matchedPrefix) {
    return outsideAllowedScope(args.realPath);
  }
  const persistenceRoot = deriveFirstChildRoot(matchedPrefix, args.realPath);
  if (!persistenceRoot) {
    return outsideAllowedScope(args.realPath);
  }
  return {
    ok: true,
    value: {
      rootType: "non-git",
      persistenceRoot,
      searchScope: args.realPath,
      ttlMs: args.config.ttl.nonGitMs
    }
  };
}

// lib/fff-router/coordinator.ts
var WorkerCallTimeoutError = class extends Error {
  constructor(timeoutMs) {
    super(`fff-mcp call timed out after ${timeoutMs}ms`);
    this.timeoutMs = timeoutMs;
  }
  timeoutMs;
};
function error(code, message, retryable) {
  return {
    ok: false,
    error: { code, message, ...retryable !== void 0 ? { retryable } : {} }
  };
}
function isStaleWorkerMessage(message) {
  return /\b(Not connected|EPIPE|ECONNRESET|EOF)\b/i.test(message) || /\b(transport|stdio|stream)\b.*\b(closed|ended|destroyed|disconnected)\b/i.test(message);
}
async function withTimeout(promise, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return await promise;
  }
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new WorkerCallTimeoutError(timeoutMs)), timeoutMs);
        timer.unref?.();
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
function translateExcludePaths(validatedWithin, persistenceRoot, excludePaths) {
  const baseRelative = normalizeRelativePath(
    path8.relative(persistenceRoot, validatedWithin.basePath)
  );
  if (!baseRelative || baseRelative === ".") {
    return excludePaths;
  }
  return excludePaths.map(
    (excludePath) => normalizeRelativePath(path8.join(baseRelative, excludePath))
  );
}
function buildBackendRequest(args) {
  const base = {
    persistenceRoot: args.target.persistenceRoot,
    within: args.validatedWithin.resolvedWithin,
    basePath: args.validatedWithin.basePath,
    fileRestriction: args.validatedWithin.fileRestriction,
    additionalWithinEntries: args.validatedWithin.additionalEntries ?? [],
    ...args.request.glob ? { glob: args.request.glob } : {},
    extensions: args.request.extensions,
    excludePaths: translateExcludePaths(
      args.validatedWithin,
      args.target.persistenceRoot,
      args.request.excludePaths
    ),
    limit: args.request.limit,
    cursor: args.upstreamCursor
  };
  return args.request.tool === "find_files" ? { ...base, queryKind: "find_files", query: args.request.query } : {
    ...base,
    queryKind: "grep",
    patterns: args.request.patterns,
    literal: args.request.literal,
    contextLines: args.request.contextLines
  };
}
function toPublicResult(args) {
  const nextCursor = args.result.nextCursor ? encodeCursor({
    root: args.target.persistenceRoot,
    generation: args.lease.generation,
    request: args.request,
    upstreamCursor: args.result.nextCursor
  }) : null;
  const recommendation = args.result.summary?.readRecommendation;
  const readRecommendation = recommendation ? {
    path: recommendation.relativePath,
    absolutePath: path8.join(args.target.persistenceRoot, recommendation.relativePath),
    ...recommendation.reason ? { reason: recommendation.reason } : {}
  } : void 0;
  const displayText = args.result.renderedCompact ? args.result.renderedCompact.split(/\r?\n/).filter((line) => !/^cursor:\s*/.test(line.trim())).concat(nextCursor ? [`cursor: ${nextCursor}`] : []).join("\n") : void 0;
  const common = {
    root: args.target.persistenceRoot,
    backend: "fff-mcp",
    nextCursor,
    stats: {
      resultCount: args.result.items.length,
      ...args.result.summary?.shownCount !== void 0 ? { upstreamShownCount: args.result.summary.shownCount } : {},
      ...args.result.summary?.totalCount !== void 0 ? { upstreamTotalCount: args.result.summary.totalCount } : {},
      coldStart: args.lease.coldStart,
      workerId: args.lease.runtime.id,
      workerGeneration: args.lease.generation
    },
    ...readRecommendation ? { readRecommendation } : {},
    ...displayText ? { displayText } : {}
  };
  if (args.request.tool === "find_files") {
    return {
      tool: "find_files",
      ...common,
      items: args.result.items.map((item) => ({
        path: normalizeRelativePath(path8.relative(args.target.persistenceRoot, item.path)),
        absolutePath: item.path
      }))
    };
  }
  return {
    tool: "grep",
    ...common,
    items: args.result.items.map((item) => {
      if (!("line" in item)) {
        throw new Error("fff-mcp returned a file item for grep");
      }
      return {
        path: normalizeRelativePath(path8.relative(args.target.persistenceRoot, item.path)),
        absolutePath: item.path,
        line: item.line,
        text: item.text,
        ...item.column !== void 0 ? { column: item.column } : {},
        ...item.contextBefore ? { contextBefore: item.contextBefore } : {},
        ...item.contextAfter ? { contextAfter: item.contextAfter } : {},
        ...item.isDefinition ? { isDefinition: true } : {},
        ...item.definitionBody ? { definitionBody: item.definitionBody } : {}
      };
    })
  };
}
var RouterServiceImpl = class {
  constructor(deps) {
    this.deps = deps;
    this.validateWithin = deps.validateWithin ?? validateResolvedWithinPaths;
    this.resolvePath = deps.resolvePath ?? resolveSearchPath;
    this.writeDiagnostic = deps.writeDiagnostic ?? ((event) => console.error(JSON.stringify({ event: "fff-router.diagnostic", ...event })));
  }
  deps;
  validateWithin;
  resolvePath;
  writeDiagnostic;
  async resolveTarget(within2) {
    const validatedWithin = await this.validateWithin({ withinPaths: within2 });
    if (!validatedWithin.ok) {
      return validatedWithin;
    }
    const entries = [
      {
        resolvedWithin: validatedWithin.value.resolvedWithin,
        basePath: validatedWithin.value.basePath,
        ...validatedWithin.value.fileRestriction ? { fileRestriction: validatedWithin.value.fileRestriction } : {}
      },
      ...validatedWithin.value.additionalEntries ?? []
    ];
    let target;
    for (const entry of entries) {
      const resolved = await this.resolvePath(entry.resolvedWithin);
      if (!resolved.ok) {
        const code = resolved.error.code === "SEARCH_PATH_NOT_FOUND" ? "WITHIN_NOT_FOUND" : resolved.error.code === "OUTSIDE_ALLOWED_SCOPE" ? "OUTSIDE_ALLOWED_SCOPE" : resolved.error.code === "INVALID_REQUEST" ? "INVALID_REQUEST" : "INTERNAL_ERROR";
        return error(code, resolved.error.message);
      }
      const routed = deriveRoutingTarget({
        realPath: resolved.value.realPath,
        statType: resolved.value.statType,
        gitRoot: resolved.value.gitRoot,
        config: this.deps.configRef.current
      });
      if (!routed.ok) {
        return routed;
      }
      if (target && routed.value.persistenceRoot !== target.persistenceRoot) {
        return error(
          "INVALID_REQUEST",
          `within paths must share one routing root; '${entry.resolvedWithin}' routes to '${routed.value.persistenceRoot}', not '${target.persistenceRoot}'`
        );
      }
      target ??= routed.value;
    }
    return {
      ok: true,
      value: { validatedWithin: validatedWithin.value, target }
    };
  }
  acquire(target) {
    return this.deps.workerPool.acquire({
      root: target.persistenceRoot,
      rootType: target.rootType,
      ttlMs: target.ttlMs,
      start: async () => await this.deps.adapter.startRuntime({
        persistenceRoot: target.persistenceRoot
      })
    });
  }
  async executeAttempt(request, validatedWithin, target) {
    const acquired = await this.acquire(target);
    if (!acquired.ok) {
      return { kind: "error", error: acquired.error };
    }
    const lease = acquired.value;
    let invalidateReason;
    try {
      let upstreamCursor = null;
      if (request.cursor) {
        const decoded = decodeCursor({
          cursor: request.cursor,
          root: target.persistenceRoot,
          generation: lease.generation,
          request
        });
        if (!decoded.ok) {
          return { kind: "error", error: decoded.error };
        }
        upstreamCursor = decoded.value;
      }
      const backendRequest = buildBackendRequest({
        request,
        validatedWithin,
        target,
        upstreamCursor
      });
      lease.recordCallStart();
      let backendResult;
      try {
        backendResult = await withTimeout(
          this.deps.adapter.execute({ request: backendRequest, runtime: lease.runtime }),
          this.deps.configRef.current.runtime.toolTimeoutMs
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        lease.recordCallError(message);
        invalidateReason = message;
        if (caught instanceof WorkerCallTimeoutError) {
          return request.cursor ? {
            kind: "error",
            error: {
              code: "CURSOR_EXPIRED",
              message: "cursor expired because its worker timed out"
            }
          } : { kind: "retry", message };
        }
        return request.cursor ? {
          kind: "error",
          error: {
            code: "CURSOR_EXPIRED",
            message: "cursor expired because its worker failed"
          }
        } : { kind: "retry", message };
      }
      if (!backendResult.ok) {
        lease.recordCallError(backendResult.error.message);
        if (isStaleWorkerMessage(backendResult.error.message)) {
          invalidateReason = backendResult.error.message;
          return request.cursor ? {
            kind: "error",
            error: {
              code: "CURSOR_EXPIRED",
              message: "cursor expired because its worker restarted"
            }
          } : { kind: "retry", message: backendResult.error.message };
        }
        return {
          kind: "error",
          error: {
            code: backendResult.error.code === "WORKER_UNAVAILABLE" ? "WORKER_UNAVAILABLE" : "SEARCH_FAILED",
            message: backendResult.error.message,
            retryable: backendResult.error.code === "WORKER_UNAVAILABLE"
          }
        };
      }
      lease.recordCallSuccess();
      if (backendResult.value.diagnostics) {
        try {
          this.writeDiagnostic({
            root: target.persistenceRoot,
            tool: request.tool,
            diagnostics: backendResult.value.diagnostics
          });
        } catch {
        }
      }
      return {
        kind: "success",
        value: toPublicResult({
          request,
          target,
          lease,
          result: backendResult.value
        })
      };
    } finally {
      if (invalidateReason) {
        await this.deps.workerPool.invalidate(
          target.persistenceRoot,
          lease.generation,
          invalidateReason
        );
      }
      await lease.release();
    }
  }
  async execute(request) {
    const routed = await this.resolveTarget(request.within);
    if (!routed.ok) {
      return routed;
    }
    const first = await this.executeAttempt(
      request,
      routed.value.validatedWithin,
      routed.value.target
    );
    if (first.kind === "success") {
      return { ok: true, value: first.value };
    }
    if (first.kind === "error") {
      return { ok: false, error: first.error };
    }
    const second = await this.executeAttempt(
      request,
      routed.value.validatedWithin,
      routed.value.target
    );
    if (second.kind === "success") {
      return { ok: true, value: second.value };
    }
    return {
      ok: false,
      error: second.kind === "error" ? second.error : {
        code: "WORKER_UNAVAILABLE",
        message: `fff-mcp worker failed twice: ${second.message}`,
        retryable: true
      }
    };
  }
  async warm(within2) {
    const diagnostics = [];
    const seen = /* @__PURE__ */ new Set();
    for (const candidate of within2) {
      const routed = await this.resolveTarget([candidate]);
      if (!routed.ok) {
        return routed;
      }
      if (seen.has(routed.value.target.persistenceRoot)) {
        continue;
      }
      seen.add(routed.value.target.persistenceRoot);
      const acquired = await this.acquire(routed.value.target);
      if (!acquired.ok) {
        return acquired;
      }
      await acquired.value.release();
      const diagnostic = this.deps.workerPool.getDiagnostics().find(
        (entry) => entry.root === routed.value.target.persistenceRoot && entry.state !== "dead"
      );
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    }
    return { ok: true, value: diagnostics };
  }
  async evict(within2) {
    const evicted = [];
    const seen = /* @__PURE__ */ new Set();
    for (const candidate of within2) {
      const routed = await this.resolveTarget([candidate]);
      if (!routed.ok) {
        return routed;
      }
      const root = routed.value.target.persistenceRoot;
      if (seen.has(root)) {
        continue;
      }
      seen.add(root);
      if (await this.deps.workerPool.evict(root)) {
        evicted.push(root);
      }
    }
    return { ok: true, value: { evicted } };
  }
  status() {
    return {
      workers: this.deps.workerPool.getDiagnostics(),
      limits: this.deps.configRef.current.limits
    };
  }
  async close() {
    await this.deps.workerPool.closeAll();
  }
};
function createRouterService(deps) {
  return new RouterServiceImpl(deps);
}

// lib/fff-router/daemon-config.ts
import { createHash as createHash2 } from "node:crypto";
import { existsSync as existsSync2, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os2 from "node:os";
import { isIP } from "node:net";
import path9 from "node:path";
import { fileURLToPath } from "node:url";
var DEFAULT_DAEMON_HOST = "127.0.0.1";
var DAEMON_PROTOCOL_VERSION = "fff-router-v1";
var DEFAULT_DAEMON_PORT = 4319;
var DEFAULT_DAEMON_MCP_PATH = "/mcp";
var DEFAULT_BACKEND_TOOL_TIMEOUT_MS = 3e4;
var DEFAULT_SWEEP_INTERVAL_MS = 3e4;
var DEFAULT_RESTART_BACKOFF_MS = 1e3;
var moduleDir = path9.dirname(fileURLToPath(import.meta.url));
function packageVersion() {
  const candidatePaths = [
    path9.resolve(moduleDir, "../../package.json"),
    path9.resolve(moduleDir, "../../../package.json")
  ];
  for (const candidatePath of candidatePaths) {
    if (!existsSync2(candidatePath)) {
      continue;
    }
    const parsed = JSON.parse(readFileSync(candidatePath, "utf8"));
    if (typeof parsed.version === "string" && parsed.version.length > 0) {
      return parsed.version;
    }
  }
  throw new Error("Unable to determine fff-router package version");
}
var PACKAGE_VERSION = packageVersion();
var PACKAGE_MANAGER = "pnpm@11.19.0";
function hashFingerprint(value) {
  return createHash2("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
function packagedDaemonEntrypointPath() {
  const primaryCandidatePath = path9.resolve(moduleDir, "../../dist/bin/fff-routerd.js");
  const candidatePaths = [
    primaryCandidatePath,
    path9.resolve(moduleDir, "../../bin/fff-routerd.js")
  ];
  for (const candidatePath of candidatePaths) {
    if (existsSync2(candidatePath)) {
      return candidatePath;
    }
  }
  return primaryCandidatePath;
}
function contentFingerprint(pathValue) {
  try {
    return createHash2("sha256").update(readFileSync(pathValue)).digest("hex");
  } catch {
    return "missing";
  }
}
function getDaemonSourceFingerprint(args = {}) {
  const env = args.env ?? process.env;
  if (env.FFF_ROUTER_DAEMON_SOURCE_FINGERPRINT) {
    return env.FFF_ROUTER_DAEMON_SOURCE_FINGERPRINT;
  }
  const daemonEntrypointPath = args.daemonEntrypointPath ?? env.FFF_ROUTER_DAEMON_BIN ?? env.FFF_ROUTER_DAEMON_ENTRYPOINT ?? packagedDaemonEntrypointPath();
  return hashFingerprint({
    packageVersion: PACKAGE_VERSION,
    daemonEntrypointPath,
    content: contentFingerprint(daemonEntrypointPath)
  });
}
function userHome(env) {
  return env.HOME || os2.homedir();
}
function configHome(env) {
  return env.XDG_CONFIG_HOME || path9.join(userHome(env), ".config");
}
function stateHome(env) {
  return env.XDG_STATE_HOME || path9.join(userHome(env), ".local", "state");
}
function getDefaultDaemonConfig() {
  return {
    host: DEFAULT_DAEMON_HOST,
    port: DEFAULT_DAEMON_PORT,
    mcpPath: DEFAULT_DAEMON_MCP_PATH
  };
}
function getDefaultRouterConfig() {
  return {
    allowlistedNonGitPrefixes: [],
    warmRoots: [],
    ttl: {
      gitMs: 60 * 60 * 1e3,
      nonGitMs: 15 * 60 * 1e3
    },
    limits: {
      maxWorkers: 12,
      maxNonGitWorkers: 4
    },
    runtime: {
      toolTimeoutMs: DEFAULT_BACKEND_TOOL_TIMEOUT_MS,
      sweepIntervalMs: DEFAULT_SWEEP_INTERVAL_MS,
      restartBackoffMs: DEFAULT_RESTART_BACKOFF_MS
    }
  };
}
function getDefaultDaemonReloadConfig() {
  return {
    router: getDefaultRouterConfig()
  };
}
function getDefaultDaemonFileConfig() {
  const daemon = getDefaultDaemonConfig();
  const reload = getDefaultDaemonReloadConfig();
  return {
    host: daemon.host,
    port: daemon.port,
    mcpPath: daemon.mcpPath,
    allowlist: [],
    warmRoots: [],
    ttl: { ...reload.router.ttl },
    limits: { ...reload.router.limits },
    runtime: {
      ...reload.router.runtime
    }
  };
}
function serializeDefaultDaemonFileConfig() {
  return `${JSON.stringify(getDefaultDaemonFileConfig(), null, 2)}
`;
}
function getDaemonPolicyConfigPaths(args = {}) {
  const env = args.env ?? process.env;
  const dir = path9.join(configHome(env), "fff-routerd");
  return {
    dir,
    jsonPath: path9.join(dir, "config.json"),
    jsoncPath: path9.join(dir, "config.jsonc")
  };
}
function ensureDefaultConfigFile(paths) {
  mkdirSync(paths.dir, { recursive: true });
  const text = serializeDefaultDaemonFileConfig();
  writeFileSync(paths.jsonPath, text);
  return {
    path: paths.jsonPath,
    text
  };
}
function readPreferredDaemonPolicyFile(args = {}) {
  const paths = getDaemonPolicyConfigPaths(args);
  if (existsSync2(paths.jsonPath)) {
    return {
      path: paths.jsonPath,
      text: readFileSync(paths.jsonPath, "utf8")
    };
  }
  if (existsSync2(paths.jsoncPath)) {
    return {
      path: paths.jsoncPath,
      text: readFileSync(paths.jsoncPath, "utf8")
    };
  }
  return ensureDefaultConfigFile(paths);
}
function expectObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value;
}
function rejectUnknownKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(
      `${label} contains unknown field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`
    );
  }
}
function readOptionalNumber(value, label) {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}
function readOptionalNonNegativeInteger(value, label) {
  const parsed = readOptionalNumber(value, label);
  if (parsed == null) {
    return void 0;
  }
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}
function readOptionalPositiveInteger(value, label) {
  const parsed = readOptionalNonNegativeInteger(value, label);
  if (parsed === 0) {
    throw new Error(`${label} must be greater than zero`);
  }
  return parsed;
}
function readOptionalPort(value) {
  const parsed = readOptionalNumber(value, "port");
  if (parsed == null) {
    return void 0;
  }
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("port must be an integer between 1 and 65535");
  }
  return parsed;
}
function readOptionalMcpPath(value) {
  const parsed = readOptionalString(value, "mcpPath");
  if (parsed == null) {
    return void 0;
  }
  if (!parsed.startsWith("/")) {
    throw new Error("mcpPath must start with '/'");
  }
  if (parsed.includes("?") || parsed.includes("#")) {
    throw new Error("mcpPath must be a pathname without query or hash");
  }
  if (parsed === "/health") {
    throw new Error("mcpPath '/health' is reserved");
  }
  return parsed;
}
function readOptionalHost(value) {
  const host = readOptionalString(value, "host");
  if (host == null) {
    return void 0;
  }
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized !== "localhost" && normalized !== "::1" && !(isIP(normalized) === 4 && normalized.startsWith("127."))) {
    throw new Error("fff-routerd v1 is machine-local; host must be localhost, 127.0.0.0/8, or ::1");
  }
  return host;
}
function readOptionalString(value, label) {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}
function readOptionalStringArray(value, label) {
  if (value == null) {
    return void 0;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value;
}
function expandPathEntries(entries, env) {
  return entries.map((prefix) => expandHomePath(prefix, env)).map((result) => {
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    return result.value;
  }).filter(Boolean).map((entry) => {
    if (!path9.isAbsolute(entry)) {
      throw new Error(`configured paths must be absolute or home-relative: '${entry}'`);
    }
    return path9.normalize(entry);
  });
}
function expandAllowlistEntries(entries, env) {
  return expandPathEntries(entries, env).map((prefix) => ({
    prefix,
    mode: "first-child-root"
  }));
}
function parseJsonWithComments(text) {
  let withoutComments = "";
  let index = 0;
  let inString = false;
  let stringQuote = '"';
  let escaped = false;
  while (index < text.length) {
    const current = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (inString) {
      withoutComments += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === stringQuote) {
        inString = false;
      }
      index += 1;
      continue;
    }
    if (current === '"' || current === "'") {
      inString = true;
      stringQuote = current;
      withoutComments += current;
      index += 1;
      continue;
    }
    if (current === "/" && next === "/") {
      index += 2;
      while (index < text.length && text[index] !== "\n") {
        index += 1;
      }
      continue;
    }
    if (current === "/" && next === "*") {
      index += 2;
      while (index < text.length) {
        if (text[index] === "*" && text[index + 1] === "/") {
          index += 2;
          break;
        }
        index += 1;
      }
      continue;
    }
    withoutComments += current;
    index += 1;
  }
  let normalized = "";
  index = 0;
  inString = false;
  escaped = false;
  while (index < withoutComments.length) {
    const current = withoutComments[index] ?? "";
    if (inString) {
      normalized += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === stringQuote) {
        inString = false;
      }
      index += 1;
      continue;
    }
    if (current === '"' || current === "'") {
      inString = true;
      stringQuote = current;
      normalized += current;
      index += 1;
      continue;
    }
    if (current === ",") {
      let lookahead = index + 1;
      while (lookahead < withoutComments.length && /\s/.test(withoutComments[lookahead] ?? "")) {
        lookahead += 1;
      }
      const nextNonWhitespace = withoutComments[lookahead] ?? "";
      if (nextNonWhitespace === "}" || nextNonWhitespace === "]") {
        index += 1;
        continue;
      }
    }
    normalized += current;
    index += 1;
  }
  return JSON.parse(normalized);
}
function normalizeDaemonFileConfig(raw, env) {
  const defaults = getDefaultDaemonFileConfig();
  const fileConfig = expectObject(raw, "fff-routerd config");
  rejectUnknownKeys(
    fileConfig,
    ["host", "port", "mcpPath", "allowlist", "warmRoots", "ttl", "limits", "runtime"],
    "fff-routerd config"
  );
  const ttl = fileConfig.ttl == null ? null : expectObject(fileConfig.ttl, "ttl");
  const limits = fileConfig.limits == null ? null : expectObject(fileConfig.limits, "limits");
  const runtime = fileConfig.runtime == null ? null : expectObject(fileConfig.runtime, "runtime");
  if (ttl) rejectUnknownKeys(ttl, ["gitMs", "nonGitMs"], "ttl");
  if (limits) rejectUnknownKeys(limits, ["maxWorkers", "maxNonGitWorkers"], "limits");
  if (runtime) {
    rejectUnknownKeys(runtime, ["toolTimeoutMs", "sweepIntervalMs", "restartBackoffMs"], "runtime");
  }
  const normalizedEnv = { ...env, HOME: userHome(env) };
  const allowlist = readOptionalStringArray(fileConfig.allowlist, "allowlist") ?? defaults.allowlist;
  const warmRoots = readOptionalStringArray(fileConfig.warmRoots, "warmRoots") ?? defaults.warmRoots;
  const host = readOptionalHost(fileConfig.host) ?? defaults.host;
  const port = readOptionalPort(fileConfig.port) ?? defaults.port;
  const mcpPath = readOptionalMcpPath(fileConfig.mcpPath) ?? defaults.mcpPath;
  const ttlGitMs = readOptionalNonNegativeInteger(ttl?.gitMs, "ttl.gitMs") ?? defaults.ttl.gitMs;
  const ttlNonGitMs = readOptionalNonNegativeInteger(ttl?.nonGitMs, "ttl.nonGitMs") ?? defaults.ttl.nonGitMs;
  const maxWorkers = readOptionalPositiveInteger(limits?.maxWorkers, "limits.maxWorkers") ?? defaults.limits.maxWorkers;
  const maxNonGitWorkers = readOptionalPositiveInteger(limits?.maxNonGitWorkers, "limits.maxNonGitWorkers") ?? defaults.limits.maxNonGitWorkers;
  if (maxNonGitWorkers > maxWorkers) {
    throw new Error("limits.maxNonGitWorkers must not exceed limits.maxWorkers");
  }
  const toolTimeoutMs = readOptionalNonNegativeInteger(runtime?.toolTimeoutMs, "runtime.toolTimeoutMs") ?? defaults.runtime.toolTimeoutMs;
  const sweepIntervalMs = readOptionalNonNegativeInteger(runtime?.sweepIntervalMs, "runtime.sweepIntervalMs") ?? defaults.runtime.sweepIntervalMs;
  const restartBackoffMs = readOptionalNonNegativeInteger(runtime?.restartBackoffMs, "runtime.restartBackoffMs") ?? defaults.runtime.restartBackoffMs;
  return {
    daemon: {
      host,
      port,
      mcpPath
    },
    reload: {
      router: {
        allowlistedNonGitPrefixes: expandAllowlistEntries(allowlist, normalizedEnv),
        warmRoots: expandPathEntries(warmRoots, normalizedEnv),
        ttl: {
          gitMs: ttlGitMs,
          nonGitMs: ttlNonGitMs
        },
        limits: {
          maxWorkers,
          maxNonGitWorkers
        },
        runtime: {
          toolTimeoutMs,
          sweepIntervalMs,
          restartBackoffMs
        }
      }
    }
  };
}
function readDaemonConfigFromMetadata(args = {}) {
  const paths = getDaemonPaths(args);
  if (!existsSync2(paths.metadataPath)) {
    return null;
  }
  try {
    const metadata = JSON.parse(readFileSync(paths.metadataPath, "utf8"));
    if (typeof metadata.host !== "string" || typeof metadata.port !== "number" || typeof metadata.mcpPath !== "string") {
      return null;
    }
    return {
      host: metadata.host,
      port: metadata.port,
      mcpPath: metadata.mcpPath
    };
  } catch {
    return null;
  }
}
function loadNormalizedDaemonFileConfig(args = {}) {
  const env = args.env ?? process.env;
  const configFile = readPreferredDaemonPolicyFile({ env });
  return normalizeDaemonFileConfig(parseJsonWithComments(configFile.text), env);
}
function getDaemonConfig(args = {}) {
  try {
    return loadNormalizedDaemonFileConfig(args).daemon;
  } catch (error2) {
    const fallback = readDaemonConfigFromMetadata(args);
    if (fallback) {
      return fallback;
    }
    throw error2;
  }
}
function formatDaemonUrlHost(host) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}
function getDaemonOriginFromConfig(config) {
  return `http://${formatDaemonUrlHost(config.host)}:${config.port}`;
}
function getDaemonEndpoint(args = {}) {
  const config = getDaemonConfig(args);
  return `${getDaemonOriginFromConfig(config)}${config.mcpPath}`;
}
function loadDaemonReloadConfig(args = {}) {
  return loadNormalizedDaemonFileConfig(args).reload;
}
function getDaemonServerFingerprint(args = {}) {
  const daemon = getDaemonConfig({ env: args.env });
  return hashFingerprint({
    daemon: {
      ...daemon,
      ...args.daemonConfig
    },
    protocolVersion: DAEMON_PROTOCOL_VERSION,
    daemonSourceFingerprint: getDaemonSourceFingerprint({ env: args.env })
  });
}
function getDaemonReloadFingerprintForConfig(config) {
  return hashFingerprint(config);
}
function getDaemonReloadFingerprint(args = {}) {
  return getDaemonReloadFingerprintForConfig(loadDaemonReloadConfig(args));
}
function getDaemonConfigFingerprint(args = {}) {
  return hashFingerprint({
    serverFingerprint: getDaemonServerFingerprint(args),
    reloadFingerprint: getDaemonReloadFingerprint(args)
  });
}
function getDaemonPaths(args = {}) {
  const env = args.env ?? process.env;
  const dir = path9.join(stateHome(env), "fff-routerd");
  return {
    dir,
    authTokenPath: path9.join(dir, "auth-token"),
    metadataPath: path9.join(dir, "daemon.json"),
    lockPath: path9.join(dir, "startup.lock"),
    stdoutLogPath: path9.join(dir, "daemon.stdout.log"),
    stderrLogPath: path9.join(dir, "daemon.stderr.log")
  };
}

// lib/fff-router/http-daemon.ts
import { watch } from "node:fs";
import { createServer } from "node:http";
import { isIP as isIP2 } from "node:net";
import { mkdir as mkdir2, readFile as readFile2, rename, rm, writeFile as writeFile2 } from "node:fs/promises";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// lib/fff-router/mcp-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// lib/fff-router/mcp-tools.ts
import path11 from "node:path";
import * as z2 from "zod/v4";

// lib/fff-router/public-api.ts
import path10 from "node:path";
import * as z from "zod/v4";
var MAX_RESULTS = 50;
var MAX_CONTEXT_LINES = 5;
var MAX_PATTERNS = 20;
var MAX_FILTERS = 30;
var MAX_WITHIN_PATHS = 10;
var MAX_QUERY_LENGTH = 1024;
var extension = z.string().min(1).max(64).refine(
  (value) => /^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value.trim().replace(/^\./, "")),
  "extensions must be literal suffixes without path or glob syntax"
);
var relativeFilter = z.string().min(1).max(512).refine(
  (value) => !path10.posix.isAbsolute(value.trim().replace(/\\/g, "/").replace(/^\.\//, "")),
  "path filters must be relative"
).refine(
  (value) => !value.trim().replace(/\\/g, "/").replace(/^\.\//, "").split("/").some((segment) => segment === "" || segment === "." || segment === ".."),
  "path filters must not contain empty, current-directory, or parent-directory segments"
);
var glob = relativeFilter.refine(
  (value) => !value.trim().startsWith("!"),
  "glob is an include filter; use excludePaths for exclusions"
);
var within = z.union([
  z.string().min(1).max(4096).refine((value) => value.trim().length > 0),
  z.array(
    z.string().min(1).max(4096).refine((value) => value.trim().length > 0)
  ).min(1).max(MAX_WITHIN_PATHS)
]);
var commonShape = {
  within,
  glob: glob.optional(),
  extensions: z.array(extension).max(MAX_FILTERS).optional().default([]),
  excludePaths: z.array(relativeFilter).max(MAX_FILTERS).optional().default([]),
  limit: z.number().int().min(1).max(MAX_RESULTS).optional().default(20),
  cursor: z.string().min(1).max(4096).nullable().optional().default(null)
};
var findFilesInputSchema = z.strictObject({
  query: z.string().min(1).max(MAX_QUERY_LENGTH).refine((value) => value.trim().length > 0, "query must not be blank"),
  ...commonShape
});
var grepInputSchema = z.strictObject({
  patterns: z.array(
    z.string().min(1).max(MAX_QUERY_LENGTH).refine((value) => value.trim().length > 0, "patterns must not be blank")
  ).min(1).max(MAX_PATTERNS),
  literal: z.boolean().optional().default(true),
  contextLines: z.number().int().min(0).max(MAX_CONTEXT_LINES).optional().default(0),
  ...commonShape
});
var fileHitSchema = z.object({
  path: z.string(),
  absolutePath: z.string()
});
var textHitSchema = z.object({
  ...fileHitSchema.shape,
  line: z.number().int().min(1),
  text: z.string(),
  column: z.number().int().min(0).optional(),
  contextBefore: z.array(z.string()).optional(),
  contextAfter: z.array(z.string()).optional(),
  isDefinition: z.boolean().optional(),
  definitionBody: z.array(z.string()).optional()
});
var searchResultStatsSchema = z.object({
  resultCount: z.number().int().min(0),
  upstreamShownCount: z.number().int().min(0).optional(),
  upstreamTotalCount: z.number().int().min(0).optional(),
  coldStart: z.boolean(),
  workerId: z.string().min(1),
  workerGeneration: z.number().int().min(1)
});
var readRecommendationSchema = z.object({
  path: z.string(),
  absolutePath: z.string(),
  reason: z.string().optional()
});
var searchResultBaseShape = {
  root: z.string(),
  backend: z.literal("fff-mcp"),
  nextCursor: z.string().nullable(),
  stats: searchResultStatsSchema,
  readRecommendation: readRecommendationSchema.optional(),
  displayText: z.string().optional()
};
var findFilesResultSchema = z.object({
  tool: z.literal("find_files"),
  ...searchResultBaseShape,
  items: z.array(fileHitSchema)
});
var grepResultSchema = z.object({
  tool: z.literal("grep"),
  ...searchResultBaseShape,
  items: z.array(textHitSchema)
});
var publicToolResultSchema = z.discriminatedUnion("tool", [
  findFilesResultSchema,
  grepResultSchema
]);
var workerDiagnosticSchema = z.object({
  root: z.string(),
  rootType: z.enum(["git", "non-git"]),
  state: z.enum(["starting", "ready", "draining", "dead"]),
  workerId: z.string().optional(),
  pid: z.number().int().nullable().optional(),
  generation: z.number().int().min(1),
  activeLeases: z.number().int().min(0),
  startedAt: z.number().min(0).optional(),
  lastUsedAt: z.number().min(0),
  lastCallAt: z.number().min(0).optional(),
  lastSuccessAt: z.number().min(0).optional(),
  lastError: z.string().optional(),
  lastErrorAt: z.number().min(0).optional(),
  failureCount: z.number().int().min(0),
  retryAfter: z.number().min(0).optional()
});
var routerStatusSchema = z.object({
  workers: z.array(workerDiagnosticSchema),
  limits: z.object({
    maxWorkers: z.number().int().min(1),
    maxNonGitWorkers: z.number().int().min(0)
  })
});
var warmResultSchema = z.object({ workers: z.array(workerDiagnosticSchema) });
var evictResultSchema = z.object({ evicted: z.array(z.string()) });
var PUBLIC_TOOL_DEFINITIONS = [
  {
    name: "find_files",
    description: "Fuzzy-search file names and paths using a shared warm fff-mcp index. within must be one or more absolute paths under the same repository or configured non-Git root.",
    inputSchema: findFilesInputSchema
  },
  {
    name: "grep",
    description: "Search file contents through a shared warm fff-mcp index. Multiple patterns use OR semantics; literal matching is the safe default and regex matching must be selected explicitly.",
    inputSchema: grepInputSchema
  }
];
function invalid3(message) {
  return { ok: false, error: { code: "INVALID_REQUEST", message } };
}
function formatZodError(error2) {
  return error2.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join(".") : "request";
    return `${field}: ${issue.message}`;
  }).join("; ");
}
function normalizeWithin(value, env) {
  const values = Array.isArray(value) ? value : [value];
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of values) {
    const expanded = expandHomePath(entry.trim(), env);
    if (!expanded.ok) {
      return invalid3(expanded.error.message);
    }
    if (!path10.isAbsolute(expanded.value)) {
      return invalid3("within paths must be absolute on the daemon wire protocol");
    }
    const clean = path10.normalize(expanded.value);
    if (seen.has(clean)) {
      return invalid3(`within contains duplicate path '${clean}'`);
    }
    seen.add(clean);
    normalized.push(clean);
  }
  return { ok: true, value: normalized };
}
function rejectWildcardOnlyRegex(patterns, literal2) {
  if (literal2) {
    return { ok: true, value: void 0 };
  }
  const wildcardOnly = /^(?:[.^$]*(?:[.][*+?]|[*+])[.^$]*|[.^$\s]*|\.\*[+?]?|\.\+[?]?|[.*?])$/;
  const rejected = patterns.find((pattern) => wildcardOnly.test(pattern.trim()));
  return rejected ? invalid3(`regex '${rejected}' matches everything; provide a concrete expression`) : { ok: true, value: void 0 };
}
function normalizePublicToolInput(tool, input, env = process.env) {
  const schema = tool === "find_files" ? findFilesInputSchema : grepInputSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return invalid3(formatZodError(parsed.error));
  }
  const resolvedWithin = normalizeWithin(parsed.data.within, env);
  if (!resolvedWithin.ok) {
    return resolvedWithin;
  }
  const common = {
    within: resolvedWithin.value,
    ...parsed.data.glob ? { glob: parsed.data.glob.trim().replace(/\\/g, "/").replace(/^\.\//, "") } : {},
    extensions: [
      ...new Set(parsed.data.extensions.map((value) => value.trim().replace(/^\./, "")))
    ],
    excludePaths: [
      ...new Set(
        parsed.data.excludePaths.map(
          (value) => value.trim().replace(/\\/g, "/").replace(/^\.\//, "")
        )
      )
    ],
    limit: parsed.data.limit,
    cursor: parsed.data.cursor
  };
  if (tool === "find_files") {
    const data2 = parsed.data;
    const request2 = {
      tool,
      query: data2.query.trim(),
      ...common
    };
    return { ok: true, value: request2 };
  }
  const data = parsed.data;
  const concreteRegex = rejectWildcardOnlyRegex(data.patterns, data.literal);
  if (!concreteRegex.ok) {
    return concreteRegex;
  }
  const request = {
    tool,
    patterns: [...new Set(data.patterns)],
    literal: data.literal,
    contextLines: data.contextLines,
    ...common
  };
  return { ok: true, value: request };
}

// lib/fff-router/mcp-tools.ts
var absoluteWithin = z2.string().min(1).refine((value) => path11.isAbsolute(value), "within paths must be absolute");
var adminWithinSchema = z2.strictObject({
  within: z2.union([absoluteWithin, z2.array(absoluteWithin).min(1).max(32)])
});
var MCP_TOOLS = [
  ...PUBLIC_TOOL_DEFINITIONS,
  {
    name: "router_status",
    description: "Show the shared fff-routerd worker pool and health state.",
    inputSchema: z2.strictObject({})
  },
  {
    name: "router_warm",
    description: "Start and retain warm fff-mcp workers for one or more absolute paths.",
    inputSchema: adminWithinSchema
  },
  {
    name: "router_evict",
    description: "Drain and remove fff-mcp workers for one or more absolute paths.",
    inputSchema: adminWithinSchema
  }
];
function formatResult(result) {
  if (result.displayText) {
    return result.displayText;
  }
  if (result.tool === "find_files") {
    return result.items.length > 0 ? result.items.map((item) => item.path).join("\n") : "0 results.";
  }
  return result.items.length > 0 ? result.items.map((item) => `${item.path}
  ${item.line}: ${item.text}`).join("\n--\n") : "0 matches.";
}
function errorResponse(code, message) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify({ ok: false, code, message })
      }
    ]
  };
}
function successResponse(text, structuredContent) {
  return {
    isError: false,
    content: [{ type: "text", text }],
    structuredContent
  };
}
function normalizeAdminWithin(input) {
  const parsed = adminWithinSchema.parse(input);
  const values = Array.isArray(parsed.within) ? parsed.within : [parsed.within];
  return values.map((value) => path11.normalize(value));
}
function listMcpTools() {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: z2.toJSONSchema(tool.inputSchema)
  }));
}
async function executeMcpTool(args) {
  try {
    switch (args.name) {
      case "find_files":
      case "grep": {
        const normalized = normalizePublicToolInput(args.name, args.input, args.env);
        if (!normalized.ok) {
          return errorResponse(normalized.error.code, normalized.error.message);
        }
        const result = await args.service.execute(normalized.value);
        if (!result.ok) {
          return errorResponse(result.error.code, result.error.message);
        }
        return successResponse(
          formatResult(result.value),
          result.value
        );
      }
      case "router_status": {
        const status = args.service.status();
        return successResponse(
          JSON.stringify(status, null, 2),
          status
        );
      }
      case "router_warm": {
        const result = await args.service.warm(normalizeAdminWithin(args.input));
        if (!result.ok) {
          return errorResponse(result.error.code, result.error.message);
        }
        const payload = { workers: result.value };
        return successResponse(
          JSON.stringify(payload, null, 2),
          payload
        );
      }
      case "router_evict": {
        const result = await args.service.evict(normalizeAdminWithin(args.input));
        if (!result.ok) {
          return errorResponse(result.error.code, result.error.message);
        }
        return successResponse(
          JSON.stringify(result.value, null, 2),
          result.value
        );
      }
    }
  } catch (caught) {
    if (caught instanceof z2.ZodError) {
      return errorResponse(
        "INVALID_REQUEST",
        caught.issues.map((issue) => issue.message).join("; ")
      );
    }
    return errorResponse(
      "INTERNAL_ERROR",
      caught instanceof Error ? caught.message : String(caught)
    );
  }
}
var MCP_INPUT_SCHEMAS = {
  find_files: findFilesInputSchema,
  grep: grepInputSchema,
  router_status: z2.strictObject({}),
  router_warm: adminWithinSchema,
  router_evict: adminWithinSchema
};

// lib/fff-router/mcp-server.ts
function createMcpServer(args) {
  if (!args.service && !args.handler) {
    throw new Error("createMcpServer requires a RouterService or MCP tool handler");
  }
  async function callTool(name, input) {
    if (args.handler) {
      return await args.handler(name, input);
    }
    return await executeMcpTool({
      service: args.service,
      name,
      input,
      env: args.env
    });
  }
  function toSdkServer() {
    const server = new McpServer({
      name: "fff-router",
      version: PACKAGE_VERSION
    });
    for (const tool of MCP_TOOLS) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: MCP_INPUT_SCHEMAS[tool.name].shape
        },
        async (input) => await callTool(tool.name, input)
      );
    }
    return server;
  }
  return {
    listTools: async () => listMcpTools(),
    callTool,
    toSdkServer,
    async connectStdio(options = {}) {
      const transport = new StdioServerTransport();
      transport.onclose = options.onClose;
      const server = toSdkServer();
      await server.connect(transport);
      return { server, transport };
    }
  };
}

// lib/fff-router/local-auth.ts
import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
function validToken(value) {
  return /^[A-Za-z0-9_-]{32,}$/.test(value);
}
async function readDaemonAuthToken(env = process.env) {
  try {
    const token = (await readFile(getDaemonPaths({ env }).authTokenPath, "utf8")).trim();
    return validToken(token) ? token : null;
  } catch {
    return null;
  }
}
async function ensureDaemonAuthToken(env = process.env) {
  const paths = getDaemonPaths({ env });
  await mkdir(paths.dir, { recursive: true, mode: 448 });
  if (process.platform !== "win32") {
    await chmod(paths.dir, 448);
  }
  const existing = await readDaemonAuthToken(env);
  if (existing) {
    if (process.platform !== "win32") {
      await chmod(paths.authTokenPath, 384);
    }
    return existing;
  }
  const token = randomBytes(32).toString("base64url");
  try {
    await writeFile(paths.authTokenPath, `${token}
`, { flag: "wx", mode: 384 });
    return token;
  } catch (caught) {
    if (typeof caught === "object" && caught && "code" in caught && caught.code === "EEXIST") {
      const raced = await readDaemonAuthToken(env);
      if (raced) {
        return raced;
      }
    }
    throw caught;
  }
}
function isAuthorized(authorization, expectedToken) {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return false;
  }
  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

// lib/fff-router/runtime-manager.ts
function unavailable(message, retryable = true) {
  return {
    ok: false,
    error: { code: "WORKER_UNAVAILABLE", message, retryable }
  };
}
async function closeBestEffort2(runtime) {
  if (!runtime) {
    return;
  }
  await Promise.resolve(runtime.close()).catch(() => {
  });
}
var WorkerPool = class {
  constructor(options) {
    this.options = options;
    this.now = options.now ?? Date.now;
    this.sweepTimer = this.createSweepTimer(options.sweepIntervalMs);
  }
  options;
  entries = /* @__PURE__ */ new Map();
  deadDiagnostics = [];
  now;
  sweepTimer;
  generation = 0;
  closed = false;
  createSweepTimer(intervalMs) {
    const timer = setInterval(() => void this.sweep(), Math.max(100, intervalMs));
    timer.unref?.();
    return timer;
  }
  updateOptions(options, ttl) {
    if (!this.closed && options.sweepIntervalMs !== this.options.sweepIntervalMs) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = this.createSweepTimer(options.sweepIntervalMs);
    }
    this.options = { ...options, now: this.options.now };
    if (ttl) {
      for (const entry of this.entries.values()) {
        entry.ttlMs = entry.rootType === "git" ? ttl.gitMs : ttl.nonGitMs;
      }
    }
  }
  toDiagnostic(entry) {
    return {
      root: entry.root,
      rootType: entry.rootType,
      state: entry.state,
      ...entry.runtime?.id ? { workerId: entry.runtime.id } : {},
      ...entry.runtime?.pid !== void 0 ? { pid: entry.runtime.pid } : {},
      generation: entry.generation,
      activeLeases: entry.activeLeases,
      ...entry.startedAt !== void 0 ? { startedAt: entry.startedAt } : {},
      lastUsedAt: entry.lastUsedAt,
      ...entry.lastCallAt !== void 0 ? { lastCallAt: entry.lastCallAt } : {},
      ...entry.lastSuccessAt !== void 0 ? { lastSuccessAt: entry.lastSuccessAt } : {},
      ...entry.lastError !== void 0 ? { lastError: entry.lastError } : {},
      ...entry.lastErrorAt !== void 0 ? { lastErrorAt: entry.lastErrorAt } : {},
      failureCount: entry.failureCount,
      ...entry.retryAfter !== void 0 ? { retryAfter: entry.retryAfter } : {}
    };
  }
  rememberDead(entry) {
    const diagnostic = this.toDiagnostic({ ...entry, state: "dead" });
    this.deadDiagnostics.unshift(diagnostic);
    this.deadDiagnostics.splice(this.options.maxDeadDiagnostics ?? 32);
  }
  activeEntries(rootType) {
    return [...this.entries.values()].filter(
      (entry) => entry.state !== "dead" && (rootType === void 0 || entry.rootType === rootType)
    );
  }
  removeIdleLru(rootType) {
    const candidate = this.activeEntries(rootType).filter((entry) => entry.activeLeases === 0 && entry.state !== "starting").sort((left, right) => left.lastUsedAt - right.lastUsedAt)[0];
    if (!candidate) {
      return void 0;
    }
    candidate.detachClose?.();
    candidate.state = "draining";
    this.entries.delete(candidate.root);
    return candidate.runtime;
  }
  reserveCapacity(rootType) {
    const toClose = [];
    if (rootType === "non-git" && this.activeEntries("non-git").length >= this.options.maxNonGitWorkers) {
      const runtime = this.removeIdleLru("non-git");
      if (!runtime) {
        return {
          ok: false,
          error: {
            code: "WORKER_LIMIT_REACHED",
            message: "all non-Git worker slots are busy",
            retryable: true
          }
        };
      }
      toClose.push(runtime);
    }
    if (this.activeEntries().length >= this.options.maxWorkers) {
      const runtime = this.removeIdleLru();
      if (!runtime) {
        return {
          ok: false,
          error: {
            code: "WORKER_LIMIT_REACHED",
            message: "all fff-mcp worker slots are busy",
            retryable: true
          }
        };
      }
      toClose.push(runtime);
    }
    return { ok: true, value: toClose };
  }
  createEntry(spec, previousFailures = 0) {
    const now = this.now();
    const entry = {
      token: Symbol(spec.root),
      root: spec.root,
      rootType: spec.rootType,
      state: "starting",
      generation: ++this.generation,
      activeLeases: 0,
      ttlMs: spec.ttlMs,
      createdAt: now,
      lastUsedAt: now,
      failureCount: previousFailures
    };
    entry.startup = Promise.resolve().then(spec.start).then(async (runtime) => {
      const current = this.entries.get(spec.root);
      if (this.closed || current?.token !== entry.token) {
        await closeBestEffort2(runtime);
        throw new Error(`worker for '${spec.root}' was evicted during startup`);
      }
      const draining = entry.state === "draining";
      entry.runtime = runtime;
      entry.startup = void 0;
      entry.state = draining ? "draining" : "ready";
      entry.startedAt = this.now();
      entry.retryAfter = void 0;
      entry.detachClose = runtime.onClose?.(() => {
        this.markUnexpectedClose(spec.root, entry.token);
      });
      return runtime;
    }).catch((error2) => {
      const current = this.entries.get(spec.root);
      if (current?.token === entry.token) {
        const now2 = this.now();
        entry.startup = void 0;
        entry.state = "dead";
        entry.lastError = error2 instanceof Error ? error2.message : String(error2);
        entry.lastErrorAt = now2;
        entry.failureCount += 1;
        entry.retryAfter = now2 + this.options.restartBackoffMs * entry.failureCount;
      }
      throw error2;
    });
    this.entries.set(spec.root, entry);
    return entry;
  }
  markUnexpectedClose(root, token) {
    const entry = this.entries.get(root);
    if (!entry || entry.token !== token || entry.state === "draining") {
      return;
    }
    const now = this.now();
    entry.detachClose?.();
    entry.detachClose = void 0;
    entry.runtime = void 0;
    entry.state = "dead";
    entry.lastError = "fff-mcp worker exited unexpectedly";
    entry.lastErrorAt = now;
    entry.failureCount += 1;
    entry.retryAfter = now + this.options.restartBackoffMs * entry.failureCount;
  }
  async acquire(spec) {
    if (this.closed) {
      return unavailable("worker pool is closed", false);
    }
    const now = this.now();
    let entry = this.entries.get(spec.root);
    let coldStart = false;
    let runtimesToClose = [];
    let previousFailures = 0;
    if (entry?.state === "dead") {
      if (entry.activeLeases > 0 || (entry.retryAfter ?? 0) > now) {
        return unavailable(
          `fff-mcp worker for '${spec.root}' is backing off after ${entry.failureCount} failure(s)`
        );
      }
      previousFailures = entry.failureCount;
      this.rememberDead(entry);
      this.entries.delete(spec.root);
      entry = void 0;
    }
    if (entry?.state === "draining") {
      return unavailable(`fff-mcp worker for '${spec.root}' is draining`);
    }
    if (!entry) {
      const capacity = this.reserveCapacity(spec.rootType);
      if (!capacity.ok) {
        return capacity;
      }
      runtimesToClose = capacity.value;
      const start = spec.start;
      entry = this.createEntry(
        {
          ...spec,
          start: async () => {
            await Promise.all(runtimesToClose.map(closeBestEffort2));
            return await start();
          }
        },
        previousFailures
      );
      coldStart = true;
    }
    entry.activeLeases += 1;
    entry.lastUsedAt = now;
    entry.ttlMs = spec.ttlMs;
    let runtime;
    try {
      runtime = entry.runtime ?? await entry.startup;
    } catch (error2) {
      await this.release(entry.root, entry.token);
      return unavailable(error2 instanceof Error ? error2.message : String(error2));
    }
    const token = entry.token;
    const generation = entry.generation;
    let released = false;
    return {
      ok: true,
      value: {
        root: entry.root,
        rootType: entry.rootType,
        runtime,
        generation,
        coldStart,
        recordCallStart: () => {
          const current = this.entries.get(entry.root);
          if (current?.token === token) {
            current.lastCallAt = this.now();
          }
        },
        recordCallSuccess: () => {
          const current = this.entries.get(entry.root);
          if (current?.token === token) {
            current.lastSuccessAt = this.now();
            current.failureCount = 0;
          }
        },
        recordCallError: (error2) => {
          const current = this.entries.get(entry.root);
          if (current?.token === token) {
            current.lastError = error2;
            current.lastErrorAt = this.now();
          }
        },
        release: async () => {
          if (released) {
            return;
          }
          released = true;
          await this.release(entry.root, token);
        }
      }
    };
  }
  async release(root, token) {
    const entry = this.entries.get(root);
    if (!entry || entry.token !== token) {
      return;
    }
    entry.activeLeases = Math.max(0, entry.activeLeases - 1);
    entry.lastUsedAt = this.now();
    if (entry.activeLeases === 0 && entry.state === "draining") {
      entry.detachClose?.();
      this.entries.delete(root);
      this.rememberDead(entry);
      await closeBestEffort2(entry.runtime);
    }
  }
  async invalidate(root, generation, reason) {
    const entry = this.entries.get(root);
    if (!entry || entry.generation !== generation) {
      return;
    }
    entry.lastError = reason;
    entry.lastErrorAt = this.now();
    entry.failureCount += 1;
    entry.state = "draining";
    if (entry.activeLeases === 0) {
      entry.detachClose?.();
      this.entries.delete(root);
      this.rememberDead(entry);
      await closeBestEffort2(entry.runtime);
    }
  }
  async evict(root) {
    const entry = this.entries.get(root);
    if (!entry) {
      return false;
    }
    entry.state = "draining";
    if (entry.activeLeases === 0) {
      entry.detachClose?.();
      this.entries.delete(root);
      this.rememberDead(entry);
      await closeBestEffort2(entry.runtime);
    }
    return true;
  }
  async evictAll() {
    await Promise.all([...this.entries.keys()].map((root) => this.evict(root)));
  }
  async sweep() {
    if (this.closed) {
      return;
    }
    const now = this.now();
    const expired = [...this.entries.values()].filter(
      (entry) => entry.state === "ready" && entry.activeLeases === 0 && entry.lastUsedAt + entry.ttlMs <= now
    );
    await Promise.all(expired.map((entry) => this.evict(entry.root)));
    const capacityClosures = [];
    while (this.activeEntries("non-git").length > this.options.maxNonGitWorkers) {
      const runtime = this.removeIdleLru("non-git");
      if (!runtime) {
        break;
      }
      capacityClosures.push(runtime);
    }
    while (this.activeEntries().length > this.options.maxWorkers) {
      const runtime = this.removeIdleLru();
      if (!runtime) {
        break;
      }
      capacityClosures.push(runtime);
    }
    await Promise.all(capacityClosures.map(closeBestEffort2));
  }
  getDiagnostics() {
    return [
      ...[...this.entries.values()].sort((left, right) => left.root.localeCompare(right.root)).map((entry) => this.toDiagnostic(entry)),
      ...this.deadDiagnostics
    ];
  }
  async closeAll() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    clearInterval(this.sweepTimer);
    const entries = [...this.entries.values()];
    this.entries.clear();
    for (const entry of entries) {
      entry.detachClose?.();
      entry.state = "draining";
    }
    await Promise.all(entries.map((entry) => closeBestEffort2(entry.runtime)));
    await Promise.all(entries.map((entry) => entry.startup?.catch(() => {
    })));
  }
};

// lib/fff-router/http-daemon.ts
var MAX_REQUEST_BODY_BYTES = 1024 * 1024;
function assertLocalHost(host) {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized !== "localhost" && normalized !== "::1" && !(isIP2(normalized) === 4 && normalized.startsWith("127."))) {
    throw new Error("fff-routerd only binds to a local loopback address");
  }
}
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_REQUEST_BODY_BYTES) {
      throw new Error(`request body exceeds ${MAX_REQUEST_BODY_BYTES} bytes`);
    }
    chunks.push(buffer);
  }
  return chunks.length === 0 ? void 0 : JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function readDaemonMetadata(pathValue) {
  try {
    return JSON.parse(await readFile2(pathValue, "utf8"));
  } catch {
    return null;
  }
}
async function writeDaemonMetadata(pathValue, metadata) {
  const temporaryPath = `${pathValue}.${process.pid}.tmp`;
  await writeFile2(temporaryPath, `${JSON.stringify(metadata, null, 2)}
`, {
    mode: 384
  });
  await rename(temporaryPath, pathValue);
}
function poolOptions(config) {
  return {
    maxWorkers: config.limits.maxWorkers,
    maxNonGitWorkers: config.limits.maxNonGitWorkers,
    sweepIntervalMs: config.runtime.sweepIntervalMs,
    restartBackoffMs: config.runtime.restartBackoffMs
  };
}
function createDefaultService(args) {
  return createRouterService({
    configRef: args.configRef,
    adapter: createFffMcpStdioAdapter(),
    workerPool: args.workerPool
  });
}
function shouldReloadForWatchEvent(filename) {
  return !filename || filename === "config.json" || filename === "config.jsonc";
}
function buildMetadata(args) {
  return {
    pid: process.pid,
    host: args.config.host,
    port: args.port,
    mcpPath: args.config.mcpPath,
    protocolVersion: DAEMON_PROTOCOL_VERSION,
    packageVersion: PACKAGE_VERSION,
    daemonSourceFingerprint: getDaemonSourceFingerprint({ env: args.env }),
    serverFingerprint: getDaemonServerFingerprint({
      env: args.env,
      daemonConfig: {
        host: args.config.host,
        port: args.port,
        mcpPath: args.config.mcpPath
      }
    }),
    reloadFingerprint: getDaemonReloadFingerprintForConfig(args.reloadConfig),
    startedAt: args.startedAt
  };
}
async function startHttpDaemon(args = {}) {
  const env = args.env ?? process.env;
  const baseConfig = getDaemonConfig({ env });
  const config = {
    host: args.host ?? baseConfig.host,
    port: args.port ?? baseConfig.port,
    mcpPath: args.mcpPath ?? baseConfig.mcpPath
  };
  assertLocalHost(config.host);
  const loadReloadConfig = args.loadReloadConfig ?? loadDaemonReloadConfig;
  const initialReloadConfig = loadReloadConfig({ env });
  const configRef = args.configRef ?? { current: initialReloadConfig.router };
  const workerPool = new WorkerPool(poolOptions(initialReloadConfig.router));
  const service = args.service ?? args.createService?.({ configRef, workerPool }) ?? createDefaultService({ configRef, workerPool });
  const paths = getDaemonPaths({ env });
  const policyConfigPaths = getDaemonPolicyConfigPaths({ env });
  const startedAt = Date.now();
  let metadata = null;
  let watcher = null;
  let watcherReloadTimer = null;
  let reloadChain = Promise.resolve();
  let closing = false;
  const warmConfiguredRoots = (roots) => {
    if (roots.length === 0) {
      return;
    }
    void service.warm(roots).then((result) => {
      if (!result.ok) {
        console.error("fff-routerd warm roots failed:", result.error.message);
      }
    });
  };
  const reload = async (override) => {
    const nextReload = reloadChain.then(async () => {
      if (closing) {
        throw new Error("fff-routerd is closing");
      }
      const nextConfig = override?.loadConfig ? override.loadConfig() : loadReloadConfig({ env });
      const nextMetadata = buildMetadata({
        env,
        config,
        port: metadata?.port ?? config.port,
        reloadConfig: nextConfig,
        startedAt
      });
      configRef.current = nextConfig.router;
      workerPool.updateOptions(poolOptions(nextConfig.router), nextConfig.router.ttl);
      if (override?.clearRuntimes) {
        await workerPool.evictAll();
      }
      await writeDaemonMetadata(paths.metadataPath, nextMetadata);
      metadata = nextMetadata;
      warmConfiguredRoots(nextConfig.router.warmRoots);
    });
    reloadChain = nextReload.catch(() => {
    });
    return await nextReload;
  };
  await mkdir2(paths.dir, { recursive: true, mode: 448 });
  await mkdir2(policyConfigPaths.dir, { recursive: true, mode: 448 });
  const authToken = await ensureDaemonAuthToken(env);
  const server = createServer(async (req, res) => {
    const url = new URL(
      req.url || "/",
      req.headers.host ? `http://${req.headers.host}` : getDaemonOriginFromConfig(config)
    );
    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      const authorized = isAuthorized(req.headers.authorization, authToken);
      res.end(
        JSON.stringify({
          ok: true,
          metadata,
          ...authorized ? service.status() : {}
        })
      );
      return;
    }
    if (url.pathname !== config.mcpPath) {
      res.writeHead(404).end("Not found");
      return;
    }
    if (!isAuthorized(req.headers.authorization, authToken)) {
      res.writeHead(401, {
        "content-type": "application/json",
        "www-authenticate": 'Bearer realm="fff-routerd"'
      });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: void 0
    });
    const mcpServer = createMcpServer({ service, env }).toSdkServer();
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      void transport.close();
      void mcpServer.close();
    };
    res.once("close", cleanup);
    res.once("finish", cleanup);
    try {
      await mcpServer.connect(transport);
      const parsedBody = req.method === "POST" ? await readJsonBody(req) : void 0;
      await transport.handleRequest(req, res, parsedBody);
      if (res.writableEnded || res.destroyed) {
        cleanup();
      }
    } catch (caught) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: caught instanceof Error ? caught.message : String(caught)
            },
            id: null
          })
        );
      }
      cleanup();
    }
  });
  try {
    await new Promise((resolve, reject) => {
      const onError = (caught) => {
        server.off("listening", onListening);
        reject(caught);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.listen(config.port, config.host, onListening);
    });
  } catch (caught) {
    await service.close();
    await workerPool.closeAll();
    throw caught;
  }
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : config.port;
  metadata = buildMetadata({
    env,
    config,
    port: actualPort,
    reloadConfig: initialReloadConfig,
    startedAt
  });
  await writeDaemonMetadata(paths.metadataPath, metadata);
  warmConfiguredRoots(initialReloadConfig.router.warmRoots);
  if (args.watchConfig !== false) {
    watcher = watch(policyConfigPaths.dir, (_eventType, filename) => {
      if (closing || !shouldReloadForWatchEvent(filename?.toString())) {
        return;
      }
      if (watcherReloadTimer) {
        clearTimeout(watcherReloadTimer);
      }
      watcherReloadTimer = setTimeout(() => {
        watcherReloadTimer = null;
        void reload().catch((caught) => {
          console.error("fff-routerd config reload failed:", caught);
        });
      }, 50);
    });
    watcher.on("error", (caught) => {
      console.error("fff-routerd config watcher error:", caught);
    });
  }
  return {
    server,
    get metadata() {
      return metadata;
    },
    paths,
    get url() {
      return `${getDaemonOriginFromConfig({
        host: metadata.host,
        port: metadata.port,
        mcpPath: metadata.mcpPath
      })}${metadata.mcpPath}`;
    },
    reload,
    async close() {
      closing = true;
      if (watcherReloadTimer) {
        clearTimeout(watcherReloadTimer);
      }
      watcher?.close();
      await reloadChain.catch(() => {
      });
      await new Promise((resolve) => server.close(() => resolve()));
      await service.close().catch(() => {
      });
      await workerPool.closeAll().catch(() => {
      });
      await rm(paths.metadataPath, { force: true }).catch(() => {
      });
    }
  };
}
export {
  DAEMON_PROTOCOL_VERSION,
  DEFAULT_DAEMON_HOST,
  DEFAULT_DAEMON_MCP_PATH,
  DEFAULT_DAEMON_PORT,
  PACKAGE_MANAGER,
  PACKAGE_VERSION,
  RouterServiceImpl,
  WorkerPool,
  createFffMcpStdioAdapter,
  createMcpServer,
  createRouterService,
  formatDaemonUrlHost,
  getDaemonConfig,
  getDaemonConfigFingerprint,
  getDaemonEndpoint,
  getDaemonOriginFromConfig,
  getDaemonPaths,
  getDaemonPolicyConfigPaths,
  getDaemonReloadFingerprint,
  getDaemonReloadFingerprintForConfig,
  getDaemonServerFingerprint,
  getDaemonSourceFingerprint,
  getDefaultDaemonConfig,
  getDefaultDaemonFileConfig,
  getDefaultDaemonReloadConfig,
  getDefaultRouterConfig,
  loadDaemonReloadConfig,
  parseJsonWithComments,
  readDaemonMetadata,
  readPreferredDaemonPolicyFile,
  startHttpDaemon
};
