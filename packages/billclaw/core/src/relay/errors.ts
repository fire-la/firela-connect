/**
 * Relay error types for BillClaw
 *
 * Provides layered error types for relay communication:
 * - RelayHttpError: HTTP-level errors (timeout, network, 5xx)
 * - RelayError: Relay service errors (auth, rate limit, config)
 * - ProviderError: Provider errors (Plaid, GoCardless specific)
 *
 * @packageDocumentation
 */

/**
 * HTTP-level errors from relay communication
 *
 * Used for network errors, timeouts, and server errors (5xx)
 * that can potentially be retried.
 */
export class RelayHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message)
    this.name = "RelayHttpError"
  }
}

/**
 * Relay service-level errors
 *
 * Used for errors from the relay service itself, such as
 * authentication failures, rate limiting, and configuration errors.
 */
export class RelayError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly userMessage: string,
  ) {
    super(message)
    this.name = "RelayError"
  }
}

/**
 * Provider-specific errors from Plaid or GoCardless
 *
 * Used when the relay successfully communicates but the
 * underlying provider returns an error.
 */
export class ProviderError extends Error {
  constructor(
    public readonly provider: "plaid" | "gocardless",
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "ProviderError"
  }
}

/**
 * Context for parsing relay errors
 */
export interface RelayErrorContext {
  endpoint?: string
  provider?: "plaid" | "gocardless"
}

/**
 * Raw error response from relay or provider
 */
interface RelayErrorResponse {
  status?: number
  message?: string
  provider?: "plaid" | "gocardless"
  error_code?: string
  error_message?: string
}

/**
 * Parse errors from relay communication into appropriate error types
 *
 * @param error - Raw error from fetch or relay response
 * @param context - Additional context for error parsing
 * @returns Appropriate error type based on error characteristics
 */
export function parseRelayError(
  error: Error | RelayErrorResponse,
  context: RelayErrorContext = {},
): RelayHttpError | RelayError | ProviderError {
  // Handle Error instances
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Timeout errors
    if (
      message.includes("abort") ||
      message.includes("timeout") ||
      message.includes("timed out")
    ) {
      return new RelayHttpError(
        0,
        `Request timeout: ${error.message}`,
        true,
      )
    }

    // Network errors
    if (
      message.includes("econnrefused") ||
      message.includes("enotfound") ||
      message.includes("econnreset") ||
      message.includes("network") ||
      message.includes("fetch failed")
    ) {
      return new RelayHttpError(
        0,
        `Network error: ${error.message}`,
        true,
      )
    }

    // Generic error - treat as retryable HTTP error
    return new RelayHttpError(0, error.message, true)
  }

  // Handle response objects
  const status = error.status
  const errorMessage = error.message || error.error_message || "Unknown error"

  // Provider errors (from Plaid or GoCardless)
  if (error.provider && error.error_code) {
    return new ProviderError(
      error.provider,
      error.error_code,
      error.error_message || errorMessage,
    )
  }

  // HTTP status code mapping
  if (status) {
    // 401 Unauthorized
    if (status === 401) {
      return new RelayError(
        "RELAY_AUTH_FAILED",
        `Authentication failed: ${errorMessage}`,
        "Failed to authenticate with relay service. Check your API key.",
      )
    }

    // 429 Rate Limited
    if (status === 429) {
      return new RelayError(
        "RELAY_RATE_LIMITED",
        `Rate limit exceeded: ${errorMessage}`,
        "Too many requests. Please wait before retrying.",
      )
    }

    // 5xx Server errors - retryable
    if (status >= 500 && status < 600) {
      return new RelayHttpError(
        status,
        `Server error (${status}): ${errorMessage}`,
        true,
      )
    }

    // 404 Not Found - not retryable
    if (status === 404) {
      return new RelayHttpError(
        status,
        `Endpoint not found: ${context.endpoint || "unknown"}`,
        false,
      )
    }

    // 400 Bad Request - not retryable
    if (status === 400) {
      return new RelayHttpError(
        status,
        `Bad request: ${errorMessage}`,
        false,
      )
    }

    // 403 Forbidden - not retryable
    if (status === 403) {
      return new RelayError(
        "RELAY_FORBIDDEN",
        `Access forbidden: ${errorMessage}`,
        "Access denied. Check your API key permissions.",
      )
    }

    // Other 4xx errors - not retryable
    if (status >= 400 && status < 500) {
      return new RelayHttpError(status, errorMessage, false)
    }
  }

  // Default to retryable HTTP error
  return new RelayHttpError(status || 0, errorMessage, true)
}
