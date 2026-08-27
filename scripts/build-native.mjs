import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PERRY_SOURCE_REVISION = "06137858dc8c6f80975238377138f2f948d6ef88";
const PERRY_SOURCE_VERSION = "0.5.1220";
const PERRY_COMPILE_ATTEMPTS = 3;

function option(name) {
  const direct = process.argv.find((entry) => entry.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hostArtifactName() {
  if (process.platform === "darwin" && process.arch === "arm64") return "fff-darwin-arm64";
  if (process.platform === "linux" && process.arch === "arm64") return "fff-linux-arm64";
  if (process.platform === "linux" && process.arch === "x64") return "fff-linux-x64";
  throw new Error(`unsupported native release host: ${process.platform}-${process.arch}`);
}

async function git(args, options = {}) {
  return await execFileAsync("git", args, {
    maxBuffer: 8 * 1_024 * 1_024,
    ...options,
  });
}

async function preparePerryWorkspace() {
  const configured = process.env.PERRY_WORKSPACE_ROOT;
  const workspace = configured
    ? path.resolve(configured)
    : path.join(rootDir, "dist", "native", ".perry-src");

  if (!configured) {
    await mkdir(workspace, { recursive: true });
    const gitDir = path.join(workspace, ".git");
    const hasRepository = await readFile(path.join(gitDir, "HEAD"), "utf8")
      .then(() => true)
      .catch(() => false);
    if (!hasRepository) {
      await git(["init", workspace]);
      await git([
        "-C",
        workspace,
        "remote",
        "add",
        "origin",
        "https://github.com/PerryTS/perry.git",
      ]);
    } else {
      await git([
        "-C",
        workspace,
        "remote",
        "set-url",
        "origin",
        "https://github.com/PerryTS/perry.git",
      ]);
    }
    await git(["-C", workspace, "fetch", "--depth=1", "origin", PERRY_SOURCE_REVISION]);
    await git(["-C", workspace, "checkout", "--detach", "--force", "FETCH_HEAD"]);
  }

  const manifest = await readFile(path.join(workspace, "Cargo.toml"), "utf8").catch(() => "");
  if (!manifest.includes(`version = "${PERRY_SOURCE_VERSION}"`)) {
    throw new Error(
      `PERRY_WORKSPACE_ROOT must contain Perry ${PERRY_SOURCE_VERSION} source (${PERRY_SOURCE_REVISION})`,
    );
  }
  const revision = (await git(["-C", workspace, "rev-parse", "HEAD"])).stdout.trim();
  if (revision !== PERRY_SOURCE_REVISION) {
    throw new Error(
      `Perry source revision mismatch: expected ${PERRY_SOURCE_REVISION}, got ${revision}`,
    );
  }
  await execFileAsync("cargo", ["--version"], { maxBuffer: 1_024 * 1_024 });
  return workspace;
}

const target = option("--target") ?? process.env.FFF_NATIVE_TARGET;
const output = path.resolve(
  rootDir,
  option("--output") ?? path.join("dist", "native", hostArtifactName()),
);
const perry = path.join(
  rootDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "perry.cmd" : "perry",
);

await mkdir(path.dirname(output), { recursive: true });
const perryWorkspace = await preparePerryWorkspace();
const args = [
  "compile",
  path.join(rootDir, "bin", "fff.ts"),
  "--output",
  output,
  "--strict-eval",
  "--strict-dynamic-import",
  "--strict-unimplemented",
  "--emit-attest",
  ...(target ? ["--target", target] : []),
];

const compileOptions = {
  cwd: rootDir,
  env: {
    ...process.env,
    CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS ?? "2",
    CARGO_HTTP_MULTIPLEXING: process.env.CARGO_HTTP_MULTIPLEXING ?? "false",
    CARGO_HTTP_TIMEOUT: process.env.CARGO_HTTP_TIMEOUT ?? "120",
    CARGO_NET_RETRY: process.env.CARGO_NET_RETRY ?? "5",
    CARGO_TARGET_DIR:
      process.env.CARGO_TARGET_DIR ?? path.join(rootDir, "dist", "native", ".perry-target"),
    PERRY_WORKSPACE_ROOT: perryWorkspace,
  },
  maxBuffer: 32 * 1_024 * 1_024,
};

let lastError;
for (let attempt = 1; attempt <= PERRY_COMPILE_ATTEMPTS; attempt += 1) {
  try {
    await execFileAsync(perry, args, compileOptions);
    lastError = undefined;
    break;
  } catch (error) {
    lastError = error;
    if (attempt < PERRY_COMPILE_ATTEMPTS) {
      process.stderr.write(
        `Perry compile attempt ${attempt} failed; retrying with the preserved Cargo and object caches.\n`,
      );
    }
  }
}
if (lastError) throw lastError;
process.stdout.write(`${output}\n`);
