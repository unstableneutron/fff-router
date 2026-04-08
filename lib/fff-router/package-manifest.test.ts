import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

type PackageJson = {
  private?: boolean;
  bin?: Record<string, string>;
  exports?: Record<string, unknown>;
  scripts?: Record<string, string>;
  files?: string[];
};

function readPackageJson(): PackageJson {
  const packageJsonPath = path.resolve(import.meta.dirname, "../../package.json");
  return JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
}

describe("package manifest", () => {
  test("publishes a built JS package surface for library consumers", () => {
    const packageJson = readPackageJson();

    expect(packageJson.private).not.toBe(true);
    expect(packageJson.files).toEqual(expect.arrayContaining(["dist", "lib", "bin", "README.md"]));
    expect(packageJson.exports).toMatchObject({
      ".": {
        import: "./dist/lib/fff-router/index.js",
        types: "./dist/lib/fff-router/index.d.ts",
      },
      "./package.json": "./package.json",
    });
  });

  test("ships built JS CLI entrypoints plus dedicated build scripts", () => {
    const packageJson = readPackageJson();

    expect(packageJson.bin).toEqual({
      "fff-find-files": "./dist/bin/fff-find-files.js",
      "fff-grep": "./dist/bin/fff-grep.js",
      "fff-routerd": "./dist/bin/fff-routerd.js",
      "fff-search-terms": "./dist/bin/fff-search-terms.js",
    });
    expect(packageJson.scripts).toMatchObject({
      build: "bun run scripts/build-package.ts && bun run scripts/build-standalone.ts",
      prepare: "bun run build:package",
      "build:package": "bun run scripts/build-package.ts",
      "build:standalone": "bun run scripts/build-standalone.ts",
    });
  });
});
