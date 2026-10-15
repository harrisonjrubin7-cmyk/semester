import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:43107";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    channel: process.env.CI ? undefined : "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `exec env NEXT_PUBLIC_API_URL=${baseURL}/api/v1 node ./node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 43107`,
    gracefulShutdown: { signal: "SIGINT", timeout: 1_000 },
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
});
