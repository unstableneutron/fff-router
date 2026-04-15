import { spawn } from "node:child_process";
import path from "node:path";
import type { Readable } from "node:stream";
import type { Result } from "../types";
import { filterItems, toRelativePath } from "./common";
import type {
  BackendResultItem,
  BackendSearchRequest,
  BackendSearchResult,
  SearchBackendAdapter,
} from "./types";

type CommandFailureKind = "missing-command" | "failed";

type CommandResult =
  | { ok: true; stdout: string; stderr?: string }
  | { ok: false; kind: CommandFailureKind; code?: number; stderr?: string };

type RunCommand = (command: string, args: string[], cwd: string) => Promise<CommandResult>;

function readStream(stream: Readable | null): Promise<string> {
  if (!stream) {
    return Promise.resolve("");
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    stream.once("error", reject);
    stream.once("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

export async function runCommandWithSpawn(
  command: string,
  args: string[],
  cwd: string,
): Promise<CommandResult> {
  try {
    const proc = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      readStream(proc.stdout),
      readStream(proc.stderr),
      new Promise<number | null>((resolve, reject) => {
        proc.once("error", reject);
        proc.once("close", resolve);
      }),
    ]);

    if (exitCode === 0 || exitCode === 1) {
      return { ok: true, stdout, stderr };
    }

    return { ok: false, kind: "failed", code: exitCode ?? undefined, stderr };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      kind: /ENOENT|not found|No such file/i.test(message) ? "missing-command" : "failed",
      stderr: message,
    };
  }
}

async function defaultRunCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<CommandResult> {
  return runCommandWithSpawn(command, args, cwd);
}

function backendUnavailable(message: string): BackendSearchResult {
  return {
    ok: false,
    error: {
      code: "BACKEND_UNAVAILABLE",
      backendId: "rg",
      message,
    },
  };
}

function searchFailed(message: string): BackendSearchResult {
  return {
    ok: false,
    error: {
      code: "SEARCH_FAILED",
      backendId: "rg",
      message,
    },
  };
}

function mapCommandFailure(
  command: string,
  result: Extract<CommandResult, { ok: false }>,
): BackendSearchResult {
  const message = result.stderr ?? `${command} failed`;
  if (result.kind === "missing-command") {
    return backendUnavailable(message);
  }

  return searchFailed(message);
}

function buildGlobArgs(request: BackendSearchRequest): string[] {
  const args: string[] = [];

  if (request.glob) {
    args.push("--glob", request.glob);
  }

  for (const extension of request.extensions) {
    args.push("--glob", `*.${extension}`);
  }

  for (const excludePath of request.excludePaths) {
    args.push("--glob", `!${excludePath}/**`);
  }

  return args;
}

function buildSearchTarget(request: BackendSearchRequest): string {
  return request.fileRestriction ?? request.within;
}

function buildFdTarget(request: BackendSearchRequest): string {
  if (request.fileRestriction) {
    return toRelativePath(request.persistenceRoot, request.fileRestriction);
  }

  return toRelativePath(request.persistenceRoot, request.within) || ".";
}

function fuzzyMatch(relativePath: string, query: string): boolean {
  const parts = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = relativePath.toLowerCase();
  return parts.every((part) => haystack.includes(part));
}

type ParsedRgMatch = {
  path: string;
  relativePath: string;
  line: number;
  text: string;
  column?: number;
  contextBefore?: string[];
  contextAfter?: string[];
};

