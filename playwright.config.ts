import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

const testEnv = loadEnv({ path: ".env.test" }).parsed ?? {};
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `${baseURL}/en/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...testEnv,
      DATABASE_URL: testEnv.DATABASE_URL ?? process.env.DATABASE_URL ?? "",
      BETTER_AUTH_URL: baseURL,
      NODE_OPTIONS: "--max-old-space-size=2048",
    },
  },
});
