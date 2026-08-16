import { defineConfig, devices } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT ?? "3015";
const origin = `http://127.0.0.1:${port}`;

const config = defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: "list",
  use: {
    baseURL: origin,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --turbopack --hostname 127.0.0.1 --port ${port}`,
    url: `${origin}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

export default config;
