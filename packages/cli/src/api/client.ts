/**
 * API Client Configuration for billclaw CLI
 *
 * Configures the @firela/api-types client for Node.js CLI environment.
 *
 * Note: Currently only health check endpoints are available in @firela/api-types.
 * Business endpoints (Transaction, Account, etc.) will be added as OpenAPI spec expands.
 */
import { OpenAPI } from '@firela/api-types';

// Configure the API client
OpenAPI.BASE = process.env.IGN_API_URL || 'http://localhost:3333/api/v1';
OpenAPI.TOKEN = process.env.IGN_AUTH_TOKEN || undefined;

// Export configured OpenAPI instance
export { OpenAPI };

// Export configuration for CLI commands
export const apiConfig = {
  getBaseUrl: () => OpenAPI.BASE,
  hasAuthToken: () => Boolean(process.env.IGN_AUTH_TOKEN),
};

