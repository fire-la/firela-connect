/**
 * GoCardless error mapping for relay operations.
 *
 * Maps GoCardless error summaries from relay responses to user-friendly codes.
 * Based on ToyKit relay/openbanking/gocardless/errors.go MapGoCardlessError.
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
 * GoCardless error summary to user-friendly code mapping.
 * Synchronized with ToyKit relay/openbanking/gocardless/errors.go
 *
 * GoCardless uses error summaries in format: {summary: string, detail: string}
 * This mapping covers 10-20 common error codes.
 */
export const GOCARDLESS_ERROR_MAPPING: Record<string, string> = {
  // Rate limiting
  "Rate limit exceeded": "rate_limit_exceeded",

  // Authentication errors
  "Invalid access token": "invalid_access_token",
  "Access token expired": "token_expired",
  "Unauthorized access": "unauthorized",

  // Validation errors
  "Invalid request": "invalid_request",
  "Missing required field": "missing_field",
  "Invalid field value": "invalid_field",

  // Institution errors
  "Institution not found": "institution_not_found",
  "Institution down": "institution_down",

  // Account errors
  "Account not found": "account_not_found",
  "Requisition not found": "requisition_not_found",
  "Requisition expired": "requisition_expired",
  "Access denied": "access_denied",

  // Status errors
  "Agreement expired": "agreement_expired",
  "SCA required": "sca_required",
}

/**
 * Map GoCardless error summary to user-friendly code.
 *
 * @param summary - GoCardless error summary (e.g., "Rate limit exceeded")
 * @returns User-friendly error code
 */
export function mapGoCardlessError(summary: string): string {
  const normalized = summary.toLowerCase()
  for (const [key, value] of Object.entries(GOCARDLESS_ERROR_MAPPING)) {
    if (key.toLowerCase() === normalized) {
      return value
    }
  }
  return "provider_error" // Fallback per CONTEXT.md decision
}

/**
 * Error response structure from relay
 */
interface GoCardlessRelayErrorResponse {
  status?: number
  message?: string
  provider?: "plaid" | "gocardless"
  error?: {
    code?: string
    message?: string
    provider?: string
  }
  summary?: string
  detail?: string
}

/**
 * Parse error from GoCardless relay operation into UserError.
 *
 * Distinguishes between:
 * 1. Relay errors (network, auth, rate limit) - ERR-01
 * 2. Provider errors (GoCardless specific) - ERR-02
 *
 * @param error - Error from relay operation
 * @param context - Additional context (accountId, endpoint)
 * @param _logger - Logger for debug output (unused but kept for API consistency)
 * @returns UserError with appropriate error code and guidance
 */
