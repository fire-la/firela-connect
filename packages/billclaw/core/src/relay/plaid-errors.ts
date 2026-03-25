/**
 * Plaid error mapping for relay operations.
 *
 * Maps Plaid error types/codes from relay responses to user-friendly codes.
 * Based on ToyKit relay/openbanking/plaid/errors.go MapPlaidError.
 *
 * @packageDocumentation
 */

import {
  createUserError,
  ERROR_CODES,
  ErrorCategory,
  type UserError,
  type Logger,
} from "../errors/errors.js"
import {
  ProviderError,
  RelayError,
  RelayHttpError,
  parseRelayError,
} from "./errors.js"

/**
 * Plaid error type to user-friendly code mapping.
 * Synchronized with ToyKit relay/openbanking/plaid/errors.go
 */
export const PLAID_ERROR_MAPPING: Record<string, Record<string, string>> = {
  // ITEM_ERROR - Bank connection errors
  ITEM_ERROR: {
    ITEM_LOGIN_REQUIRED: "bank_connection_expired",
    INVALID_CREDENTIALS: "invalid_credentials",
    INVALID_MFA: "invalid_mfa",
    ITEM_PRODUCT_NOT_READY: "product_not_ready",
    NO_ACCOUNTS: "no_accounts",
    ITEM_LOCKED: "item_locked",
    ITEM_NOT_FOUND: "item_not_found",
  },

  // API_ERROR - Plaid API errors
  API_ERROR: {
    INVALID_REQUEST: "invalid_request",
    RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
    INTERNAL_UNEXPECTED_ERROR: "internal_error",
    UNAUTHORIZED_ACCESS: "unauthorized",
  },

  // INVALID_INPUT - Input validation errors
  INVALID_INPUT: {
    INVALID_API_KEYS: "invalid_api_keys",
    INVALID_ACCESS_TOKEN: "invalid_token",
    INVALID_PUBLIC_TOKEN: "invalid_token",
    INVALID_LINK_TOKEN: "invalid_token",
  },

  // LINK_ERROR - Link flow errors
  LINK_ERROR: {
    LINK_TOKEN_EXPIRED: "link_token_expired",
    LINK_TOKEN_INVALIDATED: "link_token_invalidated",
  },

  // INSTITUTION_ERROR - Bank errors
  INSTITUTION_ERROR: {
    INSTITUTION_DOWN: "institution_down",
    INSTITUTION_NOT_RESPONDING: "institution_not_responding",
    INSTITUTION_NOT_FOUND: "institution_not_found",
  },
}

/**
 * Map Plaid error type and code to user-friendly code.
 *
 * @param errorType - Plaid error type (e.g., "ITEM_ERROR")
 * @param errorCode - Plaid error code (e.g., "ITEM_LOGIN_REQUIRED")
 * @returns User-friendly error code
 */
export function mapPlaidRelayError(
  errorType: string,
  errorCode: string,
): string {
  const normalizedType = errorType?.toUpperCase() || ""
  const normalizedCode = errorCode?.toUpperCase() || ""

  const typeMap = PLAID_ERROR_MAPPING[normalizedType]
  if (typeMap && typeMap[normalizedCode]) {
    return typeMap[normalizedCode]
  }

  // Fallback for common error codes across types
  if (
    normalizedCode === "INVALID_ACCESS_TOKEN" ||
    normalizedCode === "INVALID_PUBLIC_TOKEN" ||
    normalizedCode === "INVALID_LINK_TOKEN"
  ) {
    return "invalid_token"
  }

  if (normalizedCode === "UNAUTHORIZED_ACCESS") {
    return "unauthorized"
  }

  return "unknown_error"
}

/**
 * Error response structure from relay
 */
interface PlaidRelayErrorResponse {
  status?: number
  message?: string
  provider?: "plaid" | "gocardless"
  error?: {
    code?: string
    message?: string
    provider?: string
  }
  error_type?: string
  error_code?: string
  error_message?: string
  display_message?: string
  request_id?: string
}

/**
 * Parse error from Plaid relay operation into UserError.
 *
 * Distinguishes between:
 * 1. Relay errors (network, auth, rate limit) - ERR-01
 * 2. Provider errors (Plaid specific) - ERR-02
 *
 * @param error - Error from relay operation
 * @param context - Additional context (accountId, endpoint)
 * @param _logger - Logger for debug output (unused but kept for API consistency)
 * @returns UserError with appropriate error code and guidance
 */
