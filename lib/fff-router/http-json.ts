import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const IS_PERRY = typeof (process.versions as Record<string, string | undefined>).perry === "string";
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;

export type JsonHttpResponse = {
  status: number;
  ok: boolean;
  payload: unknown;
};

export type JsonHttpRequest = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
};

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

function assertLocalHttpUrl(value: string): void {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    (url.hostname !== "127.0.0.1" && url.hostname !== "::1" && url.hostname !== "localhost")
  ) {
    throw new Error(`native daemon HTTP requests must target loopback, got ${url.origin}`);
  }
}

function parsePayload(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function curlJsonRequest(url: string, request: JsonHttpRequest): Promise<JsonHttpResponse> {
  assertLocalHttpUrl(url);
  const timeoutMs = Math.max(250, request.timeoutMs ?? 30_000);
  const nonce = `${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const basePath = path.join(os.tmpdir(), `.fff-router-http.${nonce}`);
  const bodyPath = `${basePath}.response`;
  const codePath = `${basePath}.code`;
  const stderrPath = `${basePath}.stderr`;
  const statusPath = `${basePath}.status`;
  const requestPath = `${basePath}.request`;
  if (request.body !== undefined) writeFileSync(requestPath, request.body, { mode: 0o600 });

  const shell =
    'status_path="$1"; code_path="$2"; stderr_path="$3"; shift 3; "$@" >"$code_path" 2>"$stderr_path"; code=$?; printf "%s\\n" "$code" >"$status_path"';
  const curlArgs = [
    "--silent",
    "--show-error",
    "--connect-timeout",
    String(Math.max(1, Math.ceil(Math.min(timeoutMs, 5_000) / 1_000))),
    "--max-time",
    String(Math.max(1, Math.ceil(timeoutMs / 1_000))),
    "--request",
    request.method ?? "GET",
    ...Object.entries(request.headers ?? {}).flatMap(([name, value]) => [
      "--header",
      `${name}: ${value}`,
    ]),
    "--output",
    bodyPath,
    "--write-out",
    "%{http_code}",
    ...(request.body !== undefined ? ["--data-binary", `@${requestPath}`] : []),
    url,
  ];
  const child = spawn(
    "/bin/sh",
    ["-c", shell, "fff-router-http", statusPath, codePath, stderrPath, "curl", ...curlArgs],
    { detached: process.platform !== "win32", stdio: "ignore" },
  );
  child.unref();
  const deadline = Date.now() + timeoutMs + 2_000;

  try {
    while (!existsSync(statusPath)) {
      if (Date.now() >= deadline) {
        stopDetachedProcess(child.pid);
        throw new Error(`daemon HTTP ${request.method ?? "GET"} ${url} timed out`);
      }
      await wait(10);
    }
    const exitCode = Number(readFileSync(statusPath, "utf8").trim());
    if (exitCode !== 0) {
      const stderr = existsSync(stderrPath) ? readFileSync(stderrPath, "utf8").trim() : "";
      throw new Error(
        `daemon HTTP ${request.method ?? "GET"} ${url} failed with curl exit ${exitCode}: ${stderr || "unknown error"}`,
      );
    }
    const status = Number(existsSync(codePath) ? readFileSync(codePath, "utf8").trim() : "");
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      throw new Error(`daemon HTTP ${request.method ?? "GET"} ${url} returned no status`);
    }
    if (existsSync(bodyPath) && statSync(bodyPath).size > MAX_RESPONSE_BYTES) {
      throw new Error(`daemon HTTP response exceeds ${MAX_RESPONSE_BYTES} bytes`);
    }
    const payload = existsSync(bodyPath) ? parsePayload(readFileSync(bodyPath, "utf8")) : null;
    return { status, ok: status >= 200 && status < 300, payload };
  } finally {
    rmSync(bodyPath, { force: true });
    rmSync(codePath, { force: true });
    rmSync(stderrPath, { force: true });
    rmSync(statusPath, { force: true });
    rmSync(requestPath, { force: true });
  }
}

export async function requestJson(
  url: string,
  request: JsonHttpRequest = {},
): Promise<JsonHttpResponse> {
  if (IS_PERRY) return await curlJsonRequest(url, request);
  const response = await fetch(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal: AbortSignal.timeout(request.timeoutMs ?? 30_000),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  return { status: response.status, ok: response.ok, payload };
}
