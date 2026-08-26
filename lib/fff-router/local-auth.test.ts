import { mkdtemp, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { getDaemonPaths } from "./daemon-config";
import {
  bearerHeaders,
  ensureDaemonAuthToken,
  isAuthorized,
  readDaemonAuthToken,
} from "./local-auth";

describe("local daemon authentication", () => {
  test("creates and reuses a private capability token", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "fff-router-auth-"));
    const env = { HOME: home, XDG_STATE_HOME: path.join(home, "state") };
    const first = await ensureDaemonAuthToken(env);
    const second = await ensureDaemonAuthToken(env);

    expect(first).toBe(second);
    expect(await readDaemonAuthToken(env)).toBe(first);
    expect(bearerHeaders(first)).toEqual({ authorization: `Bearer ${first}` });
    expect(isAuthorized(`Bearer ${first}`, first)).toBe(true);
    expect(isAuthorized("Bearer wrong", first)).toBe(false);

    if (process.platform !== "win32") {
      const paths = getDaemonPaths({ env });
      expect((await stat(paths.dir)).mode & 0o777).toBe(0o700);
      expect((await stat(paths.authTokenPath)).mode & 0o777).toBe(0o600);
    }
  });
});
