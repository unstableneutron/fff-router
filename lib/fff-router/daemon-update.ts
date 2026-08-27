import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as processStdin, stdout as processStdout } from "node:process";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { PACKAGE_MANAGER, PACKAGE_VERSION } from "./daemon-config";
import { detectFffMcpTarget } from "./fff-mcp-installer";

const execFileAsync = promisify(execFile);
const FFF_MCP_REPO = "dmtrKovalenko/fff";
const FFF_ROUTER_GITHUB_PACKAGE_JSON =
  "https://raw.githubusercontent.com/unstableneutron/fff-router/main/package.json";
const FFF_ROUTER_GITHUB_SPEC = "github:unstableneutron/fff-router";
const NETWORK_TIMEOUT_MS = 30_000;
const CURL_MAX_TIME_SECONDS = 60;
const IS_PERRY = typeof (process.versions as Record<string, string | undefined>).perry === "string";

type FffMcpRelease = {
  tag: string;
  version: string;
  assetUrl: string;
  checksumUrl: string;
};

export type FffMcpUpdatePlan = {
  kind: "missing" | "outdated";
  binaryPath: string;
  target: string;
  currentVersion: string | null;
  latestVersion: string;
  latestTag: string;
  assetUrl: string;
  checksumUrl: string;
};

export type FffMcpUpdateCheck =
  | FffMcpUpdatePlan
  | {
      kind: "current";
      binaryPath: string;
      target: string;
      currentVersion: string;
      latestVersion: string;
      latestTag: string;
    }
  | { kind: "unavailable"; binaryPath: string; message: string };

export type FffRouterdUpdateCheck =
  | {
      kind: "outdated";
      currentVersion: string;
      latestVersion: string;
      installer: "corepack-pnpm" | "aube" | "pnpm";
      command: string[];
    }
  | { kind: "current"; currentVersion: string; latestVersion: string }
  | { kind: "unavailable"; currentVersion: string; message: string };

type Confirm = (question: string) => Promise<boolean>;

export type RunInteractiveUpdateOptions = {
  env?: NodeJS.ProcessEnv;
  checkFffMcpUpdate?: () => Promise<FffMcpUpdateCheck>;
  checkFffRouterdUpdate?: () => Promise<FffRouterdUpdateCheck>;
  installFffMcpUpdate?: (plan: FffMcpUpdatePlan) => Promise<string>;
  installFffRouterdUpdate?: (
    plan: Extract<FffRouterdUpdateCheck, { kind: "outdated" }>,
  ) => Promise<void>;
  stopDaemon?: () => Promise<boolean>;
  confirm?: Confirm;
  writeStdout?: (text: string) => void;
  writeStderr?: (text: string) => void;
};

function defaultInstallDir(env: NodeJS.ProcessEnv): string {
  return env.FFF_MCP_INSTALL_DIR || path.join(env.HOME || os.homedir(), ".local", "bin");
}

function fffMcpBinaryPath(env: NodeJS.ProcessEnv, target: string): string {
  return path.join(defaultInstallDir(env), target.includes("windows") ? "fff-mcp.exe" : "fff-mcp");
}

function releaseFilename(target: string): string {
  const extension = target.includes("windows") ? ".exe" : "";
  return `fff-mcp-${target}${extension}`;
}

function stripLeadingV(version: string): string {
  return version.replace(/^v/i, "");
}

function compareVersions(left: string, right: string): number {
  const leftParts = stripLeadingV(left)
    .split(/[.-]/)
    .map((part) => Number(part));
  const rightParts = stripLeadingV(right)
    .split(/[.-]/)
    .map((part) => Number(part));
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index]! : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index]! : 0;
    if (leftValue < rightValue) {
      return -1;
    }
    if (leftValue > rightValue) {
      return 1;
    }
  }

  return 0;
}

function parseFffMcpVersion(text: string): string | null {
  const match =
    text.match(/fff-mcp\s+([0-9]+(?:\.[0-9]+){1,3})/i) ?? text.match(/([0-9]+(?:\.[0-9]+){1,3})/);
  return match?.[1] ?? null;
}

