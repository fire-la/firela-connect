/**
 * Vitest Configuration for Firela Bot Worker
 *
 * Configured for Cloudflare Workers testing with miniflare environment.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Global test setup
    globals: true,

    // Test file patterns
    include: ['tests/**/*.test.ts'],

    // Exclude patterns
    exclude: ['node_modules', 'dist', '.wrangler'],

    // Test timeout
    testTimeout: 10000,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'tests/**'],
    },

    // Setup files
    setupFiles: [],

    // Environment variables for tests
    env: {
      TEST_DISCORD_PUBLIC_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      TEST_DISCORD_BOT_TOKEN: 'test-bot-token',
      TEST_DISCORD_APPLICATION_ID: '123456789012345678',
      TEST_FIRELA_BOT_API_KEY: 'test-api-key-12345',
      TEST_SETUP_PASSWORD: 'test-setup-password',
    },
  },
});
