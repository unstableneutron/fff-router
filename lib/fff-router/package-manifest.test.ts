import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { PACKAGE_MANAGER } from "./daemon-config";

describe("published package contract", () => {
  test("is a dependency-free v2 package with native build and typed SDK entrypoints", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../../package.json", import.meta.url), "utf8"),
    );
    expect(manifest.version).toBe("2.0.0");
    expect(manifest.packageManager).toBe("pnpm@11.19.0");
    expect(PACKAGE_MANAGER).toBe(manifest.packageManager);
    expect(manifest.engines).toEqual({ node: ">=22.0.0" });
    expect(manifest.bin).toEqual({
      fff: "./dist/bin/fff.js",
      "fff-routerd": "./dist/bin/fff-routerd.js",
    });
    expect(manifest.exports["./client"]).toHaveProperty("types");
    expect(manifest.exports["./protocol"]).toHaveProperty("types");
    expect(manifest.exports["./server"]).toHaveProperty("types");
    for (const name of [".", "./client", "./protocol", "./server"]) {
      const typesPath = manifest.exports[name].types as string;
      await expect(
        readFile(new URL(`../../${typesPath.replace(/^\.\//, "")}`, import.meta.url), "utf8"),
      ).resolves.toContain("export");
    }
    expect(manifest.scripts).not.toHaveProperty("prepare");
    expect(manifest.scripts).toHaveProperty("build:native");
    expect(manifest.scripts).toHaveProperty("check:perry");
    expect(manifest.dependencies).toEqual({});
    expect(manifest.devDependencies).toHaveProperty("@perryts/perry", "0.5.1220");
    expect(manifest.perry).toEqual({ strict: true });
  });
});