async function readInstalledFffMcpVersion(binaryPath: string): Promise<string | null> {
  if (!existsSync(binaryPath)) {
    return null;
  }
  const manifestPath = path.join(path.dirname(binaryPath), ".fff-mcp-install.json");
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        version?: unknown;
      };
      if (typeof manifest.version === "string") {
        const version = parseFffMcpVersion(manifest.version);
        if (version) {
          return version;
        }
      }
    } catch {
      // Fall through to probing an unmanaged or corrupt installation on Node.
    }
  }
  // Perry does not currently deliver child-process completion callbacks reliably
  // for short-lived commands. Managed native installs always have the manifest
  // above, so an unmanaged binary is treated as unknown and safely reinstalled.
  if (IS_PERRY) {
    return null;
  }
  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, ["--version"], { timeout: 5_000 });
    return parseFffMcpVersion(`${stdout}\n${stderr}`);
  } catch {
    return null;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopDetachedProcess(pid: number | undefined): void {
  if (!pid) return;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, "SIGKILL");
  } catch {
    // The command already exited.
  }
}

async function nativeCurlToFile(
  url: string,
  destinationPath: string,
  headers: Record<string, string>,
): Promise<boolean> {
  const nonce = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const statusPath = `${destinationPath}.${nonce}.status`;
  const stderrPath = `${destinationPath}.${nonce}.stderr`;
  rmSync(statusPath, { force: true });
  rmSync(stderrPath, { force: true });
  const command =
    'status_path="$1"; stderr_path="$2"; shift 2; "$@" 2>"$stderr_path"; code=$?; printf "%s\\n" "$code" >"$status_path"';
  const curlArgs = [
    "--fail-with-body",
    "--location",
    "--silent",
    "--show-error",
    "--connect-timeout",
    "10",
    "--max-time",
    String(CURL_MAX_TIME_SECONDS),
    "--proto",
    "=https",
    ...Object.entries(headers).flatMap(([name, value]) => ["--header", `${name}: ${value}`]),
    "--output",
    destinationPath,
    url,
  ];
  const child = spawn(
    "/bin/sh",
    ["-c", command, "fff-router-curl", statusPath, stderrPath, "curl", ...curlArgs],
    {
      detached: process.platform !== "win32",
      stdio: "ignore",
    },
  );
  child.unref();
  const deadline = Date.now() + (CURL_MAX_TIME_SECONDS + 10) * 1_000;

  try {
    let exitCode: number | null = null;
    while (exitCode === null) {
      if (existsSync(statusPath)) {
        const parsed = Number(readFileSync(statusPath, "utf8").trim());
        if (Number.isInteger(parsed)) {
          exitCode = parsed;
          break;
        }
      }
      if (Date.now() >= deadline) {
        stopDetachedProcess(child.pid);
        throw new Error(`curl GET ${url} timed out`);
      }
      await wait(25);
    }
    if (exitCode === 0) {
      return true;
    }
    if (exitCode === 127) {
      return false;
    }
    const stderr = existsSync(stderrPath) ? readFileSync(stderrPath, "utf8").trim() : "";
    throw new Error(`curl GET ${url} failed with exit ${exitCode}: ${stderr || "unknown error"}`);
  } finally {
    rmSync(statusPath, { force: true });
    rmSync(stderrPath, { force: true });
  }
}

async function nativeCurlText(
  url: string,
  headers: Record<string, string>,
): Promise<string | null> {
  if (!IS_PERRY) return null;
  const outputPath = path.join(
    os.tmpdir(),
    `.fff-router-fetch.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`,
  );
  try {
    return (await nativeCurlToFile(url, outputPath, headers))
      ? readFileSync(outputPath, "utf8")
      : null;
  } finally {
    rmSync(outputPath, { force: true });
  }
}

async function fetchResponse(url: string, headers: Record<string, string>): Promise<Response> {
  return await fetch(url, {
    headers,
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
  });
}

async function fetchJson(url: string): Promise<unknown> {
  const headers = {
    accept: "application/vnd.github+json, application/json",
    "user-agent": "fff-routerd-update",
  };
  const nativeText = await nativeCurlText(url, headers);
  if (nativeText !== null) {
    return JSON.parse(nativeText) as unknown;
  }
  const response = await fetchResponse(url, headers);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
  return await response.json();
}

