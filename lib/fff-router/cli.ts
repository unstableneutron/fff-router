import { PACKAGE_MANAGER, PACKAGE_VERSION } from "./daemon-config";
import { ensureDaemonRunning, readDaemonLogs } from "./daemon-autostart";
import {
  getDaemonStatus,
  getDoctorReport,
  reloadDaemon,
  runForegroundDaemon,
  stopDaemon,
} from "./daemon-cli";
import { checkFffMcpUpdate, installFffMcpUpdate, runInteractiveUpdate } from "./daemon-update";
import { RouterClient } from "./http-client";
import { runMcpHttpBridge } from "./mcp-bridge";
import type { PublicToolResult, RouterError } from "./types";

class UsageError extends Error {}
class HelpRequested extends Error {}

type SearchArguments = {
  positionals: string[];
  within: string[];
  extensions: string[];
  excludePaths: string[];
  glob?: string;
  limit?: number;
  cursor?: string;
  contextLines?: number;
  literal: boolean;
  json: boolean;
};

const HELP = `fff ${PACKAGE_VERSION} — shared warm repository search

Usage:
  fff find <query...> [options]
  fff grep <pattern...> [options]
  fff warm <path...> [--json]
  fff evict <path...> [--json]
  fff status [--json]
  fff doctor [--json]
  fff setup
  fff update
  fff mcp
  fff daemon <start|stop|restart|reload|logs> [--clear-runtimes]

Search options:
  -w, --within <path>       Search scope; repeat for multiple paths
  -g, --glob <glob>         Include files matching a relative glob
  -e, --extension <ext>     Include extension; repeat or comma-separate
  -x, --exclude <path>      Exclude a relative path or glob; repeatable
  -n, --limit <count>       Return 1-50 results
      --cursor <cursor>     Continue a previous search page
      --json                Emit structured JSON

Grep options:
      --literal             Literal matching (default)
      --regex               Regular-expression matching
  -C, --context <lines>     Include 0-5 surrounding lines

Examples:
  fff find router --within .
  fff grep ActorAuth actor_auth -w . -e ts -e rs
  fff grep 'plan(Request)?' --regex -w src --json
  fff warm ~/src/project-a ~/src/project-b

Install directly from GitHub:
  corepack ${PACKAGE_MANAGER} add --global github:unstableneutron/fff-router
  fff setup
`;

function takeValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new UsageError(`${option} requires a value`);
  }
  return value;
}

function parseInteger(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new UsageError(`${option} must be an integer`);
  }
  return parsed;
}

function parseSearchArguments(argv: string[]): SearchArguments {
  const parsed: SearchArguments = {
    positionals: [],
    within: [],
    extensions: [],
    excludePaths: [],
    literal: true,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === "--") {
      parsed.positionals.push(...argv.slice(index + 1));
      break;
    }
    switch (token) {
      case "-w":
      case "--within":
        parsed.within.push(takeValue(argv, index, token));
        index += 1;
        break;
      case "-g":
      case "--glob":
        parsed.glob = takeValue(argv, index, token);
        index += 1;
        break;
      case "-e":
      case "--extension":
        parsed.extensions.push(
          ...takeValue(argv, index, token)
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
        );
        index += 1;
        break;
      case "-x":
      case "--exclude":
        parsed.excludePaths.push(takeValue(argv, index, token));
        index += 1;
        break;
      case "-n":
      case "--limit":
        parsed.limit = parseInteger(takeValue(argv, index, token), token);
        index += 1;
        break;
      case "--cursor":
        parsed.cursor = takeValue(argv, index, token);
        index += 1;
        break;
      case "-C":
      case "--context":
        parsed.contextLines = parseInteger(takeValue(argv, index, token), token);
        index += 1;
        break;
      case "--literal":
        parsed.literal = true;
        break;
      case "--regex":
        parsed.literal = false;
        break;
      case "--json":
        parsed.json = true;
        break;
      case "-h":
      case "--help":
        throw new HelpRequested(HELP);
      default:
        if (token.startsWith("-")) {
          throw new UsageError(`unknown option: ${token}`);
        }
        parsed.positionals.push(token);
    }
  }
  return parsed;
}

