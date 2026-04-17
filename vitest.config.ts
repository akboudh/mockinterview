import path from "path";

import { defineConfig } from "vitest/config";

/** Dedicated DB so `resetDb()` in tests never touches dev `data/mockinterview.sqlite`. */
const VITEST_SQLITE_PATH = path.resolve(__dirname, "data/vitest.sqlite");
process.env.DATABASE_URL = VITEST_SQLITE_PATH;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  },
  test: {
    globals: true,
    environment: "node",
    fileParallelism: false,
    maxWorkers: 1,
    sequence: {
      concurrent: false
    },
    setupFiles: [path.resolve(__dirname, "tests/vitest-setup.ts")]
  }
});
