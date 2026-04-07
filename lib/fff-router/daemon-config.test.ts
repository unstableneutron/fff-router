import { describe, expect, test } from "vitest";
import { loadRouterConfig } from "./daemon-config";

describe("loadRouterConfig", () => {
  test("keeps multiple colon-separated allowlist entries", () => {
    const config = loadRouterConfig({
      env: {
        FFF_ROUTER_ALLOWLIST: "/home/tester/.config:/home/tester/.local/share",
      } as NodeJS.ProcessEnv,
    });

    expect(config.allowlistedNonGitPrefixes).toEqual([
      { prefix: "/home/tester/.config", mode: "first-child-root" },
      { prefix: "/home/tester/.local/share", mode: "first-child-root" },
    ]);
  });

  test("expands HOME forms inside the allowlist", () => {
    const config = loadRouterConfig({
      env: {
        HOME: "/home/tester",
        FFF_ROUTER_ALLOWLIST: "~/.config:$HOME/.local/share:${HOME}/src",
      } as NodeJS.ProcessEnv,
    });

    expect(config.allowlistedNonGitPrefixes).toEqual([
      { prefix: "/home/tester/.config", mode: "first-child-root" },
      { prefix: "/home/tester/.local/share", mode: "first-child-root" },
      { prefix: "/home/tester/src", mode: "first-child-root" },
    ]);
  });

  test("throws a clear error when HOME expansion is requested without HOME", () => {
    expect(() =>
      loadRouterConfig({
        env: {
          FFF_ROUTER_ALLOWLIST: "~/.config",
        } as NodeJS.ProcessEnv,
      }),
    ).toThrow(/HOME must be set/i);
  });
});
