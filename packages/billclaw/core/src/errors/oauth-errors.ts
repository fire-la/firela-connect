/**
 * OAuth error handling module
 *
 * Provides error parsing and creation functions for OAuth flows.
 * Supports Plaid Link token creation, public token exchange,
 * Gmail device code flow, and device code polling.
 *
 * @packageDocumentation
 */

import type {
  UserError,
} from "./errors.js"
import { ERROR_CODES, ErrorCategory, createUserError } from "./errors.js"

/**
 * OAuth error context
 *
 * Provides additional context for OAuth error parsing.
 */
export interface OAuthErrorContext {
  /**
   * OAuth provider: "plaid" or "gmail"
   */
  provider: "plaid" | "gmail" | "generic"
  /**
   * OAuth operation type
   */
  operation:
    | "link_token" // Plaid Link token creation
    | "public_token_exchange" // Plaid public token exchange
    | "auth_url" // Authorization URL generation (Gmail)
    | "code_exchange" // Device code exchange (Gmail)
    | "polling" // Credential polling (both providers)
  /**
   * Session identifier for OAuth flows
   */
  sessionId?: string
  /**
   * Redirect URI for OAuth flows
   */
  redirectUri?: string
  /**
   * Timeout in milliseconds
   */
  timeout?: number
  /**
   * Original error for wrapping
   */
  originalError?: Error
}

/**
 * Parse OAuth error and create structured UserError
 *
 * Analyzes OAuth-specific errors and returns UserError objects
 * with appropriate error codes, messages, and recovery actions.
 *
 * @param error - Error object from fetch/response or throw
 * @param context - OAuth error context (provider, operation, sessionId, etc.)
 * @returns UserError - Structured error for AI agents
 */
