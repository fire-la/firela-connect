/**
 * Vitest Configuration for Firela Bot Worker
 *
 * Configured for Cloudflare Workers testing with miniflare environment.
 */

import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

// Load test environment variables from .env.test (project root)
const envTestPath = path.resolve(import.meta.dirname, '../../.env.test');
if (existsSync(envTestPath)) {
  const envContent = readFileSync(envTestPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

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

  },
});
