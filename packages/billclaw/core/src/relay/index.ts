/**
 * Relay module exports
 *
 * This module provides HTTP client and error handling for firela-relay
 * communication. It enables BillClaw to communicate with firela-relay
 * for Open Banking operations (Plaid, GoCardless) without user-owned
 * provider accounts.
 *
 * @example
 * ```typescript
 * import { RelayClient, RelayError, RelayClientConfig } from '@firela/billclaw-core/relay'
 *
 * const client = new RelayClient({
 *   url: 'https://relay.firela.io',
 *   apiKey: 'your-api-key',
 * })
 *
 * const result = await client.request('/v1/accounts', { method: 'GET' })
 * const health = await client.healthCheck()
 * ```
 *
 * @packageDocumentation
 */

// Client
export { RelayClient } from "./client.js"

// Types
export type {
  RelayClientConfig,
  RelayHealthCheckResult,
  RelayApiResponse,
} from "./types.js"

// Errors
export {
  RelayHttpError,
  RelayError,
  ProviderError,
  parseRelayError,
} from "./errors.js"
