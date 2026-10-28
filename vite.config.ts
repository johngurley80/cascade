import { defineConfig } from 'vitest/config';

// The game is published at https://<user>.github.io/cascade/, so assets are
// served from /cascade/ in dev, preview and production alike.
// Override with BASE_PATH (e.g. BASE_PATH=/ for a root-hosted deploy).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/cascade/',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
