import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const standaloneDir = path.join(rootDir, "standalone");
const standaloneEntrypoints = [
  "fff-find-files",
  "fff-grep",
  "fff-router-mcp",
  "fff-routerd",
  "fff-search-terms",
] as const;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

await rm(standaloneDir, { recursive: true, force: true });
await mkdir(standaloneDir, { recursive: true });

for (const binaryName of standaloneEntrypoints) {
  const sourcePath = path.join(rootDir, "bin", `${binaryName}.ts`);
  const outputPath = path.join(standaloneDir, binaryName);
  const proc = Bun.spawn(["bun", "build", sourcePath, "--compile", "--outfile", outputPath], {
    cwd: rootDir,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    fail(`Standalone build failed for ${binaryName} with exit code ${exitCode}`);
  }
}
