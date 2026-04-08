#!/usr/bin/env node
import { startHttpDaemon } from "../lib/fff-router/http-daemon";

const daemon = await startHttpDaemon({ env: process.env });

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
process.on("SIGHUP", () => {
  void daemon.reload().catch((error) => {
    console.error("fff-routerd reload failed:", error);
  });
});

// Keep the daemon alive until signaled.
await new Promise(() => {});
