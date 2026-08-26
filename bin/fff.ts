#!/usr/bin/env node
import { main } from "../lib/fff-router/cli";

main(process.argv.slice(2), process.env).then((exitCode) => {
  process.exitCode = exitCode;
});
