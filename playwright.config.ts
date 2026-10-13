import { defineConfig, devices } from '@playwright/test';

const BASE = 'http://localhost:4173/P4-Maths-Revision/';
const chromiumPath = process.env.PW_CHROMIUM_PATH; // optional override

/**
 * Viewport matrix. WebKit is used too when it is installed (`npx playwright install webkit`);
 * set PW_WEBKIT=1 to include it.
 */
const viewports = [
  { name: 'iphone-portrait', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { name: 'iphone-landscape', use: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { name: 'android-small', use: { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  { name: 'tablet-portrait', use: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } },
  { name: 'tablet-landscape', use: { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } },
  { name: 'laptop', use: { viewport: { width: 1366, height: 768 }, hasTouch: false, isMobile: false, deviceScaleFactor: 1 } },
];

const projects = viewports.map((v) => ({
  name: v.name,
  testMatch: /layout\.spec\.ts/,
  use: { ...devices['Desktop Chrome'], ...v.use, launchOptions: chromiumPath ? { executablePath: chromiumPath } : {} },
}));
projects.push({
  name: 'game',
  testMatch: /(bot|wrong|pacing|storage|widgets|lines)\.spec\.ts/,
  use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, launchOptions: chromiumPath ? { executablePath: chromiumPath } : {} },
} as never);
projects.push({
  name: 'laptop-game',
  testMatch: /widgets\.spec\.ts/,
  use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 }, hasTouch: false, isMobile: false, launchOptions: chromiumPath ? { executablePath: chromiumPath } : {} },
} as never);
projects.push({
  name: 'offline',
  testMatch: /offline\.spec\.ts/,
  use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
} as never);
if (process.env.PW_WEBKIT) {
  projects.push({ name: 'webkit-iphone', testMatch: /(layout|widgets)\.spec\.ts/, use: { ...devices['iPhone 13'] } } as never);
}

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
  use: { baseURL: BASE, trace: 'off', screenshot: 'only-on-failure', actionTimeout: 20_000 },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: BASE,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects,
});
