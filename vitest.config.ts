import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Server actions run outside a Next.js request in tests, so stub the
      // next-intl server/navigation entry points.
      "next-intl/server": fileURLToPath(
        new URL("./tests/stubs/next-intl-server.ts", import.meta.url),
      ),
      "next-intl/navigation": fileURLToPath(
        new URL("./tests/stubs/next-intl-navigation.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    // Integration tests share one database, so files must not run in parallel.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});