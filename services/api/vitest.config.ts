import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // The write-path and migration suites boot PGlite — a real Postgres engine
    // compiled to WASM. Its first-time init runs several seconds, and longer
    // still when every workspace's tests run in parallel, so the default 10s
    // hook limit is too tight for the per-file setup.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
