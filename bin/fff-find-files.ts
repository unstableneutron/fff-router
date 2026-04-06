#!/usr/bin/env bun
import { runWrapper } from "../lib/fff-router/wrappers";

runWrapper({
	tool: "fff_find_files",
	argv: process.argv.slice(2),
	callerCwd: process.cwd(),
}).catch((error) => {
	console.error("fff-find-files failed:", error);
	process.exit(1);
});
