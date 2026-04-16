import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    // e2e/ expliciet uitsluiten — Playwright-bestanden gebruiken test.describe()
    // van @playwright/test, niet van Vitest. Zonder deze uitsluiting pikt Vitest
    // de spec-bestanden op en crasht op de onbekende Playwright-API.
    exclude: ['**/node_modules/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/utils/**', 'src/pages/**', 'src/components/**'],
      exclude: ['src/test/**', 'src/main.jsx', 'src/supabaseClient.js', 'src/App.jsx'],
    },
  },
})
