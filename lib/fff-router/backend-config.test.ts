import { describe, expect, test } from "vitest";
import { getBackendSelection } from "./backend-config";
import { getDaemonConfigFingerprint } from "./daemon-config";

describe("getBackendSelection", () => {
  test("defaults to fff-node primary with rg fallback", () => {
    expect(getBackendSelection({ env: {} as NodeJS.ProcessEnv })).toEqual({
      primaryBackendId: "fff-node",
      fallbackBackendId: "rg",
    });
  });

  test("maps fff-mcp to rg fallback and rg to no fallback", () => {
    expect(
      getBackendSelection({
        env: { FFF_ROUTER_BACKEND: "fff-mcp" } as NodeJS.ProcessEnv,
      }),
    ).toEqual({
      primaryBackendId: "fff-mcp",
      fallbackBackendId: "rg",
    });

    expect(getBackendSelection({ env: { FFF_ROUTER_BACKEND: "rg" } as NodeJS.ProcessEnv })).toEqual(
      {
        primaryBackendId: "rg",
        fallbackBackendId: null,
      },
    );
  });

  test("rejects invalid backend names", () => {
    expect(() =>
      getBackendSelection({ env: { FFF_ROUTER_BACKEND: "nope" } as NodeJS.ProcessEnv }),
    ).toThrow(/invalid backend/i);
  });
});

describe("getDaemonConfigFingerprint", () => {
  test("changes when the selected backend changes", () => {
    const baseEnv = {
      FFF_ROUTER_HOST: "127.0.0.1",
      FFF_ROUTER_PORT: "4319",
    } as NodeJS.ProcessEnv;

    expect(
      getDaemonConfigFingerprint({
        env: { ...baseEnv, FFF_ROUTER_BACKEND: "fff-node" },
      }),
    ).not.toBe(
      getDaemonConfigFingerprint({
        env: { ...baseEnv, FFF_ROUTER_BACKEND: "rg" },
      }),
    );
  });
});
