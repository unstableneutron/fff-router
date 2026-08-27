import { afterEach, describe, expect, test, vi } from "vitest";
import { PACKAGE_VERSION } from "./daemon-config";
import { main, stopDaemon } from "./daemon-cli";
import { requestJson } from "./http-json";

vi.mock("./http-json", () => ({ requestJson: vi.fn() }));
vi.mock("./local-auth", () => ({
  bearerHeaders: (token: string) => ({ authorization: `Bearer ${token}` }),
  readDaemonAuthToken: vi.fn(async () => "test-token"),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fff-routerd CLI", () => {
  test("reports the packaged version", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      await expect(main(["--version"])).resolves.toBe(0);
      expect(write).toHaveBeenCalledWith(`${PACKAGE_VERSION}\n`);
    } finally {
      write.mockRestore();
    }
  });

  test("treats disappearance during shutdown acknowledgement as success", async () => {
    vi.mocked(requestJson)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        payload: {
          ok: true,
          metadata: {
            host: "127.0.0.1",
            port: 41_777,
            mcpPath: "/mcp",
            controlPath: "/control",
            pid: 424_242,
          },
          workers: [],
        },
      })
      .mockRejectedValueOnce(new Error("connection closed before acknowledgement"));
    vi.spyOn(process, "kill").mockImplementation((_pid, signal) => {
      if (signal === "SIGTERM") {
        throw Object.assign(new Error("no such process"), { code: "ESRCH" });
      }
      return true;
    });

    await expect(stopDaemon({})).resolves.toBe(true);
  });
});
