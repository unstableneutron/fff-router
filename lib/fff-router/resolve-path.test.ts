import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { resolveSearchPath } from "./resolve-path";

let tmpDir = "";

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fff-router-"));
});

afterEach(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

describe("resolveSearchPath", () => {
  test("returns SEARCH_PATH_NOT_FOUND for missing paths", async () => {
    const result = await resolveSearchPath(path.join(tmpDir, "missing"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("SEARCH_PATH_NOT_FOUND");
  });

  test("resolves files and directories", async () => {
    const dir = path.join(tmpDir, "project");
    const file = path.join(dir, "src", "auth.ts");
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "export const auth = true;\n", "utf8");

    const dirResult = await resolveSearchPath(dir);
    expect(dirResult.ok).toBe(true);
    if (!dirResult.ok) throw new Error("expected success");
    expect(dirResult.value.statType).toBe("directory");

    const fileResult = await resolveSearchPath(file);
    expect(fileResult.ok).toBe(true);
    if (!fileResult.ok) throw new Error("expected success");
    expect(fileResult.value.statType).toBe("file");
  });

  test("discovers git roots", async () => {
    const repo = path.join(tmpDir, "repo");
    const nested = path.join(repo, "src", "nested");
    await fs.mkdir(path.join(repo, ".git"), { recursive: true });
    await fs.mkdir(nested, { recursive: true });

    const expectedRepo = await fs.realpath(repo);
    const result = await resolveSearchPath(nested);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.gitRoot).toBe(expectedRepo);
  });

  test("returns null gitRoot outside repos", async () => {
    const dir = path.join(tmpDir, "plain-dir");
    await fs.mkdir(dir, { recursive: true });

    const result = await resolveSearchPath(dir);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.gitRoot).toBeNull();
  });

  test("rejects special filesystem nodes", async () => {
    if (process.platform === "win32") {
      return;
    }

    const result = await resolveSearchPath("/dev/null");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("INVALID_REQUEST");
  });
});
