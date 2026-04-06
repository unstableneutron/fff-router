import { describe, expect, test } from "bun:test";
import {
	buildWrapperInvocation,
	DEFAULT_MCPORTER_TARGET,
	MCPORTER_CONFIG_PATH,
} from "./wrappers";

describe("buildWrapperInvocation", () => {
	test("defaults the mcporter target to fff-router and resolves within for find_files", async () => {
		const invocation = await buildWrapperInvocation({
			tool: "fff_find_files",
			argv: ["router", "--within", "src", "--extension", "ts"],
			callerCwd: "/repo",
		});

		expect(invocation).toEqual({
			kind: "call",
			toolName: "fff_find_files",
			target: DEFAULT_MCPORTER_TARGET,
			publicArgs: {
				query: "router",
				within: "/repo/src",
				extensions: ["ts"],
			},
			mcporterArgs: [
				"call",
				"--config",
				MCPORTER_CONFIG_PATH,
				"fff-router.fff_find_files",
				"query=router",
				"within=/repo/src",
				'extensions=["ts"]',
			],
		});
	});

	test("builds search_terms invocations with structured args", async () => {
		const invocation = await buildWrapperInvocation({
			tool: "fff_search_terms",
			argv: [
				"router",
				"coordinator",
				"--context-lines",
				"2",
				"--limit",
				"5",
				"--output-mode",
				"json",
			],
			callerCwd: "/repo",
		});

		expect(invocation.kind).toBe("call");
		if (invocation.kind !== "call") throw new Error("expected call");
		expect(invocation.target).toBe("fff-router");
		expect(invocation.publicArgs).toEqual({
			terms: ["router", "coordinator"],
			context_lines: 2,
			within: "/repo",
			limit: 5,
			output_mode: "json",
		});
		expect(invocation.mcporterArgs[3]).toBe("fff-router.fff_search_terms");
	});

	test("builds grep invocations with case-sensitive flag and target override", async () => {
		const invocation = await buildWrapperInvocation({
			tool: "fff_grep",
			argv: ["plan(Request)?", "--case-sensitive", "--target", "custom-router"],
			callerCwd: "/repo",
		});

		expect(invocation.kind).toBe("call");
		if (invocation.kind !== "call") throw new Error("expected call");
		expect(invocation.target).toBe("custom-router");
		expect(invocation.publicArgs).toEqual({
			pattern: "plan(Request)?",
			case_sensitive: true,
			within: "/repo",
		});
		expect(invocation.mcporterArgs[3]).toBe("custom-router.fff_grep");
	});

	test("renders wrapper help text", async () => {
		const invocation = await buildWrapperInvocation({
			tool: "fff_grep",
			argv: ["--help"],
			callerCwd: "/repo",
		});

		expect(invocation).toEqual({
			kind: "help",
			text: "Usage: fff-grep <pattern> [--within PATH] [--case-sensitive] [--extension EXT] [--exclude-path PATH] [--context-lines N] [--limit N] [--output-mode compact|json] [--target NAME]",
		});
	});
});
