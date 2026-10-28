import { defineConfig } from 'vitest/config';

// Relative asset paths, so the same build works at a domain root (Vercel,
// Netlify, localhost) and under a sub-path (GitHub Pages: /cascade/).
// Override with BASE_PATH if an absolute base is ever needed.
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
