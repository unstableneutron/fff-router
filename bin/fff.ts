#!/usr/bin/env node
import { main } from "../lib/fff-router/cli";

// Perry does not currently keep its event loop alive for a pending native FFI
// promise alone (filesystem, fetch, and child-process setup all use that
// bridge). Keep one referenced timer until the command or daemon settles.
const mainKeepalive = setInterval(() => {}, 1_000);
try {
  const exitCode = await main(process.argv.slice(2), process.env);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
} finally {
  clearInterval(mainKeepalive);
}
