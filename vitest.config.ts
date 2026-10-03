import { defineConfig } from 'vitest/config';

// Config séparée de vite.config.ts : le plugin crx n'a pas sa place dans les tests unitaires
export default defineConfig({
  define: {
    __SYNCKAI_BUILD__: JSON.stringify('test'),
    __SYNCKAI_DEBUG__: JSON.stringify(true),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
