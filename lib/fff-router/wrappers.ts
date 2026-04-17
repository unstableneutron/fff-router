import { ensureDaemonRunning } from "./daemon-autostart";
import { callPublicToolOverHttp } from "./http-client";
import { resolveWithinFromCaller } from "./resolve-within";
import type { PublicToolRequest } from "./types";

type WrapperTool = "fff_find_files" | "fff_grep";

type ParsedCommonArgs = {
  within: string | null;
  glob?: string;
  extensions: string[];
  excludePaths: string[];
  limit?: number;
  outputMode?: "compact" | "json";
};

function helpText(tool: WrapperTool): string {
  switch (tool) {
    case "fff_find_files":
      return "Usage: fff-find-files <query> [--within PATH] [--glob GLOB] [--extension EXT] [--exclude-path PATH] [--limit N] [--output-mode compact|json]";
    case "fff_grep":
      return "Usage: fff-grep <pattern> [pattern...] [--literal|--regex] [--within PATH] [--glob GLOB] [--case-sensitive] [--extension EXT] [--exclude-path PATH] [--context-lines N] [--limit N] [--output-mode compact|json]\n\n  --literal (default)  Patterns are matched as literal text.\n  --regex              Patterns are matched as regular expressions.";
  }
}

function parseCommonArgs(argv: string[]) {
  const positionals: string[] = [];
  const common: ParsedCommonArgs = {
    within: null,
    extensions: [],
    excludePaths: [],
  };
  const extra: Record<string, unknown> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === undefined) {
      continue;
    }

    switch (token) {
      case "--help":
      case "-h":
        extra.help = true;
        break;
      case "--within":
        common.within = next ?? null;
        index += 1;
        break;
      case "--glob":
        common.glob = next;
        index += 1;
        break;
      case "--extension":
      case "--extensions":
        if (next) {
          common.extensions.push(
            ...next
              .split(",")
              .map((entry) => entry.trim())
              .filter(Boolean),
          );
        }
        index += 1;
        break;
      case "--exclude-path":
        if (next) {
          common.excludePaths.push(next);
        }
        index += 1;
        break;
      case "--limit":
        if (next) {
          common.limit = Number(next);
        }
        index += 1;
        break;
      case "--output-mode":
        if (next === "compact" || next === "json") {
          common.outputMode = next;
        }
        index += 1;
        break;
      case "--context-lines":
        if (next) {
          extra.contextLines = Number(next);
        }
        index += 1;
        break;
      case "--case-sensitive":
        extra.caseSensitive = true;
        break;
      case "--literal":
        extra.literal = true;
        break;
      case "--regex":
        extra.literal = false;
        break;
      default:
        if (token.startsWith("-")) {
          throw new Error(`unknown option: ${token}`);
        }
        positionals.push(token);
        break;
    }
  }

  return { common, extra, positionals };
}

export async function buildWrapperInvocation(args: {
  tool: WrapperTool;
  argv: string[];
  callerCwd: string;
}) {
  const parsed = parseCommonArgs(args.argv);
  if (parsed.extra.help) {
    return {
      kind: "help" as const,
      text: helpText(args.tool),
    };
  }

  const resolvedWithin = await resolveWithinFromCaller({
    callerCwd: args.callerCwd,
    within: parsed.common.within,
  });
  if (!resolvedWithin.ok) {
    throw new Error(resolvedWithin.error.message);
  }

  const base = {
    within: resolvedWithin.value.resolvedWithin,
    ...(parsed.common.glob ? { glob: parsed.common.glob } : {}),
    extensions: parsed.common.extensions,
    excludePaths: parsed.common.excludePaths,
    limit: parsed.common.limit ?? 20,
    cursor: null,
    outputMode: parsed.common.outputMode ?? "compact",
  };

  let publicRequest: PublicToolRequest;
  switch (args.tool) {
    case "fff_find_files":
      publicRequest = {
        tool: args.tool,
        query: parsed.positionals.join(" ").trim(),
        ...base,
      };
      break;
    case "fff_grep":
      publicRequest = {
        tool: args.tool,
        patterns: parsed.positionals,
        // Default to literal on the CLI; `--regex` opts into regex semantics.
        literal: parsed.extra.literal !== false,
        caseSensitive: parsed.extra.caseSensitive === true,
        contextLines: typeof parsed.extra.contextLines === "number" ? parsed.extra.contextLines : 0,
        ...base,
      };
      break;
  }

  return {
    kind: "call" as const,
    toolName: args.tool,
    publicRequest,
  };
}

type RunWrapperDeps = {
  env?: NodeJS.ProcessEnv;
  ensureDaemon?: (env?: NodeJS.ProcessEnv) => Promise<void>;
  callTool?: (
    request: PublicToolRequest,
    env?: NodeJS.ProcessEnv,
  ) => Promise<Awaited<ReturnType<typeof callPublicToolOverHttp>>>;
};

export async function runWrapper(
  args: {
    tool: WrapperTool;
    argv: string[];
    callerCwd: string;
  },
  deps: RunWrapperDeps = {},
) {
  const env = deps.env ?? process.env;
  const invocation = await buildWrapperInvocation(args);
  if (invocation.kind === "help") {
    console.log(invocation.text);
    return;
  }

  await (deps.ensureDaemon ?? ensureDaemonRunning)(env);
  const result = await (deps.callTool ?? callPublicToolOverHttp)(invocation.publicRequest, env);
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }

  process.stdout.write(`${JSON.stringify(result.value, null, 2)}\n`);
}
