#!/usr/bin/env node
import { runWrapper } from "../lib/fff-router/wrappers";

runWrapper({
  tool: "fff_search_terms",
  argv: process.argv.slice(2),
  callerCwd: process.cwd(),
}).catch((error) => {
  console.error("fff-search-terms failed:", error);
  process.exit(1);
});
