#!/usr/bin/env node
import { main } from "../lib/fff-router/daemon-cli";

const mainKeepalive = setInterval(() => {}, 1_000);
try {
  const exitCode = await main(process.argv.slice(2), process.env);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
} catch (error) {
  console.error("fff-routerd failed:", error);
  process.exit(1);
} finally {
  clearInterval(mainKeepalive);
}
