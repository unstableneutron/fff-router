import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

type PackageJson = {
  private?: boolean;
  bin?: Record<string, string>;
  exports?: Record<string, unknown>;
  types?: string;
  scripts?: Record<string, string>;
  files?: string[];
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

function readPackageJson(): PackageJson {
  const packageJsonPath = path.resolve(import.meta.dirname, "../../package.json");
  return JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
}

describe("package manifest", () => {
  test("publishes a built JS package surface without generated type metadata", () => {
    const packageJson = readPackageJson();

    expect(packageJson.private).not.toBe(true);
    expect(packageJson.types).toBeUndefined();
    expect(packageJson.files).toEqual(["dist", "README.md"]);
    expect(packageJson.exports).toEqual({
      ".": "./dist/lib/fff-router/index.js",
      "./package.json": "./package.json",
    });
    expect(packageJson.peerDependencies ?? {}).not.toHaveProperty("typescript");
  });

  test("ships built JS CLI entrypoints plus dedicated build scripts", () => {
    const packageJson = readPackageJson();

    expect(packageJson.bin).toEqual({
      "fff-find-files": "./dist/bin/fff-find-files.js",
      "fff-grep": "./dist/bin/fff-grep.js",
      "fff-routerd": "./dist/bin/fff-routerd.js",
    });
    expect(packageJson.scripts).toMatchObject({
      build: "node scripts/build-package.mjs",
      "build:package": "node scripts/build-package.mjs",
      "build:standalone": "bun run scripts/build-standalone.ts",
      "check:dist": "node scripts/build-package.mjs && git diff --exit-code -- dist",
      prepack: "node scripts/build-package.mjs",
    });
    expect(packageJson.scripts).not.toHaveProperty("prepare");
    expect(packageJson.devDependencies).toMatchObject({
      esbuild: expect.any(String),
    });
  });
});
