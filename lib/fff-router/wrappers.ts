import { resolveWithinFromCaller } from "./resolve-within";

export const DEFAULT_MCPORTER_TARGET = "fff-router";
export const MCPORTER_CONFIG_PATH = new URL(
	"../../config/mcporter.json",
	import.meta.url,
).pathname;

type WrapperTool = "fff_find_files" | "fff_search_terms" | "fff_grep";

type ParsedCommonArgs = {
	within: string | null;
	extensions: string[];
	excludePaths: string[];
	limit?: number;
	outputMode?: "compact" | "json";
	target: string;
};

function toCliAssignment(key: string, value: unknown): string {
	if (typeof value === "string") {
		return `${key}=${value}`;
	}

	return `${key}=${JSON.stringify(value)}`;
}

function helpText(tool: WrapperTool): string {
	switch (tool) {
		case "fff_find_files":
			return "Usage: fff-find-files <query> [--within PATH] [--extension EXT] [--exclude-path PATH] [--limit N] [--output-mode compact|json] [--target NAME]";
		case "fff_search_terms":
			return "Usage: fff-search-terms <term> [term...] [--within PATH] [--extension EXT] [--exclude-path PATH] [--context-lines N] [--limit N] [--output-mode compact|json] [--target NAME]";
		case "fff_grep":
			return "Usage: fff-grep <pattern> [--within PATH] [--case-sensitive] [--extension EXT] [--exclude-path PATH] [--context-lines N] [--limit N] [--output-mode compact|json] [--target NAME]";
	}
}

function parseCommonArgs(argv: string[]) {
	const positionals: string[] = [];
	const common: ParsedCommonArgs = {
		within: null,
		extensions: [],
		excludePaths: [],
		target: process.env.FFF_ROUTER_MCPORTER_TARGET ?? DEFAULT_MCPORTER_TARGET,
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
			case "--target":
				if (next) {
					common.target = next;
				}
				index += 1;
				break;
			default:
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

	let toolArgs: Record<string, unknown>;
	switch (args.tool) {
		case "fff_find_files": {
			const query = parsed.positionals.join(" ").trim();
			toolArgs = { query };
			break;
		}
		case "fff_search_terms": {
			toolArgs = { terms: parsed.positionals };
			if (typeof parsed.extra.contextLines === "number") {
				toolArgs.context_lines = parsed.extra.contextLines;
			}
			break;
		}
		case "fff_grep": {
			const pattern = parsed.positionals.join(" ").trim();
			toolArgs = { pattern };
			if (parsed.extra.caseSensitive) {
				toolArgs.case_sensitive = true;
			}
			if (typeof parsed.extra.contextLines === "number") {
				toolArgs.context_lines = parsed.extra.contextLines;
			}
			break;
		}
	}

	toolArgs.within = resolvedWithin.value.resolvedWithin;
	if (parsed.common.extensions.length > 0) {
		toolArgs.extensions = parsed.common.extensions;
	}
	if (parsed.common.excludePaths.length > 0) {
		toolArgs.exclude_paths = parsed.common.excludePaths;
	}
	if (typeof parsed.common.limit === "number") {
		toolArgs.limit = parsed.common.limit;
	}
	if (parsed.common.outputMode) {
		toolArgs.output_mode = parsed.common.outputMode;
	}

	const mcporterArgs = [
		"call",
		"--config",
		MCPORTER_CONFIG_PATH,
		`${parsed.common.target}.${args.tool}`,
		...Object.entries(toolArgs).map(([key, value]) =>
			toCliAssignment(key, value),
		),
	];

	return {
		kind: "call" as const,
		toolName: args.tool,
		target: parsed.common.target,
		publicArgs: toolArgs,
		mcporterArgs,
	};
}

export async function runWrapper(args: {
	tool: WrapperTool;
	argv: string[];
	callerCwd: string;
}) {
	const invocation = await buildWrapperInvocation(args);
	if (invocation.kind === "help") {
		console.log(invocation.text);
		return;
	}

	process.env.MCPORTER_DISABLE_AUTORUN = "1";
	const { runCli } = await import("mcporter/cli");
	await runCli(invocation.mcporterArgs);
}
