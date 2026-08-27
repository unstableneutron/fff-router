import { afterEach, describe, expect, test, vi } from "vitest";
import { main } from "./cli";

afterEach(() => vi.restoreAllMocks());

describe("fff CLI", () => {
  test("prints top-level help successfully", async () => {
    const output: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      output.push(String(chunk));
      return true;
    });
    expect(await main(["--help"])).toBe(0);
    expect(output.join("")).toContain("fff warm <path...>");
    expect(output.join("")).toContain("daemon <start|stop|restart|reload|logs> [--clear-runtimes]");
    expect(output.join("")).toContain(
      "corepack pnpm@11.19.0 add --global github:unstableneutron/fff-router",
    );
  });

  test("treats command help as success and bad options as usage errors", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(await main(["find", "--help"])).toBe(0);
    expect(await main(["warm", "--help"])).toBe(0);
    expect(await main(["find", "router", "--unknown"])).toBe(2);
    expect(await main(["warm", "--unknown"])).toBe(2);
    expect(await main(["status", "--unknown"])).toBe(2);
    expect(await main(["setup", "extra"])).toBe(2);
    expect(await main(["daemon", "stop", "extra"])).toBe(2);
    expect(await main(["daemon", "stop", "--clear-runtimes"])).toBe(2);
  });
});
