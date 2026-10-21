import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:43107";

export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    colorScheme: "light",
    locale: "en-US",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm start --hostname 127.0.0.1 --port 43107",
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: `${baseURL}/api/v1`,
    },
    gracefulShutdown: { signal: "SIGINT", timeout: 1_000 },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
  expect: {
    // Chromium's font rasterization differs between macOS and the Ubuntu CI
    // runner even with the same bundled fonts. Keep the allowance just above
    // the measured 3% renderer delta; dimensions, journey, overflow, and
    // accessibility checks remain exact assertions.
    toHaveScreenshot: { animations: "disabled", maxDiffPixelRatio: 0.035 },
  },
});
