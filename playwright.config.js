import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 1000 },
    browserName: 'chromium',
    launchOptions: process.platform === 'win32' && existsSync(edgePath) ? { executablePath: edgePath } : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm start',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: { NEXT_TELEMETRY_DISABLED: '1' },
  },
});
