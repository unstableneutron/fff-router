import { describe, expect, test } from "vitest";
import { expandHomePath } from "./home-path";

describe("expandHomePath", () => {
  test("passes through non-HOME paths unchanged except for trimming", () => {
    expect(expandHomePath(" /tmp/project ", { HOME: "/home/tester" })).toEqual({
      ok: true,
      value: "/tmp/project",
    });
    expect(expandHomePath("src", { HOME: "/home/tester" })).toEqual({
      ok: true,
      value: "src",
    });
  });

  test("expands tilde and HOME-prefixed paths", () => {
    const env = { HOME: "/home/tester" } as NodeJS.ProcessEnv;

    expect(expandHomePath("~", env)).toEqual({ ok: true, value: "/home/tester" });
    expect(expandHomePath("~/dotfiles", env)).toEqual({
      ok: true,
      value: "/home/tester/dotfiles",
    });
    expect(expandHomePath("$HOME/.config", env)).toEqual({
      ok: true,
      value: "/home/tester/.config",
    });
    expect(expandHomePath("${HOME}/src", env)).toEqual({
      ok: true,
      value: "/home/tester/src",
    });
  });

  test("returns INVALID_REQUEST when HOME expansion is requested but HOME is unset", () => {
    const result = expandHomePath("~/dotfiles", {} as NodeJS.ProcessEnv);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toEqual({
      code: "INVALID_REQUEST",
      message: "HOME must be set to expand '~', '$HOME', or '${HOME}' paths",
    });
  });

  test("rejects non-absolute HOME values for expansion", () => {
    const result = expandHomePath("~/dotfiles", {
      HOME: "relative/home",
    } as NodeJS.ProcessEnv);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toEqual({
      code: "INVALID_REQUEST",
      message: "HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths",
    });
  });
});
