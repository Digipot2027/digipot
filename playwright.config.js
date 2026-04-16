import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuratie — Digipot e2e tests
 *
 * Vijf projecten lokaal, één project in CI:
 * - chromium      : Desktop Chrome/Edge/Brave (ook CI)
 * - webkit        : Desktop Safari (macOS) — alleen lokaal
 * - mobile-safari : iPhone 14 — iOS Safari (bron van Sentry REACT-8/9) — alleen lokaal
 * - android-chrome: Pixel 7 — Android Chrome (grootste Android-browser) — alleen lokaal
 * - firefox       : Desktop Firefox — alleen lokaal
 *
 * In CI (process.env.CI === 'true') draait alleen het 'chromium'-project.
 * De volledige 5-browsers suite draait lokaal via `npm run e2e`.
 */

const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
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
    ? [
        // CI: alleen Chromium — snel, deterministisch, geen browser-installatie overhead
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [
        // Lokaal: volledige 5-browsers suite
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
    reuseExistingServer: !isCI,
    timeout: 60_000,
  },
})
