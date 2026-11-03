import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
const database = process.env.TEST_DATABASE_URL;
if (!database || !new URL(database).pathname.endsWith("_test"))
  throw new Error(
    "TEST_DATABASE_URL must identify a dedicated database ending in _test",
  );
process.env.AUTH_TEST_KEY ||= randomBytes(32).toString("hex");
export default defineConfig({
  testDir: "./tests/customer-auth",
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4200",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    launchOptions: process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: [
    {
      command: "pnpm --filter @zetmond/api dev",
      url: "http://127.0.0.1:4100/api/health",
      reuseExistingServer: false,
      timeout: 60000,
      env: {
        NODE_ENV: "test",
        DATABASE_URL: database,
        DATA_ENCRYPTION_KEY: process.env.AUTH_TEST_KEY,
        APP_ORIGIN: "http://127.0.0.1:4200",
        DELIVERY_MODE: "development",
        RATE_LIMIT: "200",
        RESEND_SECONDS: "1",
      },
    },
    {
      command: "pnpm --filter @zetmond/customer start",
      url: "http://127.0.0.1:4200/login",
      reuseExistingServer: false,
      timeout: 60000,
      env: { NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
