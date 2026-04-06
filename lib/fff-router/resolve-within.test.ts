import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	resolveWithinFromCaller,
	validateResolvedWithin,
} from "./resolve-within";

let tmpDir = "";

beforeEach(async () => {
	tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "fff-router-within-"));
});

afterEach(async () => {
	if (tmpDir) {
		await fs.rm(tmpDir, { recursive: true, force: true });
	}
});

describe("resolve-within", () => {
	test("defaults omitted within to the caller cwd", async () => {
		const callerCwd = path.join(tmpDir, "project");
		await fs.mkdir(callerCwd, { recursive: true });

		const fromNull = await resolveWithinFromCaller({
			callerCwd,
			within: null,
		});
		expect(fromNull.ok).toBe(true);
		if (!fromNull.ok) {
			throw new Error("expected success");
		}
		expect(fromNull.value).toEqual({ resolvedWithin: callerCwd });

		const fromUndefined = await resolveWithinFromCaller({
			callerCwd,
			within: undefined,
		});
		expect(fromUndefined.ok).toBe(true);
		if (!fromUndefined.ok) {
			throw new Error("expected success");
		}
		expect(fromUndefined.value).toEqual({ resolvedWithin: callerCwd });
	});

	test("resolves relative within against the caller cwd", async () => {
		const callerCwd = path.join(tmpDir, "project");
		await fs.mkdir(path.join(callerCwd, "src"), { recursive: true });

		const result = await resolveWithinFromCaller({
			callerCwd,
			within: "src",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("expected success");
		}
		expect(result.value).toEqual({
			resolvedWithin: path.join(callerCwd, "src"),
		});
	});

	test("trims surrounding whitespace before resolving within paths", async () => {
		const callerCwd = path.join(tmpDir, "project");
		const nested = path.join(callerCwd, "src");
		await fs.mkdir(nested, { recursive: true });

		const callerResult = await resolveWithinFromCaller({
			callerCwd: ` ${callerCwd} `,
			within: " src ",
		});
		expect(callerResult.ok).toBe(true);
		if (!callerResult.ok) {
			throw new Error("expected success");
		}
		expect(callerResult.value).toEqual({ resolvedWithin: nested });

		const serverResult = await validateResolvedWithin({
			within: ` ${nested} `,
		});
		expect(serverResult.ok).toBe(true);
		if (!serverResult.ok) {
			throw new Error("expected success");
		}
		expect(serverResult.value).toEqual({
			resolvedWithin: await fs.realpath(nested),
			basePath: await fs.realpath(nested),
		});
	});

	test("accepts already-resolved absolute within values on the server", async () => {
		const dir = path.join(tmpDir, "project", "src");
		await fs.mkdir(dir, { recursive: true });

		const result = await validateResolvedWithin({ within: dir });
		const realDir = await fs.realpath(dir);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("expected success");
		}
		expect(result.value).toEqual({
			resolvedWithin: realDir,
			basePath: realDir,
		});
	});

	test("returns WITHIN_NOT_FOUND for missing resolved paths", async () => {
		const result = await validateResolvedWithin({
			within: path.join(tmpDir, "missing"),
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			throw new Error("expected failure");
		}
		expect(result.error.code).toBe("WITHIN_NOT_FOUND");
	});

	test("canonicalizes resolved absolute search bases", async () => {
		const realDir = path.join(tmpDir, "real-project");
		const linkDir = path.join(tmpDir, "linked-project");
		await fs.mkdir(realDir, { recursive: true });
		await fs.symlink(realDir, linkDir);

		const result = await validateResolvedWithin({ within: linkDir });
		const canonicalDir = await fs.realpath(realDir);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("expected success");
		}
		expect(result.value).toEqual({
			resolvedWithin: canonicalDir,
			basePath: canonicalDir,
		});
	});

	test("treats file within as a parent base path plus an implicit file restriction", async () => {
		const file = path.join(tmpDir, "project", "src", "router.ts");
		await fs.mkdir(path.dirname(file), { recursive: true });
		await fs.writeFile(file, "export const router = true;\n", "utf8");

		const result = await validateResolvedWithin({ within: file });
		const realFile = await fs.realpath(file);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error("expected success");
		}
		expect(result.value).toEqual({
			resolvedWithin: realFile,
			basePath: path.dirname(realFile),
			fileRestriction: realFile,
		});
	});
});
