import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/e2e-resultaat.json' }],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'nl-NL',
  },

  projects: isCI
    ? [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
    : [
        { name: 'chromium',       use: { ...devices['Desktop Chrome'] } },
        { name: 'webkit',         use: { ...devices['Desktop Safari'] } },
        { name: 'mobile-safari',  use: { ...devices['iPhone 14'] } },
        { name: 'android-chrome', use: { ...devices['Pixel 7'] } },
        { name: 'firefox',        use: { ...devices['Desktop Firefox'] } },
      ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
})