export function parseOauthError(
  error: Error | { code?: string; message?: string; status?: number },
  context?: OAuthErrorContext,
): UserError {
  // Extract error properties with type guard
  const hasCode = "code" in error && typeof error.code === "string"
  const hasStatus = "status" in error && typeof error.status === "number"
  const isError = error instanceof Error

  const errorCode = hasCode ? error.code : undefined
  const errorMessage = error.message || String(error)
  const statusCode = hasStatus ? error.status : 0

  // Determine provider (default to generic)
  const provider = context?.provider ?? "generic"
  const operation = context?.operation
  const sessionId = context?.sessionId

  // Map errors based on provider and operation
  if (provider === "plaid") {
    // Plaid-specific error codes
    if (operation === "link_token") {
      if (errorMessage.includes("invalid") || statusCode === 1106) {
        return createUserError(
          ERROR_CODES.OAUTH_PLAID_LINK_TOKEN_FAILED,
          ErrorCategory.OAUTH,
          "error",
          true,
          {
            title: "Plaid Link Token Creation Failed",
            message:
              "Failed to create Plaid Link token for OAuth initialization.",
            suggestions: [
              "Check that Plaid API credentials are configured correctly",
              "Verify Plaid client ID and secret are valid",
              "Ensure Plaid Link is properly initialized",
            ],
            docsLink: "https://plaid.com/docs/link/",
          },
          [
            {
              type: "config_change",
              tool: "plaid_oauth",
              params: { setting: "plaid_credentials" },
              description: "Update Plaid API credentials",
            },
          ],
          { sessionId, redirectUri: context?.redirectUri },
          isError ? error : undefined,
        )
      }
    }

    if (operation === "public_token_exchange") {
      // Plaid public token exchange
      if (errorMessage.includes("invalid") || statusCode === 1106) {
        return createUserError(
          ERROR_CODES.OAUTH_PLAID_PUBLIC_TOKEN_FAILED,
          ErrorCategory.OAUTH,
          "error",
          true,
          {
            title: "Plaid Public Token Exchange Failed",
            message:
              "Failed to exchange Plaid public token for access token.",
            suggestions: [
              "Verify your Plaid API credentials are configured correctly",
              "Ensure Link token was obtained successfully",
              "Check your Plaid items are not locked",
            ],
            docsLink: "https://plaid.com/docs/",
          },
          undefined,
          { sessionId },
          isError ? error : undefined,
        )
      }
    }

    if (errorMessage.includes("expired") || errorMessage.includes("expired_token")) {
      return createUserError(
        ERROR_CODES.OAUTH_STATE_EXPIRED,
        ErrorCategory.OAUTH,
        "error",
        true,
        {
          title: "Plaid Access Token Expired",
          message:
            "Your Plaid access token has expired. Please re-authenticate to get a new token.",
          suggestions: [
            "Re-authenticate via your adapter's connect plaid command",
            "This will open a secure browser window where you can log into your bank",
          ],
        },
        undefined,
        { sessionId },
        isError ? error : undefined,
      )
    }

    if (operation === "polling") {
      // Polling timeout
      if (errorMessage.includes("timeout") || errorCode === "OAUTH_POLLING_TIMEOUT") {
        return createUserError(
          ERROR_CODES.OAUTH_POLLING_TIMEOUT,
          ErrorCategory.OAUTH,
          "warning",
          true,
          {
            title: "OAuth Credential Polling Timeout",
            message:
              "Timed out while waiting for OAuth credentials. Please try again.",
            suggestions: [
              "Ensure you completed the authorization in the browser",
              "Check your internet connection",
              "Try increasing the timeout with --timeout option",
            ],
          },
          undefined,
          { sessionId },
          isError ? error : undefined,
        )
      }
    }
  }

  if (provider === "gmail") {
    // Gmail-specific error codes
    if (operation === "auth_url") {
      // Authorization URL generation
      if (statusCode === 400 || errorMessage.includes("invalid")) {
        return createUserError(
          ERROR_CODES.OAUTH_GMAIL_AUTH_URL_FAILED,
          ErrorCategory.OAUTH,
          "error",
          true,
          {
            title: "Gmail Authorization URL Failed",
            message:
              "Failed to generate Gmail authorization URL.",
            suggestions: [
              "Verify Gmail client ID and secret are configured",
              "Check that Gmail API is enabled in Google Cloud Console",
              "Verify OAuth consent screen includes 'gmail.readonly' scope",
            ],
          },
          undefined,
          { sessionId, redirectUri: context?.redirectUri },
          isError ? error : undefined,
        )
      }
    }

    if (operation === "code_exchange") {
      // Device code exchange
      if (errorMessage.includes("expired") || errorCode === "OAUTH_DEVICE_CODE_EXPIRED") {
        return createUserError(
          ERROR_CODES.OAUTH_DEVICE_CODE_EXPIRED,
          ErrorCategory.OAUTH,
          "warning",
          true,
          {
            title: "Gmail Device Code Expired",
            message:
              "The device code has expired. Please request a new code.",
            suggestions: [
              "Run authorization command again to get a new device code",
              "Enter device codes more quickly next time",
              "Complete authorization promptly to avoid expiration",
            ],
          },
          undefined,
          { sessionId },
          isError ? error : undefined,
        )
      }
    }

    if (operation === "polling") {
      // Polling timeout
      if (errorMessage.includes("timeout") || errorCode === "OAUTH_POLLING_TIMEOUT") {
        return createUserError(
          ERROR_CODES.OAUTH_POLLING_TIMEOUT,
          ErrorCategory.OAUTH,
          "warning",
          true,
          {
            title: "Gmail Token Polling Timeout",
            message:
              "Timed out waiting for Gmail token after device code.",
            suggestions: [
              "Ensure you entered the device code correctly",
              "Complete the authorization in the browser promptly",
              "Try increasing the timeout with --timeout option",
            ],
          },
          undefined,
          { sessionId },
          isError ? error : undefined,
        )
      }
    }

    // Access denied
    if (statusCode === 403 && errorMessage.toLowerCase().includes("denied")) {
      return createUserError(
        ERROR_CODES.OAUTH_ACCESS_DENIED,
        ErrorCategory.OAUTH,
        "error",
        false,
        {
          title: "Gmail Access Denied",
          message:
            "Access to Gmail was denied. This usually means the OAuth token lacks required permissions.",
          suggestions: [
            "Make sure Gmail API is enabled in Google Cloud Console",
            "Verify that the OAuth consent screen includes 'gmail.readonly' scope",
            "Re-authenticate to grant proper permissions",
          ],
        },
        undefined,
        { sessionId },
        isError ? error : undefined,
      )
    }

    // Not found
    if (statusCode === 404) {
      return createUserError(
        ERROR_CODES.OAUTH_GMAIL_AUTH_URL_FAILED,
        ErrorCategory.OAUTH,
        "error",
        false,
        {
          title: "Gmail API Not Found",
          message:
            "The Gmail API endpoint could not be found. This may be a configuration issue.",
          suggestions: [
            "Verify that Gmail API is enabled in your Google Cloud project",
            "Check that the API name is correct: 'gmail.api'",
            "Try re-enabling the Gmail API in Google Cloud Console",
          ],
        },
        undefined,
        { sessionId },
        isError ? error : undefined,
      )
    }

    // Rate limit
    if (statusCode === 429) {
      return createUserError(
        ERROR_CODES.OAUTH_SLOW_DOWN,
        ErrorCategory.OAUTH,
        "warning",
        true,
        {
          title: "Gmail API Rate Limit Exceeded",
          message:
            "Too many requests have been made to the Gmail API. You've hit the daily quota limit.",
          suggestions: [
            "Wait until tomorrow when quota resets",
            "Reduce sync frequency to avoid hitting the limit",
            "Consider using Gmail push notifications instead of polling",
            "Free tier: 250 quota units/day",
          ],
        },
        undefined,
        { sessionId },
        isError ? error : undefined,
      )
    }

    // Generic Gmail API error
    return createUserError(
      ERROR_CODES.OAUTH_GMAIL_API_ERROR,
      ErrorCategory.OAUTH,
      "error",
      true,
      {
        title: "Gmail API Error",
        message: errorMessage || "An error occurred while communicating with Gmail",
        suggestions: [
          "Check your internet connection",
          "Verify Gmail API is enabled in Google Cloud Console",
          "Try again in a few minutes",
        ],
      },
      undefined,
      { sessionId },
      isError ? error : undefined,
    )
  }

  // Generic fallback (unknown provider or operation)
  return createUserError(
    ERROR_CODES.OAUTH_FAILED,
    ErrorCategory.OAUTH,
    "error",
    true,
    {
      title: "OAuth Error",
      message:
        `OAuth flow failed${provider ? ` (${provider})` : ""}: ${errorMessage}`,
      suggestions: [
        "Check your internet connection",
        "Verify your credentials are configured",
        "Try again in a few minutes",
      ],
    },
    undefined,
    {
      ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
      ...(hasStatus ? { statusCode: String(statusCode) } : {}),
    },
    isError ? error : undefined,
  )
}

