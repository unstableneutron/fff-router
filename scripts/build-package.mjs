import { chmod, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
];

function externalPatterns() {
  return externalPackages.flatMap((pkg) => [pkg, `${pkg}/*`]);
}

async function ensureHashbang(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const contents = await readFile(absolutePath, "utf8");
  if (!contents.startsWith("#!/usr/bin/env node")) {
    await writeFile(absolutePath, `#!/usr/bin/env node\n${contents}`);
  }
}

async function markExecutables() {
  for (const relativePath of executableOutputs) {
    await ensureHashbang(relativePath);
    await chmod(path.join(rootDir, relativePath), 0o755);
  }
}

await rm(distDir, { recursive: true, force: true });
await build({
  entryPoints: packageEntrypoints,
  outbase: ".",
  outdir: "dist",
  absWorkingDir: rootDir,
  bundle: true,
  platform: "node",
  target: "node20.6",
  format: "esm",
  external: externalPatterns(),
  logLevel: "info",
});
await markExecutables();
