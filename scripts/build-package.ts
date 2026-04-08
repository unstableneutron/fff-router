import { chmod, rm } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const distDir = path.join(rootDir, "dist");
const packageEntrypoints = [
  "lib/fff-router/index.ts",
  "lib/fff-router/public-api.ts",
  "lib/fff-router/daemon-autostart.ts",
  "lib/fff-router/http-client.ts",
  "lib/fff-router/resolve-within.ts",
  "lib/fff-router/types.ts",
  "bin/fff-find-files.ts",
  "bin/fff-grep.ts",
  "bin/fff-routerd.ts",
  "bin/fff-search-terms.ts",
];
const externalPackages = [
  "@ff-labs/fff-node",
  "@modelcontextprotocol/sdk",
  "@sinclair/typebox",
  "zod",
];
const executableOutputs = [
  "dist/bin/fff-find-files.js",
  "dist/bin/fff-grep.js",
  "dist/bin/fff-routerd.js",
  "dist/bin/fff-search-terms.js",
];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function runCommand(args: string[], errorLabel: string): Promise<void> {
  const proc = Bun.spawn(args, {
    cwd: rootDir,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    fail(`${errorLabel} failed with exit code ${exitCode}`);
  }
}

async function markExecutables(): Promise<void> {
  for (const relativePath of executableOutputs) {
    await chmod(path.join(rootDir, relativePath), 0o755);
  }
}

await rm(distDir, { recursive: true, force: true });
await runCommand(
  [
    "bun",
    "build",
    ...packageEntrypoints,
    "--target",
    "node",
    "--format",
    "esm",
    ...externalPackages.flatMap((pkg) => ["--external", pkg]),
    "--root",
    ".",
    "--outdir",
    "dist",
  ],
  "Package JS build",
);
await runCommand(["bunx", "tsc", "-p", "tsconfig.build.json"], "Declaration build");
await markExecutables();
