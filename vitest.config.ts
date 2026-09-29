import { defineConfig } from 'vitest/config';

// Config séparée de vite.config.ts : le plugin crx n'a pas sa place dans les tests unitaires
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
