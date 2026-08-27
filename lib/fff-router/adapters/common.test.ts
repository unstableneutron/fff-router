import { describe, expect, test } from "vitest";
import { filterItems, matchesExcludePaths, matchesGlob } from "./common";
import type { FindFilesBackendRequest } from "./types";

const request: FindFilesBackendRequest = {
  persistenceRoot: "/repo",
  queryKind: "find_files",
  within: "/repo/src",
  basePath: "/repo/src",
  glob: "**/*.ts",
  extensions: ["ts"],
  excludePaths: ["src/generated"],
  limit: 20,
  cursor: null,
  query: "router",
};

describe("filterItems", () => {
  test("intersects scope, glob, extensions, and exclude paths", () => {
    const items = filterItems(request, [
      { path: "/repo/src/router.ts", relativePath: "src/router.ts" },
      { path: "/repo/src/router.js", relativePath: "src/router.js" },
      { path: "/repo/src/generated/router.ts", relativePath: "src/generated/router.ts" },
      { path: "/repo/tests/router.ts", relativePath: "tests/router.ts" },
    ]);

    expect(items).toEqual([{ path: "/repo/src/router.ts", relativePath: "src/router.ts" }]);
  });

  test("still allows file-restricted requests to be narrowed by glob", () => {
    const items = filterItems(
      {
        ...request,
        within: "/repo/src/router.ts",
        fileRestriction: "/repo/src/router.ts",
      },
      [{ path: "/repo/src/router.ts", relativePath: "src/router.ts" }],
    );

    expect(items).toEqual([{ path: "/repo/src/router.ts", relativePath: "src/router.ts" }]);
  });

  test("implements the portable glob subset without a runtime package", () => {
    expect(matchesGlob("**/*.{ts,tsx}", "src/router.ts")).toBe(true);
    expect(matchesGlob("**/*.{ts,tsx}", "router.tsx")).toBe(true);
    expect(matchesGlob("*.ts", "src/router.ts")).toBe(true);
    expect(matchesGlob("src/file?.[tj]s", "src/file1.ts")).toBe(true);
    expect(matchesGlob("src/**", "src/deep/router.ts")).toBe(true);
    expect(matchesGlob("!**/*.test.ts", "src/router.ts")).toBe(true);
    expect(matchesGlob("!**/*.test.ts", "src/router.test.ts")).toBe(false);
    expect(matchesExcludePaths(["**/generated/**"], "src/generated/router.ts")).toBe(false);
  });
});
