import { describe, expect, test } from "vitest";
import { deriveRoutingTarget } from "./routing";
import type { RouterConfig } from "./types";

const config: RouterConfig = {
  allowlistedNonGitPrefixes: [
    {
      prefix: "/home/tester/.local/share/mise",
      mode: "first-child-root",
    },
    {
      prefix: "/home/tester/.local/share/mise/installs",
      mode: "first-child-root",
    },
  ],
  promotion: { windowMs: 10 * 60 * 1000, requiredHits: 2 },
  ttl: { gitMs: 60 * 60 * 1000, nonGitMs: 15 * 60 * 1000 },
  limits: { maxPersistentDaemons: 12, maxPersistentNonGitDaemons: 4 },
};

describe("deriveRoutingTarget", () => {
  test("prefers git roots over allowlist matches", () => {
    const result = deriveRoutingTarget({
      realPath: "/repo/project/src",
      statType: "directory",
      gitRoot: "/repo/project",
      config,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.rootType).toBe("git");
    expect(result.value.persistenceRoot).toBe("/repo/project");
    expect(result.value.searchScope).toBe("/repo/project/src");
    expect(result.value.backendMode).toBe("persistent");
  });

  test("derives first-child non-git roots from the longest matching prefix", () => {
    const result = deriveRoutingTarget({
      realPath: "/home/tester/.local/share/mise/installs/npm-gitchamber/latest/node_modules/foo",
      statType: "directory",
      gitRoot: null,
      config,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.rootType).toBe("non-git");
    expect(result.value.persistenceRoot).toBe(
      "/home/tester/.local/share/mise/installs/npm-gitchamber",
    );
    expect(result.value.backendMode).toBe("ephemeral-candidate");
  });

  test("blocks exact allowlist prefixes in V1", () => {
    const result = deriveRoutingTarget({
      realPath: "/home/tester/.local/share/mise/installs",
      statType: "directory",
      gitRoot: null,
      config,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("OUTSIDE_ALLOWED_SCOPE");
  });

  test("blocks paths outside git and allowlist", () => {
    const result = deriveRoutingTarget({
      realPath: "/private/tmp/random-tree",
      statType: "directory",
      gitRoot: null,
      config,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("OUTSIDE_ALLOWED_SCOPE");
  });

  test("treats files as narrow search scopes under their root", () => {
    const result = deriveRoutingTarget({
      realPath: "/repo/project/src/auth.ts",
      statType: "file",
      gitRoot: "/repo/project",
      config,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.searchScope).toBe("/repo/project/src/auth.ts");
  });

  test("rejects relative allowlist prefixes", () => {
    const result = deriveRoutingTarget({
      realPath: "/home/tester/.local/share/mise/installs/npm-gitchamber/latest",
      statType: "directory",
      gitRoot: null,
      config: {
        ...config,
        allowlistedNonGitPrefixes: [
          {
            prefix: "relative/prefix",
            mode: "first-child-root",
          },
        ],
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("INVALID_REQUEST");
  });
});
