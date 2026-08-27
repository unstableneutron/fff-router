import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  parseLinuxProcStatCpuTime,
  ProcessSupervisor,
  terminateNativeProcessGroup,
} from "./process-supervisor";

function longRunningSupervisor(
  overrides: Partial<ConstructorParameters<typeof ProcessSupervisor>[0]> = {},
) {
  return new ProcessSupervisor({
    command: process.execPath,
    args: ["-e", "setInterval(() => {}, 1000)"],
    cwd: process.cwd(),
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
    sampleIntervalMs: 0,
    shutdownGraceMs: 20,
    killGraceMs: 100,
    ...overrides,
  });
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForFile(pathValue: string): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      await readFile(pathValue, "utf8");
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw new Error(`timed out waiting for ${pathValue}`);
}

async function waitForProcessExit(pid: number): Promise<void> {
  const deadline = Date.now() + 1_000;
  while (processExists(pid) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("ProcessSupervisor", () => {
  test("parses cumulative Linux CPU time even when the process name contains parentheses", () => {
    expect(parseLinuxProcStatCpuTime("123 (fff (repo)) R 1 2 3 4 5 6 7 8 9 10 25 15 0 0")).toBe(
      400,
    );
    expect(parseLinuxProcStatCpuTime("invalid")).toBeUndefined();
  });

  test.runIf(process.platform !== "win32")(
    "kills the entire stopped process group instead of leaking a timed-out worker",
    async () => {
      const supervisor = longRunningSupervisor();
      await supervisor.spawned;
      const pid = supervisor.pid!;
      try {
        process.kill(-pid, "SIGSTOP");
        await supervisor.terminate("tool timeout");
        expect((await supervisor.waitForExit()).signal).toBe("SIGKILL");
        expect(supervisor.getTerminationReason()).toBe("tool timeout");
        expect(processExists(pid)).toBe(false);
      } finally {
        await supervisor.terminate("test cleanup").catch(() => {});
      }
    },
  );

  test.runIf(process.platform !== "win32")(
    "does not orphan a supervised descendant when the group leader exits",
    async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "fff-supervisor-tree-"));
      const childPidPath = path.join(directory, "child.pid");
      const parent = String.raw`
const { spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
writeFileSync(process.argv[1], String(child.pid));
setInterval(() => {}, 1000);
`;
      const supervisor = longRunningSupervisor({
        command: process.execPath,
        args: ["-e", parent, childPidPath],
      });
      let childPid = 0;
      try {
        await supervisor.spawned;
        await waitForFile(childPidPath);
        childPid = Number(await readFile(childPidPath, "utf8"));
        expect(processExists(childPid)).toBe(true);
        await terminateNativeProcessGroup(supervisor.pid!, 20, 100);
        await supervisor.waitForExit();
        await waitForProcessExit(childPid);
        expect(processExists(supervisor.pid!)).toBe(false);
        expect(processExists(childPid)).toBe(false);
      } finally {
        await supervisor.terminate("test cleanup").catch(() => {});
        if (childPid && processExists(childPid)) {
          try {
            process.kill(childPid, "SIGKILL");
          } catch {
            // Already gone.
          }
        }
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  test("terminates a worker after consecutive RSS limit violations", async () => {
    const supervisor = longRunningSupervisor({
      maxRssBytes: 100,
      maxRssSamples: 2,
      sample: async () => ({ sampledAt: Date.now(), rssBytes: 101, processCount: 1 }),
    });
    await supervisor.spawned;
    let resourceNotification = false;
    let terminationNotification = false;
    supervisor.onResourceSample(() => {
      resourceNotification = true;
    });
    supervisor.onTermination(() => {
      terminationNotification = true;
    });
    try {
      await supervisor.sampleNow();
      await supervisor.sampleNow();
      await supervisor.waitForExit();
      expect(supervisor.getTerminationReason()).toMatch(/worker RSS 101 exceeded 100 bytes/);
      expect(supervisor.getResourceUsage()).toMatchObject({ rssBytes: 101, processCount: 1 });
      expect(supervisor.telemetry).toMatchObject({
        terminationReason: expect.stringContaining("worker RSS 101 exceeded 100 bytes"),
        resources: { rssBytes: 101, processCount: 1 },
      });
      expect(resourceNotification).toBe(true);
      expect(terminationNotification).toBe(true);
    } finally {
      await supervisor.terminate("test cleanup").catch(() => {});
    }
  });
});
