import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '#src': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['**/*.test.ts'],
  },
});
