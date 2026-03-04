/**
 * Example: Health Check API usage for CLI
 *
 * Demonstrates how to use @firela/api-types in a CLI environment.
 *
 * Note: Currently only health check endpoints are available.
 * Business endpoints (Transaction, Account, etc.) will be added as OpenAPI spec expands.
 */
import { DefaultService } from '@firela/api-types';
import { OpenAPI } from '../client.js';

/**
 * Check API health status
 */
export async function checkApiHealth(): Promise<void> {
  try {
    const response = await DefaultService.getHealth();

    console.log('API Health Check:');
    console.log('  Status:', response);
    console.log('  Base URL:', OpenAPI.BASE);

    console.log('\n✅ API is healthy and accessible');
  } catch (error) {
    console.error('❌ API health check failed');
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Example: CLI command implementation
 *
 * This shows how to integrate with Commander.js (used in billclaw CLI)
 */
export function createHealthCommand() {
  return {
    command: 'health',
    description: 'Check IGN API health status',
    action: async () => {
      await checkApiHealth();
    },
  };
}

/**
 * Example usage:
 *
 * ```bash
 * # Check health
 * billclaw health
 *
 * # With custom API URL
 * IGN_API_URL=https://api.firela.com/api/v1 billclaw health
 *
 * # With debug mode
 * IGN_DEBUG=true billclaw health
 * ```
 */
