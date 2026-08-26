import { spawn } from "node:child_process";
import { constants as fsConstants, accessSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";

export type ResolvableToolName = "fff-mcp";
export type ToolResolutionSource = "env" | "path" | "managed" | "missing";

export type ToolResolution = {
  tool: ResolvableToolName;
  command: string | null;
  source: ToolResolutionSource;
  envVar: string;
  executable: boolean;
  remediation?: string;
};

export type ToolDiagnostic = ToolResolution & {
  version?: string;
};

const TOOL_ENV_VARS = {
  "fff-mcp": "FFF_ROUTER_FFF_MCP_BIN",
} as const satisfies Record<ResolvableToolName, string>;

function managedInstallPath(env: NodeJS.ProcessEnv): string {
  const installDir =
    env.FFF_MCP_INSTALL_DIR || path.join(env.HOME || os.homedir(), ".local", "bin");
  return path.join(installDir, process.platform === "win32" ? "fff-mcp.exe" : "fff-mcp");
}

function isExecutable(pathValue: string): boolean {
  try {
    accessSync(pathValue, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandExtensions(env: NodeJS.ProcessEnv): string[] {
  if (process.platform !== "win32") {
    return [""];
  }

  const pathExt = env.PATHEXT?.split(";").filter(Boolean);
  return pathExt && pathExt.length > 0 ? pathExt : [".EXE", ".CMD", ".BAT", ".COM"];
}

export function resolveExecutableOnPath(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const pathValue = env.PATH || process.env.PATH || "";
  const directories = pathValue.split(path.delimiter).filter(Boolean);
  const extensions = commandExtensions(env);

  for (const directory of directories) {
    for (const extension of extensions) {
      const candidatePath =
        process.platform === "win32" && extension && !command.toUpperCase().endsWith(extension)
          ? path.join(directory, `${command}${extension}`)
          : path.join(directory, command);
      if (existsSync(candidatePath) && isExecutable(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return null;
}

function remediation(tool: ResolvableToolName, envVar: string): string {
  return `Install ${tool} or set ${envVar} to an executable path.`;
}

export function resolveToolCommand(
  tool: ResolvableToolName,
  deps: {
    env?: NodeJS.ProcessEnv;
    resolveExecutableOnPath?: (command: string) => string | null;
    isExecutable?: (pathValue: string) => boolean;
  } = {},
): ToolResolution {
  const env = deps.env ?? process.env;
  const envVar = TOOL_ENV_VARS[tool];
  const executableCheck = deps.isExecutable ?? isExecutable;
  const override = env[envVar];

  if (override) {
    const executable = executableCheck(override);
    return {
      tool,
      command: override,
      source: "env",
      envVar,
      executable,
      ...(!executable ? { remediation: remediation(tool, envVar) } : {}),
    };
  }

  const pathCommand = (
    deps.resolveExecutableOnPath ?? ((command) => resolveExecutableOnPath(command, env))
  )(tool);
  if (pathCommand) {
    return {
      tool,
      command: pathCommand,
      source: "path",
      envVar,
      executable: executableCheck(pathCommand),
      ...(!executableCheck(pathCommand) ? { remediation: remediation(tool, envVar) } : {}),
    };
  }

  const managedCommand = managedInstallPath(env);
  if (existsSync(managedCommand)) {
    const executable = executableCheck(managedCommand);
    return {
      tool,
      command: managedCommand,
      source: "managed",
      envVar,
      executable,
      ...(!executable ? { remediation: remediation(tool, envVar) } : {}),
    };
  }

  return {
    tool,
    command: null,
    source: "missing",
    envVar,
    executable: false,
    remediation: remediation(tool, envVar),
  };
}

function readStream(stream: Readable | null): Promise<string> {
  if (!stream) {
    return Promise.resolve("");
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    stream.once("error", reject);
    stream.once("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

type RunVersion = (command: string, options: { timeoutMs: number }) => Promise<string | undefined>;

async function runVersion(
  command: string,
  options: { timeoutMs: number },
): Promise<string | undefined> {
  try {
    const proc = spawn(command, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, options.timeoutMs);
    const [stdout, stderr] = await Promise.all([
      readStream(proc.stdout),
      readStream(proc.stderr),
      new Promise<number | null>((resolve, reject) => {
        proc.once("error", reject);
        proc.once("close", resolve);
      }),
    ]);
    clearTimeout(timeout);
    if (timedOut) {
      return undefined;
    }
    return (stdout || stderr).trim().split(/\r?\n/)[0] || undefined;
  } catch {
    return undefined;
  }
}

async function runVersionWithTimeout(
  run: RunVersion,
  command: string,
  timeoutMs: number,
): Promise<string | undefined> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(command, { timeoutMs }),
      new Promise<undefined>((resolve) => {
        timeout = setTimeout(() => resolve(undefined), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function getToolDiagnostic(
  tool: ResolvableToolName,
  deps: Parameters<typeof resolveToolCommand>[1] & {
    runVersion?: RunVersion;
    versionTimeoutMs?: number;
  } = {},
): Promise<ToolDiagnostic> {
  const resolution = resolveToolCommand(tool, deps);
  if (!resolution.command || !resolution.executable) {
    return resolution;
  }

  const version = (
    await runVersionWithTimeout(
      deps.runVersion ?? runVersion,
      resolution.command,
      deps.versionTimeoutMs ?? 1_000,
    )
  )?.trim();
  return {
    ...resolution,
    ...(version ? { version: version.split(/\r?\n/)[0] } : {}),
  };
}