async function fetchText(url: string): Promise<string> {
  const headers = { "user-agent": "fff-routerd-update" };
  const nativeText = await nativeCurlText(url, headers);
  if (nativeText !== null) {
    return nativeText;
  }
  const response = await fetchResponse(url, headers);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
  return await response.text();
}

function isReleaseAsset(value: unknown): value is { name: string; browser_download_url: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "browser_download_url" in value &&
    typeof value.browser_download_url === "string"
  );
}

function isStableReleaseTag(tag: string): boolean {
  return /^v?\d+\.\d+\.\d+$/.test(tag);
}

export function selectLatestFffMcpRelease(releases: unknown[], target: string): FffMcpRelease {
  if (!Array.isArray(releases)) {
    throw new Error("GitHub releases response was not an array");
  }

  const filename = releaseFilename(target);
  for (const release of releases) {
    if (typeof release !== "object" || release === null) {
      continue;
    }
    const releaseRecord = release as { tag_name?: unknown; prerelease?: unknown; assets?: unknown };
    const tag = typeof releaseRecord.tag_name === "string" ? releaseRecord.tag_name : null;
    if (!tag || releaseRecord.prerelease === true || !isStableReleaseTag(tag)) {
      continue;
    }
    const assets: unknown[] = Array.isArray(releaseRecord.assets) ? releaseRecord.assets : [];
    const asset = assets.find(
      (candidate) => isReleaseAsset(candidate) && candidate.name === filename,
    );
    if (!isReleaseAsset(asset)) {
      continue;
    }
    const checksumAsset = assets.find(
      (candidate) => isReleaseAsset(candidate) && candidate.name === `${filename}.sha256`,
    );
    return {
      tag,
      version: stripLeadingV(tag),
      assetUrl: asset.browser_download_url,
      checksumUrl: isReleaseAsset(checksumAsset)
        ? checksumAsset.browser_download_url
        : `${asset.browser_download_url}.sha256`,
    };
  }

  throw new Error(`No fff-mcp release contains ${filename}`);
}

async function getLatestFffMcpRelease(target: string): Promise<FffMcpRelease> {
  const releases = await fetchJson(`https://api.github.com/repos/${FFF_MCP_REPO}/releases`);
  if (!Array.isArray(releases)) {
    throw new Error("GitHub releases response was not an array");
  }
  return selectLatestFffMcpRelease(releases, target);
}

