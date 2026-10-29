import { defineConfig, devices } from '@playwright/test';

// Smoke test against the production build (run `npm run build` first).
export default defineConfig({
  testDir: 'e2e',
  timeout: 240_000,
  // One at a time: CI and headless runners render on the CPU, so parallel tests starve each other.
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
