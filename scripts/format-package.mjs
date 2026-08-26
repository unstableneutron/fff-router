import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "oxfmt";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const supportedExtensions = new Set([".ts", ".mjs", ".json", ".jsonc", ".yaml", ".yml", ".md"]);

async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collect(absolutePath)));
    } else if (supportedExtensions.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }
  return files;
}

const files = [
  ...(await collect(path.join(rootDir, "lib"))),
  ...(await collect(path.join(rootDir, "bin"))),
  ...(await collect(path.join(rootDir, "scripts"))),
  ...[
    "package.json",
    "tsconfig.json",
    "tsconfig.build.json",
    "pnpm-workspace.yaml",
    "README.md",
  ].map((entry) => path.join(rootDir, entry)),
].sort();

const changed = [];
for (const absolutePath of files) {
  const relativePath = path.relative(rootDir, absolutePath);
  const source = await readFile(absolutePath, "utf8");
  const result = await format(relativePath, source);
  if (result.errors.length > 0) {
    throw new Error(
      `Could not format ${relativePath}: ${result.errors.map((error) => error.message).join("; ")}`,
    );
  }
  if (result.code === source) {
    continue;
  }
  changed.push(relativePath);
  if (!checkOnly) {
    await writeFile(absolutePath, result.code);
  }
}

if (checkOnly && changed.length > 0) {
  process.stderr.write(
    `Files need formatting:\n${changed.map((file) => `  ${file}`).join("\n")}\n`,
  );
  process.exitCode = 1;
} else if (!checkOnly) {
  process.stdout.write(`Formatted ${changed.length} file${changed.length === 1 ? "" : "s"}.\n`);
}
