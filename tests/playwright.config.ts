import { assertNonProductionEnvironment, assertNonProductionUrl } from "./support/environmentSafety";
import { defineConfig, devices } from "playwright/test";

assertNonProductionEnvironment(process.env);

const configuredBaseURL = process.env.PENSIVE_E2E_BASE_URL;
const configuredApiURL = process.env.PENSIVE_E2E_API_URL;
const configuredConvexURL = process.env.PENSIVE_E2E_CONVEX_URL;

if (!configuredBaseURL || !configuredApiURL || !configuredConvexURL) {
  throw new Error(
    "PENSIVE_E2E_BASE_URL, PENSIVE_E2E_API_URL, and PENSIVE_E2E_CONVEX_URL are required. Point them at disposable non-production web/API/Convex deployments.",
  );
}

const baseURL = assertNonProductionUrl(
  configuredBaseURL,
  "PENSIVE_E2E_BASE_URL",
)
  .toString()
  .replace(/\/$/, "");
const apiURL = assertNonProductionUrl(configuredApiURL, "PENSIVE_E2E_API_URL")
  .toString()
  .replace(/\/$/, "");
const convexURL = assertNonProductionUrl(
  configuredConvexURL,
  "PENSIVE_E2E_CONVEX_URL",
)
  .toString()
  .replace(/\/$/, "");

const baseHostname = new URL(baseURL).hostname;
const isLoopback = ["127.0.0.1", "localhost", "::1"].includes(baseHostname);

if (new URL(baseURL).hostname === new URL(apiURL).hostname) {
  console.warn(
    "PENSIVE_E2E_BASE_URL and PENSIVE_E2E_API_URL share a host; this is allowed only when that host is a disposable test deployment.",
  );
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "test-results/playwright" }]]
    : "list",
  use: {
    baseURL,
    extraHTTPHeaders: {
      "X-Pensive-Test-Run": "playwright",
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "en-US",
  },
  metadata: { apiURL, convexURL },
  webServer: isLoopback
    ? {
        command: "npm run web:dev -- --host 127.0.0.1 --port 1111",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { ...process.env, VITE_CONVEX_URL: convexURL },
      }
    : undefined,
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
});