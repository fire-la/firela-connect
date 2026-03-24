/**
 * Relay client types and interfaces
 *
 * Provides TypeScript types for relay client configuration,
 * health check results, and API responses.
 *
 * @packageDocumentation
 */

/**
 * RelayClient configuration
 */
export interface RelayClientConfig {
  /** Relay service base URL (e.g., https://relay.firela.io) */
  url: string
  /** API key for Bearer token authentication */
  apiKey: string
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number
}

/**
 * Health check result for relay availability
 */
export interface RelayHealthCheckResult {
  /** Whether the relay service is available */
  available: boolean
  /** Response latency in milliseconds (if available) */
  latency?: number
  /** Error message if health check failed */
  error?: string
}

/**
 * Generic relay API response wrapper
 */
export interface RelayApiResponse<T> {
  /** Whether the request was successful */
  success: boolean
  /** Response data (if successful) */
  data?: T
  /** Error details (if failed) */
  error?: {
    code: string
    message: string
  }
}
