import { describe, expect, test } from "vitest";
import { filterItems } from "./common";
import type { FindFilesBackendRequest } from "./types";

const request: FindFilesBackendRequest = {
  backendId: "rg",
  persistenceRoot: "/repo",
  queryKind: "find_files",
  within: "/repo/src",
  basePath: "/repo/src",
  glob: "**/*.ts",
  extensions: ["ts"],
  excludePaths: ["src/generated"],
  limit: 20,
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
});
