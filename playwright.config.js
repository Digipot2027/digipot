import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuratie — Digipot e2e tests
 *
 * Vijf projecten:
 * - chromium      : Desktop Chrome/Edge/Brave
 * - webkit        : Desktop Safari (macOS)
 * - mobile-safari : iPhone 14 — iOS Safari (bron van Sentry REACT-8/9)
 * - android-chrome: Pixel 7 — Android Chrome (grootste Android-browser)
 * - firefox       : Desktop Firefox
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
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

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'android-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
