import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for ThreatDex e2e smoke tests.
 *
 * Tests expect a running Next.js dev server. In CI, the `webServer` block
 * automatically starts the server before running tests.
 *
 * @see https://playwright.dev/docs/test-configuration
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  /* Run tests in parallel */
  fullyParallel: true,
  /* Fail the build on CI if test.only() was accidentally left in */
  forbidOnly: !!process.env.CI,
  /* Retry once on CI */
  retries: process.env.CI ? 1 : 0,
  /* Use 2 workers on CI */
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL,
    /* Collect traces on first retry only */
    trace: "on-first-retry",
    /* Screenshot only on failure */
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Automatically start the Next.js dev server in local runs */
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        stdout: "ignore",
        stderr: "pipe",
        timeout: 60_000,
      },
});
