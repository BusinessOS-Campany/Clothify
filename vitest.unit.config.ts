import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit-only test suite: pure logic, no database. Keeps the same module alias
// as the default config (see vitest.config.ts).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
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
    include: ["src/**/*.test.ts"],
  },
});