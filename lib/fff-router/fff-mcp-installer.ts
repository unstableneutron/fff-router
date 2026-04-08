import { existsSync } from "node:fs";
import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type DoctorFffMcpStatus =
  | { found: false }
  | {
      found: true;
      path: string;
    };

function defaultInstallDir(env: NodeJS.ProcessEnv): string {
  return env.FFF_MCP_INSTALL_DIR || path.join(env.HOME || os.homedir(), ".local", "bin");
}

export function detectFffMcpTarget(platform = process.platform, arch = process.arch): string {
  switch (platform) {
    case "linux":
      switch (arch) {
        case "x64":
          return "x86_64-unknown-linux-musl";
        case "arm64":
          return "aarch64-unknown-linux-musl";
        default:
          throw new Error(`Unsupported architecture: ${arch}`);
      }
    case "darwin":
      switch (arch) {
        case "x64":
          return "x86_64-apple-darwin";
        case "arm64":
          return "aarch64-apple-darwin";
        default:
          throw new Error(`Unsupported architecture: ${arch}`);
      }
    case "win32":
      switch (arch) {
        case "x64":
          return "x86_64-pc-windows-msvc";
        case "arm64":
          return "aarch64-pc-windows-msvc";
        default:
          throw new Error(`Unsupported architecture: ${arch}`);
      }
    default:
      throw new Error(`Unsupported OS: ${platform}`);
  }
}

export function findFffMcpOnPath(env: NodeJS.ProcessEnv = process.env): string | null {
  const pathValue = env.PATH || process.env.PATH || "";
  const directories = pathValue.split(path.delimiter).filter(Boolean);
  const names =
    process.platform === "win32" ? ["fff-mcp.exe", "fff-mcp.cmd", "fff-mcp"] : ["fff-mcp"];

  for (const directory of directories) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export async function getDoctorFffMcpStatus(
  env: NodeJS.ProcessEnv = process.env,
): Promise<DoctorFffMcpStatus> {
  const foundPath = findFffMcpOnPath(env);
  if (!foundPath) {
    return { found: false };
  }
  return { found: true, path: foundPath };
}

function releaseFilename(target: string): string {
  const extension = target.includes("windows") ? ".exe" : "";
  return `fff-mcp-${target}${extension}`;
}

export async function installFffMcpBinary(
  args: {
    env?: NodeJS.ProcessEnv;
    target?: string;
    getLatestTag?: (target: string) => Promise<string>;
    downloadToFile?: (url: string, destinationPath: string) => Promise<void>;
  } = {},
): Promise<string> {
  const env = args.env ?? process.env;
  const target = args.target ?? detectFffMcpTarget();
  const getLatestTag =
    args.getLatestTag ??
    (async () => {
      throw new Error("getLatestTag not implemented");
    });
  const downloadToFile =
    args.downloadToFile ??
    (async () => {
      throw new Error("downloadToFile not implemented");
    });

  const tag = await getLatestTag(target);
  const installDir = defaultInstallDir(env);
  const filename = releaseFilename(target);
  const binaryName = target.includes("windows") ? "fff-mcp.exe" : "fff-mcp";
  const tempPath = path.join(installDir, `${binaryName}.download`);
  const finalPath = path.join(installDir, binaryName);
  const url = `https://github.com/dmtrKovalenko/fff.nvim/releases/download/${tag}/${filename}`;

  await mkdir(installDir, { recursive: true });
  await downloadToFile(url, tempPath);
  await chmod(tempPath, 0o755);
  await rename(tempPath, finalPath);
  await writeFile(
    path.join(installDir, ".fff-mcp-install.json"),
    `${JSON.stringify({ tag, target, installedAt: Date.now() }, null, 2)}\n`,
  );
  return finalPath;
}
