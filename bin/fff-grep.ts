#!/usr/bin/env bun
import { runWrapper } from "../lib/fff-router/wrappers";

runWrapper({
	tool: "fff_grep",
	argv: process.argv.slice(2),
	callerCwd: process.cwd(),
}).catch((error) => {
	console.error("fff-grep failed:", error);
	process.exit(1);
});