export function parsePlaidRelayError(
  error: unknown,
  context?: {
    accountId?: string
    endpoint?: string
  },
  _logger?: Logger,
): UserError {
  // If already a UserError, return as-is
  if (
    error &&
    typeof error === "object" &&
    (error as Record<string, unknown>).type === "UserError"
  ) {
    return error as UserError
  }

  // Handle known error types directly (before parseRelayError)
  if (error instanceof ProviderError) {
    return createProviderUserError(error, context)
  }

  if (error instanceof RelayError) {
    return createRelayUserError(error, context)
  }

  if (error instanceof RelayHttpError) {
    return createHttpUserError(error, context)
  }

  // Parse through relay error hierarchy for generic Errors
  const relayError =
    error instanceof Error
      ? parseRelayError(error, { provider: "plaid", endpoint: context?.endpoint })
      : null

  // Handle ProviderError (from Plaid via relay)
  if (relayError instanceof ProviderError) {
    return createProviderUserError(relayError, context)
  }

  // Handle RelayError (relay service issues)
  if (relayError instanceof RelayError) {
    return createRelayUserError(relayError, context)
  }

  // Handle RelayHttpError (network/HTTP issues)
  if (relayError instanceof RelayHttpError) {
    return createHttpUserError(relayError, context)
  }

  // Handle raw error response objects
  if (error && typeof error === "object") {
    const errorObj = error as PlaidRelayErrorResponse

    // Check for provider error in response body
    if (
      errorObj.provider === "plaid" ||
      errorObj.error?.provider === "plaid" ||
      errorObj.error_type
    ) {
      return createPlaidErrorResponse(errorObj, context)
    }

    // Check for relay error structure
    if (errorObj.error?.code) {
      return createRelayErrorResponse(errorObj, context)
    }
  }

  // Generic error fallback
  return createUserError(
    ERROR_CODES.UNKNOWN_ERROR,
    ErrorCategory.RELAY,
    "error",
    true,
    {
      title: "Plaid Relay Error",
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
      suggestions: [
        "Try again in a few moments",
        "Check your network connection",
        "If the problem persists, contact support",
      ],
    },
    [
      {
        type: "retry",
        delayMs: 30000,
        description: "Retry after 30 seconds",
      },
    ],
    context ? { accountId: context.accountId } : undefined,
    error instanceof Error ? error : undefined,
  )
}

/**
 * Create UserError from ProviderError (Plaid-specific)
 */
function createProviderUserError(
  error: ProviderError,
  context?: { accountId?: string; endpoint?: string },
): UserError {
  const mappedCode = error.code // Already mapped by relay

  // Bank connection expired - requires reauth
  if (
    mappedCode === "bank_connection_expired" ||
    mappedCode === "invalid_token"
  ) {
    return createUserError(
      ERROR_CODES.PLAID_RELAY_BANK_CONNECTION_EXPIRED,
      ErrorCategory.RELAY_PROVIDER,
      "error",
      true,
      {
        title: "Bank Connection Expired",
        message:
          "Your bank connection has expired and needs to be re-authenticated.",
        suggestions: [
          "Use the connect command to re-link your bank account",
          "This happens periodically for security reasons",
          "Your historical transactions are preserved",
        ],
        docsLink: "https://plaid.com/docs/errors/#item-login-required",
      },
      [
        {
          type: "oauth_reauth",
          tool: "plaid_oauth",
          params: { accountId: context?.accountId },
          description: "Trigger bank re-authentication",
        },
      ],
      context ? { accountId: context.accountId } : undefined,
    )
  }

  // Link token expired
  if (mappedCode === "link_token_expired") {
    return createUserError(
      ERROR_CODES.PLAID_RELAY_LINK_TOKEN_EXPIRED,
      ErrorCategory.RELAY_PROVIDER,
      "warning",
      true,
      {
        title: "Link Token Expired",
        message:
          "The Plaid Link token has expired. Link tokens are valid for 4 hours.",
        suggestions: [
          "Request a new Link token",
          "Complete the Link flow within 4 hours of token creation",
        ],
      },
      [
        {
          type: "retry",
          description: "Request a new Link token",
        },
      ],
    )
  }

  // Rate limited
  if (mappedCode === "rate_limit_exceeded") {
    return createUserError(
      ERROR_CODES.PLAID_RELAY_RATE_LIMITED,
      ErrorCategory.RELAY_PROVIDER,
      "warning",
      true,
      {
        title: "Plaid Rate Limit Exceeded",
        message:
          "Too many requests to Plaid. Please wait before trying again.",
        suggestions: [
          "Wait a few minutes before syncing again",
          "Reduce sync frequency if this happens often",
        ],
      },
      [
        {
          type: "retry",
          delayMs: 300000, // 5 minutes
          description: "Retry after 5 minutes",
        },
      ],
    )
  }

  // Institution down
  if (
    mappedCode === "institution_down" ||
    mappedCode === "institution_not_responding"
  ) {
    return createUserError(
      ERROR_CODES.PLAID_RELAY_INSTITUTION_DOWN,
      ErrorCategory.RELAY_PROVIDER,
      "warning",
      true,
      {
        title: "Bank Temporarily Unavailable",
        message: "Your bank is experiencing technical difficulties.",
        suggestions: [
          "Wait a few minutes and try again",
          "Check your bank website for status updates",
        ],
      },
      [
        {
          type: "retry",
          delayMs: 300000,
          description: "Retry after 5 minutes",
        },
      ],
    )
  }

  // Generic provider error
  return createUserError(
    ERROR_CODES.RELAY_PROVIDER_ERROR,
    ErrorCategory.RELAY_PROVIDER,
    "error",
    true,
    {
      title: "Plaid Error",
      message: error.message || "An error occurred with Plaid",
      suggestions: [
        "Try again in a few moments",
        "If the problem persists, check Plaid status",
      ],
      docsLink: "https://status.plaid.com",
    },
    [
      {
        type: "retry",
        delayMs: 60000,
        description: "Retry after 1 minute",
      },
    ],
    context ? { accountId: context.accountId } : undefined,
  )
}

