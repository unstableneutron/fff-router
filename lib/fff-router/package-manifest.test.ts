import { readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { PACKAGE_MANAGER } from "./daemon-config";

describe("published package contract", () => {
  test("is a breaking v1 package with one CLI and typed SDK entrypoints", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../../package.json", import.meta.url), "utf8"),
    );
    expect(manifest.version).toBe("1.0.0");
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
    expect(manifest.scripts).not.toHaveProperty("prepare");
    expect(manifest.dependencies).not.toHaveProperty("@ff-labs/fff-node");
    expect(manifest.dependencies).not.toHaveProperty("@sinclair/typebox");
  });
});