export async function checkFffMcpUpdate(
  args: {
    env?: NodeJS.ProcessEnv;
    target?: string;
    readInstalledVersion?: (binaryPath: string) => Promise<string | null>;
    getLatestRelease?: (target: string) => Promise<FffMcpRelease>;
  } = {},
): Promise<FffMcpUpdateCheck> {
  const env = args.env ?? process.env;
  let target: string;
  let binaryPath: string;
  try {
    target = args.target ?? detectFffMcpTarget();
    binaryPath = fffMcpBinaryPath(env, target);
    const currentVersion = await (args.readInstalledVersion ?? readInstalledFffMcpVersion)(
      binaryPath,
    );
    const latest = await (args.getLatestRelease ?? getLatestFffMcpRelease)(target);
    const common = {
      binaryPath,
      target,
      latestVersion: latest.version,
      latestTag: latest.tag,
    };

    if (!currentVersion) {
      return {
        kind: "missing",
        ...common,
        currentVersion: null,
        assetUrl: latest.assetUrl,
        checksumUrl: latest.checksumUrl,
      };
    }

    if (compareVersions(currentVersion, latest.version) >= 0) {
      return { kind: "current", ...common, currentVersion };
    }

    return {
      kind: "outdated",
      ...common,
      currentVersion,
      assetUrl: latest.assetUrl,
      checksumUrl: latest.checksumUrl,
    };
  } catch (error) {
    target = args.target ?? "unknown";
    binaryPath = fffMcpBinaryPath(env, target);
    return {
      kind: "unavailable",
      binaryPath,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function downloadToFile(url: string, destinationPath: string): Promise<void> {
  const headers = { "user-agent": "fff-routerd-update" };
  if (IS_PERRY && (await nativeCurlToFile(url, destinationPath, headers))) {
    return;
  }
  const response = await fetchResponse(url, headers);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
  writeFileSync(destinationPath, Buffer.from(await response.arrayBuffer()));
}

function extractSha256(text: string): string {
  const match = text.match(/[a-f0-9]{64}/i);
  if (!match) {
    throw new Error("checksum response did not contain a SHA256 digest");
  }
  return match[0].toLowerCase();
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export async function installFffMcpUpdate(
  plan: FffMcpUpdatePlan,
  deps: {
    downloadToFile?: (url: string, destinationPath: string) => Promise<void>;
    fetchText?: (url: string) => Promise<string>;
  } = {},
): Promise<string> {
  const directory = path.dirname(plan.binaryPath);
  const tempPath = path.join(directory, `.fff-mcp.${process.pid}.${Date.now()}.download`);
  mkdirSync(directory, { recursive: true });
  let installed = false;
  try {
    await (deps.downloadToFile ?? downloadToFile)(plan.assetUrl, tempPath);

    const expectedDigest = extractSha256(await (deps.fetchText ?? fetchText)(plan.checksumUrl));
    const actualDigest = sha256File(tempPath);
    if (actualDigest !== expectedDigest) {
      throw new Error(`fff-mcp checksum mismatch: expected ${expectedDigest}, got ${actualDigest}`);
    }

    chmodSync(tempPath, 0o755);
    renameSync(tempPath, plan.binaryPath);
    installed = true;
    writeFileSync(
      path.join(directory, ".fff-mcp-install.json"),
      `${JSON.stringify(
        {
          tag: plan.latestTag,
          target: plan.target,
          version: plan.latestVersion,
          installedAt: Date.now(),
        },
        null,
        2,
      )}\n`,
    );
    return plan.binaryPath;
  } finally {
    if (!installed) {
      rmSync(tempPath, { force: true });
    }
  }
}

function commandExtensions(env: NodeJS.ProcessEnv): string[] {
  if (process.platform !== "win32") {
    return [""];
  }
  return env.PATHEXT?.split(";").filter(Boolean) ?? [".EXE", ".CMD", ".BAT", ".COM"];
}

async function commandExists(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const directories = (env.PATH || process.env.PATH || "").split(path.delimiter).filter(Boolean);
  for (const directory of directories) {
    for (const extension of commandExtensions(env)) {
      const candidate = path.join(directory, extension ? `${command}${extension}` : command);
      try {
        const details = statSync(candidate);
        if (details.isFile() && (process.platform === "win32" || (details.mode & 0o111) !== 0)) {
          return true;
        }
      } catch {
        // Keep scanning PATH.
      }
    }
  }
  return false;
}

async function getLatestFffRouterdVersion(): Promise<string> {
  const parsed = await fetchJson(FFF_ROUTER_GITHUB_PACKAGE_JSON);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    typeof parsed.version !== "string"
  ) {
    throw new Error("fff-router package.json did not contain a version");
  }
  return parsed.version;
}

export async function checkFffRouterdUpdate(
  args: {
    currentVersion?: string;
    getLatestVersion?: () => Promise<string>;
    commandExists?: (command: string) => Promise<boolean>;
  } = {},
): Promise<FffRouterdUpdateCheck> {
  const currentVersion = args.currentVersion ?? PACKAGE_VERSION;
  try {
    const latestVersion = await (args.getLatestVersion ?? getLatestFffRouterdVersion)();
    if (compareVersions(currentVersion, latestVersion) >= 0) {
      return { kind: "current", currentVersion, latestVersion };
    }

    const hasCommand = args.commandExists ?? commandExists;
    let installer: Extract<FffRouterdUpdateCheck, { kind: "outdated" }>["installer"] | null = null;
    let command: string[] | null = null;
    if (await hasCommand("corepack")) {
      installer = "corepack-pnpm";
      command = ["corepack", PACKAGE_MANAGER, "add", "--global", FFF_ROUTER_GITHUB_SPEC];
    } else if (await hasCommand("aube")) {
      installer = "aube";
      command = ["aube", "add", "--global", FFF_ROUTER_GITHUB_SPEC];
    } else if (await hasCommand("pnpm")) {
      installer = "pnpm";
      command = ["pnpm", "add", "--global", FFF_ROUTER_GITHUB_SPEC];
    }
    if (!installer || !command) {
      return {
        kind: "unavailable",
        currentVersion,
        message: `No supported package manager found; install Corepack, pnpm, or aube, then run: corepack ${PACKAGE_MANAGER} add --global ${FFF_ROUTER_GITHUB_SPEC}`,
      };
    }

    return {
      kind: "outdated",
      currentVersion,
      latestVersion,
      installer,
      command,
    };
  } catch (error) {
    return {
      kind: "unavailable",
      currentVersion,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function installFffRouterdUpdate(
  plan: Extract<FffRouterdUpdateCheck, { kind: "outdated" }>,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(plan.command[0]!, plan.command.slice(1), { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${plan.command.join(" ")} exited with code ${code ?? "null"}`));
    });
  });
}

async function defaultConfirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: processStdin, output: processStdout });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

function installerDisplayName(
  installer: Extract<FffRouterdUpdateCheck, { kind: "outdated" }>["installer"],
): string {
  return installer === "corepack-pnpm" ? "Corepack/pnpm" : installer;
}

export async function runInteractiveUpdate(
  options: RunInteractiveUpdateOptions = {},
): Promise<number> {
  const env = options.env ?? process.env;
  const writeStdout = options.writeStdout ?? ((text: string) => process.stdout.write(text));
  const writeStderr = options.writeStderr ?? ((text: string) => process.stderr.write(text));
  const confirm = options.confirm ?? defaultConfirm;
  const checkMcp = options.checkFffMcpUpdate ?? (() => checkFffMcpUpdate({ env }));
  const checkRouterd = options.checkFffRouterdUpdate ?? (() => checkFffRouterdUpdate());
  const applyMcp = options.installFffMcpUpdate ?? installFffMcpUpdate;
  const applyRouterd = options.installFffRouterdUpdate ?? installFffRouterdUpdate;
  const stopDaemon = options.stopDaemon ?? (async () => false);
  let updatedSomething = false;

  const mcp = await checkMcp();
  switch (mcp.kind) {
    case "current":
      writeStdout(`fff-mcp is already up to date (${mcp.currentVersion}).\n`);
      break;
    case "unavailable":
      writeStderr(`Could not check fff-mcp at ${mcp.binaryPath}: ${mcp.message}\n`);
      break;
    case "missing":
    case "outdated": {
      const label = mcp.currentVersion ?? "not installed";
      if (await confirm(`Update fff-mcp ${label} -> ${mcp.latestVersion}?`)) {
        const installedPath = await applyMcp(mcp);
        writeStdout(`Updated fff-mcp to ${mcp.latestVersion} at ${installedPath}.\n`);
        updatedSomething = true;
      } else {
        writeStdout("Skipped fff-mcp update.\n");
      }
      break;
    }
  }

  const routerd = await checkRouterd();
  switch (routerd.kind) {
    case "current":
      writeStdout(`fff-routerd is already up to date (${routerd.currentVersion}).\n`);
      break;
    case "unavailable":
      writeStderr(`Could not check fff-routerd: ${routerd.message}\n`);
      break;
    case "outdated":
      if (
        await confirm(
          `Update fff-routerd ${routerd.currentVersion} -> ${routerd.latestVersion} from GitHub with ${installerDisplayName(routerd.installer)}?`,
        )
      ) {
        await applyRouterd(routerd);
        writeStdout(`Updated fff-routerd to ${routerd.latestVersion}.\n`);
        updatedSomething = true;
      } else {
        writeStdout("Skipped fff-routerd update.\n");
      }
      break;
  }

  if (updatedSomething) {
    const stopped = await stopDaemon();
    if (stopped) {
      writeStdout("Stopped fff-routerd; it will restart on the next request.\n");
    } else {
      writeStdout("fff-routerd was not running; it will start on the next request.\n");
    }
  }

  return 0;
}
