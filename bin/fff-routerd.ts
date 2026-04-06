#!/usr/bin/env bun
import { getDaemonConfig } from "../lib/fff-router/daemon-config";
import { startHttpDaemon } from "../lib/fff-router/http-daemon";

const daemon = await startHttpDaemon(getDaemonConfig());

const shutdown = async () => {
  const hardExit = setTimeout(() => {
    process.exit(1);
  }, 1_000);
  hardExit.unref?.();

  try {
    await daemon.close();
    clearTimeout(hardExit);
    process.exit(0);
  } catch (error) {
    console.error("fff-routerd shutdown failed:", error);
    clearTimeout(hardExit);
    process.exit(1);
  }
};

process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});

// Keep the daemon alive until signaled.
await new Promise(() => {});