export function parseGoCardlessRelayError(
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

  // Parse through relay error hierarchy for Error instances
  if (error instanceof Error) {
    // parseRelayError for Error instances always returns RelayHttpError
    const relayError = parseRelayError(error, {
      provider: "gocardless",
      endpoint: context?.endpoint,
    })

    return createHttpUserError(relayError as RelayHttpError, context)
  }

  // Handle raw error response objects
  if (error && typeof error === "object") {
    const errorObj = error as GoCardlessRelayErrorResponse

    // Check for provider error in response body
    if (
      errorObj.provider === "gocardless" ||
      errorObj.error?.provider === "gocardless" ||
      errorObj.summary
    ) {
      return createGoCardlessErrorResponse(errorObj, context)
    }

    // Check for relay error structure
    if (errorObj.error?.code) {
      return createRelayErrorResponse(errorObj, context)
    }
  }

  // Generic error fallback
  return createUserError(
    ERROR_CODES.UNKNOWN_ERROR,
    ErrorCategory.RELAY_PROVIDER,
    "error",
    true,
    {
      title: "GoCardless Relay Error",
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
 * Create UserError from ProviderError (GoCardless-specific)
 */
function createProviderUserError(
  error: ProviderError,
  context?: { accountId?: string; endpoint?: string },
): UserError {
  const mappedCode = error.code // Already mapped by relay

  // Token expired - requires refresh or reauth
  if (mappedCode === "token_expired" || mappedCode === "invalid_access_token") {
    return createUserError(
      ERROR_CODES.GOCARDLESS_RELAY_TOKEN_EXPIRED,
      ErrorCategory.RELAY_PROVIDER,
      "error",
      true,
      {
        title: "GoCardless Token Expired",
        message:
          "Your GoCardless access token has expired (24-hour TTL). The token needs to be refreshed.",
        suggestions: [
          "The system will attempt to refresh the token automatically",
          "If refresh fails, you'll need to re-authenticate with your bank",
          "Your historical transactions are preserved",
        ],
        docsLink:
          "https://developer.gocardless.com/bank-account-data/quick-start-guide",
      },
      [
        {
          type: "retry",
          delayMs: 5000,
          description: "Retry with automatic token refresh",
        },
        {
          type: "reauth",
          params: { accountId: context?.accountId },
          description: "Re-authenticate if refresh fails",
        },
      ],
      context ? { accountId: context.accountId } : undefined,
    )
  }

  // Requisition not found or expired
  if (
    mappedCode === "requisition_not_found" ||
    mappedCode === "requisition_expired"
  ) {
    return createUserError(
      ERROR_CODES.GOCARDLESS_RELAY_REQUISITION_NOT_FOUND,
      ErrorCategory.RELAY_PROVIDER,
      "error",
      true,
      {
        title: "Bank Connection Expired",
        message:
          "Your bank connection (requisition) has expired or is invalid. You need to re-connect your bank account.",
        suggestions: [
          "Use the connect command to re-link your bank account",
          "GoCardless requisitions expire after a period of time",
          "Your historical transactions are preserved",
        ],
        docsLink:
          "https://developer.gocardless.com/bank-account-data/quick-start-guide",
      },
      [
        {
          type: "reauth",
          params: { accountId: context?.accountId },
          description: "Re-connect bank account",
        },
      ],
      context ? { accountId: context.accountId } : undefined,
    )
  }

  // Access denied
  if (mappedCode === "access_denied") {
    return createUserError(
      ERROR_CODES.GOCARDLESS_RELAY_ACCESS_DENIED,
      ErrorCategory.RELAY_PROVIDER,
      "error",
      false,
      {
        title: "Access Denied",
        message:
          "Access to your bank account was denied. This may be because you revoked access or permissions were removed.",
        suggestions: [
          "Re-authenticate to grant access again",
          "Check your bank's app for connection status",
          "Make sure you have the required permissions",
        ],
      },
      [
        {
          type: "reauth",
          params: { accountId: context?.accountId },
          description: "Re-authenticate to restore access",
        },
      ],
      context ? { accountId: context.accountId } : undefined,
    )
  }

  // Rate limited
  if (mappedCode === "rate_limit_exceeded") {
    return createUserError(
      ERROR_CODES.GOCARDLESS_RELAY_RATE_LIMITED,
      ErrorCategory.RELAY_PROVIDER,
      "warning",
      true,
      {
        title: "GoCardless Rate Limit Exceeded",
        message:
          "Too many requests to GoCardless. You've hit the API rate limit (10 requests/day per scope as of August 2024).",
        suggestions: [
          "Wait a few minutes before syncing again",
          "Reduce sync frequency to avoid hitting the limit",
          "Cache institution lists to minimize redundant API calls",
        ],
        docsLink:
          "https://developer.gocardless.com/bank-account-data/rate-limits",
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
    mappedCode === "institution_not_found"
  ) {
    return createUserError(
      ERROR_CODES.GOCARDLESS_RELAY_INSTITUTION_DOWN,
      ErrorCategory.RELAY_PROVIDER,
      "warning",
      true,
      {
        title: "Bank Temporarily Unavailable",
        message: "Your bank is experiencing technical difficulties or is unavailable.",
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
      title: "GoCardless Error",
      message: error.message || "An error occurred with GoCardless",
      suggestions: [
        "Try again in a few moments",
        "If the problem persists, check GoCardless status",
      ],
      docsLink: "https://status.gocardless.com",
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
  _error: RelayHttpError,
  _context?: { accountId?: string },
): UserError {
  // parseRelayError for Error instances always returns RelayHttpError with statusCode 0,
  // so this function only handles the timeout case.
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

/**
 * Create UserError from raw GoCardless error response
 */
function createGoCardlessErrorResponse(
  errorObj: GoCardlessRelayErrorResponse,
  context?: { accountId?: string },
): UserError {
  const summary = errorObj.summary || errorObj.error?.message || "GoCardless error"
  const detail = errorObj.detail || errorObj.message

  const mappedCode = mapGoCardlessError(summary)

  // Create a temporary ProviderError and use existing handler
  const providerError = new ProviderError(
    "gocardless",
    mappedCode,
    detail || summary,
  )
  return createProviderUserError(providerError, context)
}

/**
 * Create UserError from relay error response
 */
function createRelayErrorResponse(
  errorObj: GoCardlessRelayErrorResponse,
  context?: { accountId?: string },
): UserError {
  const code = errorObj.error?.code || "UNKNOWN"
  const message = errorObj.error?.message || "Relay error"

  const relayError = new RelayError(code, message, message)
  return createRelayUserError(relayError, context)
}
