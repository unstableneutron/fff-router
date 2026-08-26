import { describe, expect, test } from "vitest";
import { shouldReclaimStartupLock } from "./daemon-autostart";

describe("daemon startup lock lease", () => {
  test("keeps a recent lock owned by a live process", () => {
    expect(
      shouldReclaimStartupLock({
        contents: JSON.stringify({ pid: 42, createdAt: 9_000 }),
        mtimeMs: 9_000,
        now: 10_000,
        isAlive: () => true,
      }),
    ).toBe(false);
  });

  test("reclaims a lock whose owner exited", () => {
    expect(
      shouldReclaimStartupLock({
        contents: JSON.stringify({ pid: 42, createdAt: 9_000 }),
        mtimeMs: 9_000,
        now: 10_000,
        isAlive: () => false,
      }),
    ).toBe(true);
  });

  test("reclaims an expired lock even when PID namespaces make its PID look live", () => {
    expect(
      shouldReclaimStartupLock({
        contents: JSON.stringify({ pid: 1, createdAt: 1_000 }),
        mtimeMs: 1_000,
        now: 20_000,
        isAlive: () => true,
      }),
    ).toBe(true);
  });

  test("uses mtime as the lease timestamp for legacy PID-only locks", () => {
    expect(
      shouldReclaimStartupLock({
        contents: "1",
        mtimeMs: 1_000,
        now: 20_000,
        isAlive: () => true,
      }),
    ).toBe(true);
  });
});