function parseRgJsonMatches(
  stdout: string,
  persistenceRoot: string,
): Result<BackendResultItem[], { code: "SEARCH_FAILED"; message: string; backendId: "rg" }> {
  const items: ParsedRgMatch[] = [];
  const pendingBefore = new Map<string, string[]>();
  const lastMatchIndexByPath = new Map<string, number>();

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    let event: {
      type?: string;
      data?: {
        path?: { text?: string };
        line_number?: number;
        lines?: { text?: string };
        submatches?: Array<{ start?: number }>;
      };
    };
    try {
      event = JSON.parse(line);
    } catch {
      return {
        ok: false,
        error: {
          code: "SEARCH_FAILED",
          backendId: "rg",
          message: "rg returned invalid JSON output",
        },
      };
    }

    const data = event.data;
    const absolutePath = data?.path?.text;
    if (!absolutePath || !data) {
      continue;
    }

    const cleanText = (data.lines?.text ?? "").replace(/\r?\n$/, "");
    const before = pendingBefore.get(absolutePath) ?? [];

    if (event.type === "context") {
      if (cleanText) {
        before.push(cleanText);
        pendingBefore.set(absolutePath, before);

        const lastMatchIndex = lastMatchIndexByPath.get(absolutePath);
        if (typeof lastMatchIndex === "number") {
          const lastMatch = items[lastMatchIndex];
          if (lastMatch) {
            const contextAfter = lastMatch.contextAfter ?? [];
            contextAfter.push(cleanText);
            lastMatch.contextAfter = contextAfter;
          }
        }
      }
      continue;
    }

    if (event.type !== "match") {
      continue;
    }

    items.push({
      path: absolutePath,
      relativePath: toRelativePath(persistenceRoot, absolutePath),
      line: data.line_number ?? 0,
      text: cleanText,
      column: data.submatches?.[0]?.start,
      ...(before.length > 0 ? { contextBefore: [...before] } : {}),
    });
    pendingBefore.set(absolutePath, []);
    lastMatchIndexByPath.set(absolutePath, items.length - 1);
  }

  return { ok: true, value: items };
}

export function createRgAdapter(deps?: { runCommand?: RunCommand }): SearchBackendAdapter {
  const runCommand = deps?.runCommand ?? defaultRunCommand;

  return {
    backendId: "rg",
    supportedQueryKinds: ["find_files", "search_terms", "grep"],
    async execute(args) {
      switch (args.request.queryKind) {
        case "find_files": {
          const request = args.request;
          const command = await runCommand(
            "fd",
            [
              "--type",
              "f",
              "--base-directory",
              request.persistenceRoot,
              ...buildGlobArgs(request),
              ".",
              buildFdTarget(request),
            ],
            request.persistenceRoot,
          );
          if (!command.ok) {
            return mapCommandFailure("fd", command);
          }

          const items = filterItems(
            request,
            command.stdout
              .split(/\r?\n/)
              .filter(Boolean)
              .map((relativePath) => ({
                path: path.join(request.persistenceRoot, relativePath),
                relativePath: relativePath.replace(/\\/g, "/"),
              }))
              .filter((item) => fuzzyMatch(item.relativePath, request.query)),
          );

          return {
            ok: true,
            value: {
              backendId: "rg",
              queryKind: "find_files",
              items,
              nextCursor: null,
            },
          };
        }
        case "search_terms": {
          const request = args.request;
          const command = await runCommand(
            "rg",
            [
              "--json",
              "--fixed-strings",
              "--context",
              String(request.contextLines),
              ...buildGlobArgs(request),
              ...request.terms.flatMap((term) => ["-e", term] as const),
              buildSearchTarget(request),
            ],
            request.persistenceRoot,
          );
          if (!command.ok) {
            return mapCommandFailure("rg", command);
          }

          const parsed = parseRgJsonMatches(command.stdout, request.persistenceRoot);
          if (!parsed.ok) {
            return parsed;
          }

          return {
            ok: true,
            value: {
              backendId: "rg",
              queryKind: "search_terms",
              items: filterItems(request, parsed.value),
              nextCursor: null,
            },
          };
        }
        case "grep": {
          const request = args.request;
          const rgArgs = [
            "--json",
            "--context",
            String(request.contextLines),
            ...buildGlobArgs(request),
          ];
          if (!request.caseSensitive) {
            rgArgs.push("--ignore-case");
          }
          rgArgs.push("-e", request.pattern, buildSearchTarget(request));

          const command = await runCommand("rg", rgArgs, request.persistenceRoot);
          if (!command.ok) {
            return mapCommandFailure("rg", command);
          }

          const parsed = parseRgJsonMatches(command.stdout, request.persistenceRoot);
          if (!parsed.ok) {
            return parsed;
          }

          return {
            ok: true,
            value: {
              backendId: "rg",
              queryKind: "grep",
              items: filterItems(request, parsed.value),
              nextCursor: null,
            },
          };
        }
      }
    },
  };
}
