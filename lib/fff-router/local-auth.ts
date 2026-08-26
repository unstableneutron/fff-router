import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { getDaemonPaths } from "./daemon-config";

function validToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{32,}$/.test(value);
}

export async function readDaemonAuthToken(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  try {
    const token = (await readFile(getDaemonPaths({ env }).authTokenPath, "utf8")).trim();
    return validToken(token) ? token : null;
  } catch {
    return null;
  }
}

export async function ensureDaemonAuthToken(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const paths = getDaemonPaths({ env });
  await mkdir(paths.dir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    await chmod(paths.dir, 0o700);
  }
  const existing = await readDaemonAuthToken(env);
  if (existing) {
    if (process.platform !== "win32") {
      await chmod(paths.authTokenPath, 0o600);
    }
    return existing;
  }

  const token = randomBytes(32).toString("base64url");
  try {
    await writeFile(paths.authTokenPath, `${token}\n`, { flag: "wx", mode: 0o600 });
    return token;
  } catch (caught) {
    if (typeof caught === "object" && caught && "code" in caught && caught.code === "EEXIST") {
      const raced = await readDaemonAuthToken(env);
      if (raced) {
        return raced;
      }
    }
    throw caught;
  }
}

export function bearerHeaders(token: string | null): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function isAuthorized(
  authorization: string | string[] | undefined,
  expectedToken: string,
): boolean {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return false;
  }
  const supplied = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
