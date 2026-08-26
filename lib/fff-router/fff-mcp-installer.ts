import { getToolDiagnostic, resolveToolCommand } from "./tool-resolution";

export type DoctorFffMcpStatus =
  | {
      found: false;
      source?: "missing";
      executable?: false;
      envVar?: string;
      remediation?: string;
    }
  | {
      found: true;
      path: string;
      source: "env" | "path" | "managed";
      executable: boolean;
      envVar: string;
      version?: string;
      remediation?: string;
    };

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
  const resolution = resolveToolCommand("fff-mcp", { env });
  return resolution.command && resolution.executable ? resolution.command : null;
}

export async function getDoctorFffMcpStatus(
  env: NodeJS.ProcessEnv = process.env,
): Promise<DoctorFffMcpStatus> {
  const diagnostic = await getToolDiagnostic("fff-mcp", { env });
  if (!diagnostic.command) {
    return {
      found: false,
      source: "missing",
      executable: false,
      envVar: diagnostic.envVar,
      ...(diagnostic.remediation ? { remediation: diagnostic.remediation } : {}),
    };
  }
  return {
    found: true,
    path: diagnostic.command,
    source:
      diagnostic.source === "env" ? "env" : diagnostic.source === "managed" ? "managed" : "path",
    executable: diagnostic.executable,
    envVar: diagnostic.envVar,
    ...(diagnostic.version ? { version: diagnostic.version } : {}),
    ...(diagnostic.remediation ? { remediation: diagnostic.remediation } : {}),
  };
}
