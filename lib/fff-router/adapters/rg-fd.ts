import path from "node:path";
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

type RunCommand = (
	command: string,
	args: string[],
	cwd: string,
) => Promise<CommandResult>;

async function defaultRunCommand(
	command: string,
	args: string[],
	cwd: string,
): Promise<CommandResult> {
	try {
		const proc = Bun.spawn([command, ...args], {
			cwd,
			stdout: "pipe",
			stderr: "pipe",
		});
		const [stdout, stderr, exitCode] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		]);

		if (exitCode === 0 || exitCode === 1) {
			return { ok: true, stdout, stderr };
		}

		return { ok: false, kind: "failed", code: exitCode, stderr };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			kind: /ENOENT|not found|No such file/i.test(message)
				? "missing-command"
				: "failed",
			stderr: message,
		};
	}
}

function backendUnavailable(message: string): BackendSearchResult {
	return {
		ok: false,
		error: {
			code: "BACKEND_UNAVAILABLE",
			backendId: "rg-fd",
			message,
		},
	};
}

function searchFailed(message: string): BackendSearchResult {
	return {
		ok: false,
		error: {
			code: "SEARCH_FAILED",
			backendId: "rg-fd",
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

function parseRgJsonMatches(
	stdout: string,
	persistenceRoot: string,
): BackendSearchResult | { ok: true; items: BackendResultItem[] } {
	const items: BackendResultItem[] = [];

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
			return searchFailed("rg returned invalid JSON output");
		}

		if (event.type !== "match" || !event.data?.path?.text) {
			continue;
		}

		const absolutePath = event.data.path.text;
		items.push({
			path: absolutePath,
			relativePath: toRelativePath(persistenceRoot, absolutePath),
			line: event.data.line_number ?? 0,
			text: (event.data.lines?.text ?? "").replace(/\r?\n$/, ""),
			column: event.data.submatches?.[0]?.start,
		});
	}

	return { ok: true, items };
}

export function createRgFdAdapter(deps?: {
	runCommand?: RunCommand;
}): SearchBackendAdapter {
	const runCommand = deps?.runCommand ?? defaultRunCommand;

	return {
		backendId: "rg-fd",
		supportedQueryKinds: ["find_files", "search_terms", "grep"],
		async execute(args) {
			switch (args.request.queryKind) {
				case "find_files": {
					const command = await runCommand(
						"fd",
						[
							"--type",
							"f",
							"--base-directory",
							args.request.persistenceRoot,
							".",
							buildFdTarget(args.request),
						],
						args.request.persistenceRoot,
					);
					if (!command.ok) {
						return mapCommandFailure("fd", command);
					}

					const items = filterItems(
						args.request,
						command.stdout
							.split(/\r?\n/)
							.filter(Boolean)
							.map((relativePath) => ({
								path: path.join(args.request.persistenceRoot, relativePath),
								relativePath: relativePath.replace(/\\/g, "/"),
							}))
							.filter((item) =>
								fuzzyMatch(item.relativePath, args.request.query),
							),
					);

					return {
						ok: true,
						value: {
							backendId: "rg-fd",
							queryKind: "find_files",
							items,
							nextCursor: null,
						},
					};
				}
				case "search_terms": {
					const command = await runCommand(
						"rg",
						[
							"--json",
							"--fixed-strings",
							"--context",
							String(args.request.contextLines),
							...buildGlobArgs(args.request),
							...args.request.terms.flatMap((term) => ["-e", term] as const),
							buildSearchTarget(args.request),
						],
						args.request.persistenceRoot,
					);
					if (!command.ok) {
						return mapCommandFailure("rg", command);
					}

					const parsed = parseRgJsonMatches(
						command.stdout,
						args.request.persistenceRoot,
					);
					if (!parsed.ok) {
						return parsed;
					}

					return {
						ok: true,
						value: {
							backendId: "rg-fd",
							queryKind: "search_terms",
							items: filterItems(args.request, parsed.items),
							nextCursor: null,
						},
					};
				}
				case "grep": {
					const rgArgs = [
						"--json",
						"--context",
						String(args.request.contextLines),
						...buildGlobArgs(args.request),
					];
					if (!args.request.caseSensitive) {
						rgArgs.push("--ignore-case");
					}
					rgArgs.push(
						"-e",
						args.request.pattern,
						buildSearchTarget(args.request),
					);

					const command = await runCommand(
						"rg",
						rgArgs,
						args.request.persistenceRoot,
					);
					if (!command.ok) {
						return mapCommandFailure("rg", command);
					}

					const parsed = parseRgJsonMatches(
						command.stdout,
						args.request.persistenceRoot,
					);
					if (!parsed.ok) {
						return parsed;
					}

					return {
						ok: true,
						value: {
							backendId: "rg-fd",
							queryKind: "grep",
							items: filterItems(args.request, parsed.items),
							nextCursor: null,
						},
					};
				}
			}
		},
	};
}