function commonSearchInput(parsed: SearchArguments) {
  return {
    ...(parsed.within.length > 0 ? { within: parsed.within } : {}),
    ...(parsed.glob ? { glob: parsed.glob } : {}),
    ...(parsed.extensions.length > 0 ? { extensions: parsed.extensions } : {}),
    ...(parsed.excludePaths.length > 0 ? { excludePaths: parsed.excludePaths } : {}),
    ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
    ...(parsed.cursor ? { cursor: parsed.cursor } : {}),
  };
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printSearchResult(result: PublicToolResult, json: boolean): void {
  if (json) {
    printJson(result);
    return;
  }
  process.stdout.write(`${result.displayText ?? JSON.stringify(result.items, null, 2)}\n`);
}

function throwRouterError(error: RouterError): never {
  throw new Error(`${error.code}: ${error.message}`);
}

async function withCliClient<T>(
  env: NodeJS.ProcessEnv,
  callback: (client: RouterClient) => Promise<T>,
): Promise<T> {
  const client = new RouterClient({ env });
  try {
    return await callback(client);
  } finally {
    await client.close();
  }
}

async function runFind(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const parsed = parseSearchArguments(argv);
  if (parsed.positionals.length === 0) {
    throw new UsageError("find requires a query");
  }
  const result = await withCliClient(
    env,
    async (client) =>
      await client.findFiles({
        query: parsed.positionals.join(" "),
        ...commonSearchInput(parsed),
      }),
  );
  if (!result.ok) {
    throwRouterError(result.error);
  }
  printSearchResult(result.value, parsed.json);
  return 0;
}

async function runGrep(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const parsed = parseSearchArguments(argv);
  if (parsed.positionals.length === 0) {
    throw new UsageError("grep requires at least one pattern");
  }
  const result = await withCliClient(
    env,
    async (client) =>
      await client.grep({
        patterns: parsed.positionals,
        literal: parsed.literal,
        ...(parsed.contextLines !== undefined ? { contextLines: parsed.contextLines } : {}),
        ...commonSearchInput(parsed),
      }),
  );
  if (!result.ok) {
    throwRouterError(result.error);
  }
  printSearchResult(result.value, parsed.json);
  return 0;
}

function parsePaths(argv: string[]): { paths: string[]; json: boolean } {
  let json = false;
  const paths: string[] = [];
  let positionalOnly = false;
  for (const entry of argv) {
    if (!positionalOnly && entry === "--") {
      positionalOnly = true;
    } else if (!positionalOnly && (entry === "--help" || entry === "-h")) {
      throw new HelpRequested(HELP);
    } else if (!positionalOnly && entry === "--json") {
      json = true;
    } else if (!positionalOnly && entry.startsWith("-")) {
      throw new UsageError(`unknown option: ${entry}`);
    } else {
      paths.push(entry);
    }
  }
  if (paths.length === 0) {
    throw new UsageError("at least one path is required");
  }
  return { paths, json };
}

function parseJsonOnly(argv: string[], command: string): boolean {
  let json = false;
  for (const entry of argv) {
    if (entry === "--json") {
      json = true;
    } else if (entry === "--help" || entry === "-h") {
      throw new HelpRequested(HELP);
    } else {
      throw new UsageError(`${command} does not accept '${entry}'`);
    }
  }
  return json;
}

function requireNoArguments(argv: string[], command: string): void {
  for (const entry of argv) {
    if (entry === "--help" || entry === "-h") {
      throw new HelpRequested(HELP);
    }
    throw new UsageError(`${command} does not accept '${entry}'`);
  }
}

async function runWarm(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const parsed = parsePaths(argv);
  const result = await withCliClient(env, async (client) => await client.warm(parsed.paths));
  if (!result.ok) {
    throwRouterError(result.error);
  }
  if (parsed.json) {
    printJson(result.value);
  } else {
    for (const worker of result.value.workers) {
      process.stdout.write(
        `warmed ${worker.root} (generation ${worker.generation}${worker.pid ? `, pid ${worker.pid}` : ""})\n`,
      );
    }
  }
  return 0;
}

async function runEvict(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const parsed = parsePaths(argv);
  const result = await withCliClient(env, async (client) => await client.evict(parsed.paths));
  if (!result.ok) {
    throwRouterError(result.error);
  }
  if (parsed.json) {
    printJson(result.value);
  } else if (result.value.evicted.length === 0) {
    process.stdout.write("no matching workers\n");
  } else {
    for (const root of result.value.evicted) {
      process.stdout.write(`evicted ${root}\n`);
    }
  }
  return 0;
}

async function runStatus(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const json = parseJsonOnly(argv, "status");
  const status = await getDaemonStatus(env);
  if (json) {
    printJson(status);
    return status.running ? 0 : 1;
  }
  if (!status.running) {
    process.stdout.write("fff-routerd is not running\n");
    return 1;
  }
  process.stdout.write(
    `fff-routerd ${status.metadata?.packageVersion ?? "unknown"} running (pid ${status.metadata?.pid})\n`,
  );
  const workers = status.workers ?? [];
  process.stdout.write(`${workers.length} worker${workers.length === 1 ? "" : "s"}\n`);
  for (const worker of workers) {
    const rss = worker.resources?.rssBytes;
    process.stdout.write(
      `  ${worker.state.padEnd(8)} ${worker.root} (leases ${worker.activeLeases}, generation ${worker.generation}${rss !== undefined ? `, rss ${Math.ceil(rss / 1_048_576)} MiB` : ""})\n`,
    );
  }
  const client = new RouterClient({ env, autoStart: false });
  try {
    const detailed = await client.status();
    if (detailed.ok && detailed.value.resources) {
      const resources = detailed.value.resources;
      process.stdout.write(
        `memory: daemon ${Math.ceil(resources.daemonRssBytes / 1_048_576)} MiB, workers ${Math.ceil(resources.workerRssBytes / 1_048_576)} MiB, total ${Math.ceil(resources.totalRssBytes / 1_048_576)} MiB\n`,
      );
    }
  } finally {
    await client.close();
  }
  return 0;
}

async function runSetup(env: NodeJS.ProcessEnv): Promise<number> {
  const check = await checkFffMcpUpdate({ env });
  if (check.kind === "unavailable") {
    throw new Error(check.message);
  }
  if (check.kind === "missing" || check.kind === "outdated") {
    const installed = await installFffMcpUpdate(check);
    process.stdout.write(`installed fff-mcp ${check.latestVersion} at ${installed}\n`);
  } else {
    process.stdout.write(`fff-mcp ${check.currentVersion} is installed\n`);
  }
  await ensureDaemonRunning(env);
  process.stdout.write("fff-routerd is ready\n");
  return 0;
}

async function runDaemon(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  if (argv.some((entry) => entry === "--help" || entry === "-h")) {
    throw new HelpRequested(HELP);
  }
  const clearRuntimes = argv.includes("--clear-runtimes");
  const positionals = argv.filter((entry) => entry !== "--clear-runtimes");
  if (positionals.length !== 1) {
    throw new UsageError("daemon requires exactly one action");
  }
  const command = positionals[0];
  if (clearRuntimes && command !== "reload") {
    throw new UsageError("--clear-runtimes is only valid with daemon reload");
  }
  switch (command) {
    case "start":
      await ensureDaemonRunning(env);
      process.stdout.write("fff-routerd is running\n");
      return 0;
    case "stop":
      process.stdout.write(
        (await stopDaemon(env)) ? "stopped fff-routerd\n" : "fff-routerd is not running\n",
      );
      return 0;
    case "restart":
      await stopDaemon(env);
      await ensureDaemonRunning(env);
      process.stdout.write("restarted fff-routerd\n");
      return 0;
    case "reload":
      if (!(await reloadDaemon(env, { clearRuntimes }))) {
        throw new Error("fff-routerd is not running");
      }
      process.stdout.write("reloaded fff-routerd\n");
      return 0;
    case "logs": {
      const logs = await readDaemonLogs(env);
      printJson(logs);
      return 0;
    }
    default:
      throw new UsageError("daemon requires start, stop, restart, reload, or logs");
  }
}

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const [command, ...rest] = argv;
  try {
    switch (command) {
      case undefined:
      case "help":
      case "--help":
      case "-h":
        process.stdout.write(HELP);
        return 0;
      case "--version":
      case "-V":
        process.stdout.write(`${PACKAGE_VERSION}\n`);
        return 0;
      case "find":
        return await runFind(rest, env);
      case "grep":
        return await runGrep(rest, env);
      case "warm":
        return await runWarm(rest, env);
      case "evict":
        return await runEvict(rest, env);
      case "status":
        return await runStatus(rest, env);
      case "doctor":
        parseJsonOnly(rest, "doctor");
        printJson(await getDoctorReport(env));
        return 0;
      case "setup":
        requireNoArguments(rest, "setup");
        return await runSetup(env);
      case "update":
        requireNoArguments(rest, "update");
        return await runInteractiveUpdate({
          env,
          stopDaemon: async () => await stopDaemon(env),
        });
      case "mcp":
        requireNoArguments(rest, "mcp");
        await runMcpHttpBridge({ env });
        return 0;
      case "__daemon":
        requireNoArguments(rest, "__daemon");
        await runForegroundDaemon(env);
        return 0;
      case "daemon":
        return await runDaemon(rest, env);
      default:
        throw new UsageError(`unknown command: ${command}\n\n${HELP}`);
    }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    const stream = caught instanceof HelpRequested ? process.stdout : process.stderr;
    stream.write(`${message.endsWith("\n") ? message : `${message}\n`}`);
    return caught instanceof HelpRequested ? 0 : caught instanceof UsageError ? 2 : 1;
  }
}
