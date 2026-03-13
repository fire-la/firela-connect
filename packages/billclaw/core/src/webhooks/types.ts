/**
 * Core data structures for webhook processing
 *
 * Framework-agnostic types for inbound webhook handling.
 */

import type { Logger } from "../errors/errors.js"

/**
 * Webhook source identifiers
 */
export type WebhookSource = "plaid" | "gocardless" | "gmail" | "test"

/**
 * Framework-agnostic webhook request abstraction
 *
 * Normalizes HTTP requests from different frameworks into a common format.
 */
export interface WebhookRequest {
  /**
   * Request payload (parsed JSON)
   */
  body: unknown

  /**
   * HTTP headers (normalized to lowercase)
   */
  headers: Record<string, string>

  /**
   * Query parameters
   */
  query: Record<string, string>

  /**
   * Webhook source identifier
   */
  source: WebhookSource

  /**
   * Security fields (P0 - Replay Protection)
   * Unix timestamp in milliseconds
   */
  timestamp?: number

  /**
   * Unique identifier for this webhook (for deduplication)
   */
  nonce?: string

  /**
   * Normalized signature location (P1 - Abstraction Fix)
   * Extracted from headers or body by adapter
   */
  signature?: string
}

/**
 * Framework-agnostic webhook response abstraction
 */
export interface WebhookResponse {
  /**
   * HTTP status code
   */
  status: number

  /**
   * Response body
   */
  body: {
    received: boolean
    error?: string | ErrorResponseDetail
    processed?: boolean
  }
}

/**
 * Error response detail
 */
export interface ErrorResponseDetail {
  code: string
  message: string
  retryable: boolean
  retryAfter?: number
}

/**
 * Protocol handler interface
 *
 * Implemented by source-specific handlers (Plaid, GoCardless, Gmail).
 */
export interface WebhookHandler {
  /**
   * Handler identifier
   */
  readonly source: WebhookSource

  /**
   * Process webhook request
   *
   * @param request - Normalized webhook request
   * @returns Response with status and body
   */
  handle(request: WebhookRequest): Promise<WebhookResponse>

  /**
   * Verify webhook signature (optional, may use centralized security)
   *
   * @param request - Webhook request with signature
   * @param secret - Webhook secret key
   * @returns True if signature is valid
   */
  verify?(request: WebhookRequest, secret: string): boolean

  /**
   * Get supported webhook event types
   *
   * @returns Array of supported event type strings
   */
  getSupportedEvents(): string[]
}

/**
 * Error response format
 */
export interface WebhookErrorResponse {
  status: number
  body: {
    received: false
    error: ErrorResponseDetail
  }
}

/**
 * Error codes for webhook responses
 */
export enum WebhookErrorCode {
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  REPLAY_DETECTED = "REPLAY_DETECTED",
  RATE_LIMITED = "RATE_LIMITED",
  INVALID_TIMESTAMP = "INVALID_TIMESTAMP",
  NONCE_REUSE = "NONCE_REUSE",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

/**
 * Context provided to webhook handlers
 */
export interface WebhookContext {
  /**
   * Logger for output
   */
  logger: Logger

  /**
   * Emit events to configured webhook endpoints
   */
  emitEvent?: (eventType: string, data: unknown) => Promise<void>
}