/**
 * Create UserError from RelayError (relay service issues)
 */
function createRelayUserError(
  error: RelayError,
  _context?: { accountId?: string },
): UserError {
  // Authentication failed
  if (error.code === "RELAY_AUTH_FAILED") {
    return createUserError(
      ERROR_CODES.RELAY_AUTH_FAILED,
      ErrorCategory.RELAY,
      "error",
      true,
      {
        title: "Relay Authentication Failed",
        message:
          "Failed to authenticate with the relay service. Check your API key.",
        suggestions: [
          "Verify FIRELA_RELAY_API_KEY is correctly configured",
          "Check that the API key has not been revoked",
          "Contact support if the problem persists",
        ],
      },
      [
        {
          type: "config_change",
          params: { setting: "relay.apiKey" },
          description: "Update relay API key configuration",
        },
      ],
    )
  }

  // Rate limited by relay
  if (error.code === "RELAY_RATE_LIMITED") {
    return createUserError(
      ERROR_CODES.RELAY_RATE_LIMITED,
      ErrorCategory.RELAY,
      "warning",
      true,
      {
        title: "Relay Rate Limited",
        message: error.userMessage || "Too many requests to relay service.",
        suggestions: [
          "Wait before making more requests",
          "Reduce sync frequency",
        ],
      },
      [
        {
          type: "retry",
          delayMs: 60000,
          description: "Retry after 1 minute",
        },
      ],
    )
  }

  // Generic relay error
  return createUserError(
    ERROR_CODES.RELAY_PROVIDER_ERROR,
    ErrorCategory.RELAY,
    "error",
    true,
    {
      title: "Relay Service Error",
      message: error.userMessage || error.message,
      suggestions: [
        "Try again in a few moments",
        "Check your network connection",
      ],
    },
    [
      {
        type: "retry",
        delayMs: 30000,
        description: "Retry after 30 seconds",
      },
    ],
  )
}

/**
 * Create UserError from RelayHttpError (network/HTTP issues)
 */
function createHttpUserError(
  error: RelayHttpError,
  _context?: { accountId?: string },
): UserError {
  // Timeout
  if (error.statusCode === 0 || error.message.includes("timeout")) {
    return createUserError(
      ERROR_CODES.RELAY_TIMEOUT,
      ErrorCategory.NETWORK,
      "warning",
      true,
      {
        title: "Relay Request Timeout",
        message: "The request to relay service timed out after 30 seconds.",
        suggestions: [
          "Check your network connection",
          "Try again in a few moments",
          "The relay service may be experiencing high load",
        ],
      },
      [
        {
          type: "retry",
          delayMs: 30000,
          description: "Retry after 30 seconds",
        },
      ],
    )
  }

  // Server error (5xx) - retryable
  if (error.statusCode >= 500) {
    return createUserError(
      ERROR_CODES.RELAY_CONNECTION_FAILED,
      ErrorCategory.NETWORK,
      "warning",
      error.retryable,
      {
        title: "Relay Service Unavailable",
        message: `Relay service returned error ${error.statusCode}.`,
        suggestions: [
          "Try again in a few moments",
          "Check relay service status",
        ],
      },
      [
        {
          type: "retry",
          delayMs: 30000,
          description: "Retry after 30 seconds",
        },
      ],
    )
  }

  // Other HTTP error
  return createUserError(
    ERROR_CODES.RELAY_CONNECTION_FAILED,
    ErrorCategory.NETWORK,
    "error",
    error.retryable,
    {
      title: "Relay Connection Failed",
      message: error.message,
      suggestions: [
        "Check your network connection",
        "Verify relay URL is correct",
        "Try again later",
      ],
    },
    error.retryable
      ? [
          {
            type: "retry",
            delayMs: 30000,
            description: "Retry after 30 seconds",
          },
        ]
      : undefined,
  )
}

/**
 * Create UserError from raw Plaid error response
 */
function createPlaidErrorResponse(
  errorObj: PlaidRelayErrorResponse,
  context?: { accountId?: string },
): UserError {
  const errorType = errorObj.error_type || ""
  const errorCode = errorObj.error_code || ""
  const errorMessage =
    errorObj.display_message || errorObj.error_message || "Plaid error"

  const mappedCode = mapPlaidRelayError(errorType, errorCode)

  // Create a temporary ProviderError and use existing handler
  const providerError = new ProviderError("plaid", mappedCode, errorMessage)
  return createProviderUserError(providerError, context)
}

/**
 * Create UserError from relay error response
 */
function createRelayErrorResponse(
  errorObj: PlaidRelayErrorResponse,
  context?: { accountId?: string },
): UserError {
  const code = errorObj.error?.code || "UNKNOWN"
  const message = errorObj.error?.message || "Relay error"

  const relayError = new RelayError(code, message, message)
  return createRelayUserError(relayError, context)
}
