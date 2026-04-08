#!/usr/bin/env node
import { main } from "../lib/fff-router/daemon-cli";

main(process.argv.slice(2), process.env)
  .then((exitCode) => {
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  })
  .catch((error) => {
    console.error("fff-routerd failed:", error);
    process.exit(1);
  });
