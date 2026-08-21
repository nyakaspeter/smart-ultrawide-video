import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/analysis/**/*.ts', 'src/geometry/**/*.ts'],
    },
  },
});
