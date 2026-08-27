import { execFile } from "node:child_process";
import { chmod, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const execFileAsync = promisify(execFile);
const packageEntrypoints = [
  "lib/fff-router/index.ts",
  "lib/fff-router/server.ts",
  "lib/fff-router/public-api.ts",
  "lib/fff-router/daemon-autostart.ts",
  "lib/fff-router/http-client.ts",
  "lib/fff-router/resolve-within.ts",
  "lib/fff-router/types.ts",
  "bin/fff.ts",
  "bin/fff-routerd.ts",
];
const executableOutputs = ["dist/bin/fff.js", "dist/bin/fff-routerd.js"];

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
  target: "node22",
  format: "esm",
  logLevel: "info",
});
await execFileAsync(process.execPath, [
  path.join(rootDir, "node_modules", "typescript", "bin", "tsc"),
  "--project",
  path.join(rootDir, "tsconfig.build.json"),
  "--outDir",
  distDir,
]);
await markExecutables();
