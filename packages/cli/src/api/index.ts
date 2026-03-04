/**
 * API Exports for billclaw CLI
 *
 * Re-exports all types from @firela/api-types and configured OpenAPI client.
 */
// Re-export everything from api-types for convenience
export * from '@firela/api-types';

// Export configured OpenAPI instance
export { OpenAPI, apiConfig } from './client.js';