/**
 * Create timeout error with formatted message
 *
 * @param context - OAuth error context (includes timeoutMs)
 * @returns UserError with formatted timeout message
 */
export function createOauthTimeoutError(
  context: OAuthErrorContext,
  originalError?: Error,
): UserError {
  const timeoutMs = context.timeout ?? 600000
  const timeoutMinutes = Math.round(timeoutMs / 60000)

  return createUserError(
    ERROR_CODES.OAUTH_TIMEOUT,
    ErrorCategory.OAUTH,
    "warning",
    true,
    {
      title: "OAuth Authorization Timeout",
      message:
        `The OAuth authorization flow timed out after ${timeoutMinutes} minute${
          timeoutMinutes === 1 ? "" : "s"
        }.`,
      suggestions: [
        "Try the authorization process again",
        "Ensure you complete the authorization in the browser promptly",
        "Check your internet connection",
        "Consider increasing the timeout with --timeout option",
        `Session: ${context.sessionId ?? "unknown"}`,
      ],
    },
    undefined,
    {
      ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
      ...(context?.timeout ? { timeout: String(context.timeout) } : {}),
    },
    originalError,
  )
}

/**
 * Format OAuth error for CLI display
 *
 * Extends the base formatError() with OAuth-specific hints
 * such as device code input prompts and session ID references.
 *
 * @param error - UserError to format
 * @returns Formatted error string for CLI output
 */
export function formatOauthError(error: UserError): string {
  const lines: string[] = []

  // Header with category emoji and severity
  const categoryEmoji = getCategoryEmoji(error.category)
  const severityIndicator = getSeverityIndicator(error.severity)
  lines.push(`${categoryEmoji} ${error.humanReadable.title} ${severityIndicator}`)
  lines.push("")

  // Message
  lines.push(error.humanReadable.message)
  lines.push("")

  // Suggestions
  if (error.humanReadable.suggestions.length > 0) {
    lines.push("Suggestions:")
    for (let i = 0; i < error.humanReadable.suggestions.length; i++) {
      lines.push(`   ${i + 1}. ${error.humanReadable.suggestions[i]}`)
    }
  }

  // OAuth-specific hints
  const sessionHint = error.entities?.sessionId
  if (sessionHint) {
    lines.push("")
    lines.push(`💡 Session ID: ${sessionHint}`)
  }

  // Docs link
  if (error.humanReadable.docsLink) {
    lines.push("")
    lines.push(`Learn more: ${error.humanReadable.docsLink}`)
  }

  // Error code (for debugging/Support)
  lines.push("")
  lines.push(`Error code: ${error.errorCode}`)

  return lines.join("\n")
}

/**
 * Get severity indicator for display
 */
function getSeverityIndicator(severity: string): string {
  switch (severity) {
    case "fatal":
      return "🔴"
    case "error":
      return "❌"
    case "warning":
      return "⚠️"
    case "info":
      return "ℹ️"
    default:
      return ""
  }
}

/**
 * Get emoji for error category
 */
function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    oauth: "🔑",
    configuration: "⚙️",
    credentials: "🔑",
    network: "🌐",
    plaid_api: "🏦",
    plaid_auth: "🔐",
    plaid_item: "📝",
    gmail_api: "📧",
    gmail_auth: "🔐",
    storage: "💾",
    file_system: "📁",
    relay: "🔌",
    webhook: "🪝",
    unknown: "❓",
  }
  return emojiMap[category] || "❓"
}
