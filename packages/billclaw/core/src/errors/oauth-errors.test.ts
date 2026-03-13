/**
 * OAuth error handling module tests
 *
 * Tests error parsing, creation, and formatting for OAuth flows.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from "vitest"
import {
  parseOauthError,
  createOauthTimeoutError,
  formatOauthError,
} from "./oauth-errors.js"
import { ERROR_CODES, ErrorCategory } from "./errors.js"

describe("OAuth Error Handling", () => {
  describe("parseOauthError", () => {
    describe("Plaid Link Token Creation", () => {
      it("should parse invalid credential errors", () => {
        const error = new Error("invalid_client_id")
        const result = parseOauthError(error, {
          provider: "plaid",
          operation: "link_token",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_PLAID_LINK_TOKEN_FAILED)
        expect(result.category).toBe(ErrorCategory.OAUTH)
        expect(result.severity).toBe("error")
        expect(result.recoverable).toBe(true)
        expect(result.humanReadable.title).toBe("Plaid Link Token Creation Failed")
      })

      it("should parse HTTP 1106 status errors", () => {
        const error = { status: 1106, message: "Access denied" }
        const result = parseOauthError(error, {
          provider: "plaid",
          operation: "link_token",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_PLAID_LINK_TOKEN_FAILED)
      })

      it("should include session ID in entities", () => {
        const error = new Error("invalid_credentials")
        const result = parseOauthError(error, {
          provider: "plaid",
          operation: "link_token",
          sessionId: "test-session-123",
        })

        expect(result.entities?.sessionId).toBe("test-session-123")
      })

      it("should include redirect URI in entities", () => {
        const error = new Error("invalid_redirect")
        const result = parseOauthError(error, {
          provider: "plaid",
          operation: "link_token",
          redirectUri: "https://example.com/callback",
        })

        expect(result.entities?.redirectUri).toBe("https://example.com/callback")
      })
    })

    describe("Plaid Public Token Exchange", () => {
      it("should parse exchange errors", () => {
        const error = { code: "INVALID_ACCESS_TOKEN", message: "invalid" }
        const result = parseOauthError(error, {
          provider: "plaid",
          operation: "public_token_exchange",
        })

        expect(result.errorCode).toBe(
          ERROR_CODES.OAUTH_PLAID_PUBLIC_TOKEN_FAILED,
        )
        expect(result.humanReadable.title).toBe(
          "Plaid Public Token Exchange Failed",
        )
      })

      it("should handle timeout errors", () => {
        const error = new Error("Request timeout")
        const result = parseOauthError(error, {
          provider: "plaid",
          operation: "public_token_exchange",
          sessionId: "session-abc",
        })

        expect(result.recoverable).toBe(true)
        expect(result.entities?.sessionId).toBe("session-abc")
      })
    })

    describe("Plaid Token Expiration", () => {
      it("should parse expired token errors", () => {
        const error = new Error("expired_token")
        const result = parseOauthError(error, {
          provider: "plaid",
          operation: "public_token_exchange",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_STATE_EXPIRED)
        expect(result.humanReadable.title).toBe("Plaid Access Token Expired")
      })

      it("should parse expired access token message", () => {
        const error = { message: "Access token has expired" }
        const result = parseOauthError(error, {
          provider: "plaid",
          operation: "link_token",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_STATE_EXPIRED)
      })
    })

    describe("Plaid Polling", () => {
      it("should parse polling timeout errors", () => {
        const error = { code: "OAUTH_POLLING_TIMEOUT", message: "timeout" }
        const result = parseOauthError(error, {
          provider: "plaid",
          operation: "polling",
          sessionId: "poll-session-xyz",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_POLLING_TIMEOUT)
        expect(result.severity).toBe("warning")
        expect(result.humanReadable.title).toBe(
          "OAuth Credential Polling Timeout",
        )
      })
    })

    describe("Gmail Auth URL Generation", () => {
      it("should parse invalid configuration errors", () => {
        const error = { status: 400, message: "invalid" }
        const result = parseOauthError(error, {
          provider: "gmail",
          operation: "auth_url",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_GMAIL_AUTH_URL_FAILED)
        expect(result.humanReadable.title).toBe(
          "Gmail Authorization URL Failed",
        )
      })

      it("should include session and redirect URI in entities", () => {
        const error = new Error("client_id invalid")
        const result = parseOauthError(error, {
          provider: "gmail",
          operation: "auth_url",
          sessionId: "gmail-session-456",
          redirectUri: "http://localhost:3000/callback",
        })

        expect(result.entities?.sessionId).toBe("gmail-session-456")
        expect(result.entities?.redirectUri).toBe(
          "http://localhost:3000/callback",
        )
      })
    })

    describe("Gmail Code Exchange", () => {
      it("should parse expired device code errors", () => {
        const error = { code: "OAUTH_DEVICE_CODE_EXPIRED" }
        const result = parseOauthError(error, {
          provider: "gmail",
          operation: "code_exchange",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_DEVICE_CODE_EXPIRED)
        expect(result.humanReadable.title).toBe("Gmail Device Code Expired")
        expect(result.severity).toBe("warning")
      })

      it("should parse expired code message", () => {
        const error = new Error("Device code has expired")
        const result = parseOauthError(error, {
          provider: "gmail",
          operation: "code_exchange",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_DEVICE_CODE_EXPIRED)
      })
    })

    describe("Gmail Polling", () => {
      it("should parse polling timeout errors", () => {
        const error = { code: "OAUTH_POLLING_TIMEOUT", message: "timeout" }
        const result = parseOauthError(error, {
          provider: "gmail",
          operation: "polling",
          sessionId: "gmail-poll-789",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_POLLING_TIMEOUT)
        expect(result.humanReadable.title).toBe("Gmail Token Polling Timeout")
      })
    })

    describe("Gmail Access Denied", () => {
      it("should parse 403 access denied errors", () => {
        const error = { status: 403, message: "Access was denied" }
        const result = parseOauthError(error, {
          provider: "gmail",
          operation: "code_exchange",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_ACCESS_DENIED)
        expect(result.humanReadable.title).toBe("Gmail Access Denied")
        expect(result.recoverable).toBe(false)
      })

      it("should detect denied in error message", () => {
        const error = { status: 403, message: "Request was denied" }
        const result = parseOauthError(error, {
          provider: "gmail",
          operation: "auth_url",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_ACCESS_DENIED)
      })
    })

    describe("Gmail API Not Found", () => {
      it("should parse 404 not found errors", () => {
        const error = { status: 404, message: "Not found" }
        const result = parseOauthError(error, {
          provider: "gmail",
          operation: "auth_url",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_GMAIL_AUTH_URL_FAILED)
        expect(result.humanReadable.title).toBe("Gmail API Not Found")
        expect(result.recoverable).toBe(false)
      })
    })

    describe("Gmail Rate Limit", () => {
      it("should parse 429 rate limit errors", () => {
        const error = { status: 429, message: "Too many requests" }
        const result = parseOauthError(error, {
          provider: "gmail",
          operation: "code_exchange",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_SLOW_DOWN)
        expect(result.humanReadable.title).toBe("Gmail API Rate Limit Exceeded")
        expect(result.severity).toBe("warning")
      })
    })

    describe("Generic Gmail API Error", () => {
      it("should parse unknown Gmail errors", () => {
        const error = new Error("Unknown Gmail API error")
        const result = parseOauthError(error, {
          provider: "gmail",
          operation: "code_exchange",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_GMAIL_API_ERROR)
        expect(result.humanReadable.title).toBe("Gmail API Error")
      })
    })

    describe("Generic Provider Fallback", () => {
      it("should handle unknown errors", () => {
        const error = new Error("Something went wrong")
        const result = parseOauthError(error, {
          provider: "plaid",
          operation: "link_token",
        })

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_FAILED)
        expect(result.humanReadable.title).toBe("OAuth Error")
      })

      it("should handle errors without context", () => {
        const error = new Error("No context provided")
        const result = parseOauthError(error)

        expect(result.errorCode).toBe(ERROR_CODES.OAUTH_FAILED)
        expect(result.category).toBe(ErrorCategory.OAUTH)
      })

      it("should preserve original error", () => {
        const originalError = new Error("Original error message")
        const result = parseOauthError(originalError, {
          provider: "gmail",
          operation: "auth_url",
        })

        expect(result.originalError).toBe(originalError)
      })
    })

    describe("Next Actions", () => {
      it("should include config_change action for Plaid errors", () => {
        const error = new Error("invalid")
        const result = parseOauthError(error, {
          provider: "plaid",
          operation: "link_token",
        })

        expect(result.nextActions).toBeDefined()
        expect(result.nextActions?.[0].type).toBe("config_change")
        expect(result.nextActions?.[0].tool).toBe("plaid_oauth")
      })

      it("should not include next actions for errors without actions defined", () => {
        const error = new Error("Unknown error")
        const result = parseOauthError(error, {
          provider: "gmail",
          operation: "polling",
        })

        expect(result.nextActions).toBeUndefined()
      })
    })
  })

  describe("createOauthTimeoutError", () => {
    it("should create timeout error with default 10 minutes", () => {
      const result = createOauthTimeoutError({
        provider: "plaid",
        operation: "link_token",
      })

      expect(result.errorCode).toBe(ERROR_CODES.OAUTH_TIMEOUT)
      expect(result.humanReadable.title).toBe("OAuth Authorization Timeout")
      expect(result.humanReadable.message).toContain("10 minute")
    })

    it("should format single minute correctly", () => {
      const result = createOauthTimeoutError({
        provider: "gmail",
        operation: "code_exchange",
        timeout: 60000, // 1 minute
      })

      expect(result.humanReadable.message).toContain("1 minute")
      expect(result.humanReadable.message).not.toContain("1 minutes")
    })

    it("should format multiple minutes correctly", () => {
      const result = createOauthTimeoutError({
        provider: "plaid",
        operation: "polling",
        timeout: 300000, // 5 minutes
      })

      expect(result.humanReadable.message).toContain("5 minutes")
    })

    it("should include session ID in suggestions", () => {
      const result = createOauthTimeoutError({
        provider: "gmail",
        operation: "code_exchange",
        sessionId: "timeout-session-999",
      })

      const hasSessionHint = result.humanReadable.suggestions.some(
        (s) => s.includes("timeout-session-999"),
      )
      expect(hasSessionHint).toBe(true)
    })
  })

  describe("formatOauthError", () => {
    it("should format error with category emoji", () => {
      const error = parseOauthError(new Error("invalid"), {
        provider: "plaid",
        operation: "link_token",
      })
      const formatted = formatOauthError(error)

      expect(formatted).toContain("🔑")
    })

    it("should include error title and severity", () => {
      const error = parseOauthError(new Error("timeout"), {
        provider: "gmail",
        operation: "polling",
      })
      const formatted = formatOauthError(error)

      expect(formatted).toContain("Gmail Token Polling Timeout")
      expect(formatted).toContain("⚠️")
    })

    it("should include error message", () => {
      const error = parseOauthError(new Error("test error"), {
        provider: "plaid",
        operation: "public_token_exchange",
      })
      const formatted = formatOauthError(error)

      expect(formatted).toContain("OAuth flow failed (plaid)")
    })

    it("should format suggestions as numbered list", () => {
      const error = parseOauthError(new Error("invalid"), {
        provider: "plaid",
        operation: "link_token",
      })
      const formatted = formatOauthError(error)

      expect(formatted).toContain("Suggestions:")
      expect(formatted).toMatch(/1\./)
    })

    it("should include session ID hint when available", () => {
      const error = parseOauthError(new Error("timeout"), {
        provider: "gmail",
        operation: "polling",
        sessionId: "session-with-hint",
      })
      const formatted = formatOauthError(error)

      expect(formatted).toContain("💡 Session ID: session-with-hint")
    })

    it("should not include session ID hint when not available", () => {
      const error = parseOauthError(new Error("test"), {
        provider: "plaid",
        operation: "link_token",
      })
      const formatted = formatOauthError(error)

      expect(formatted).not.toContain("Session ID:")
    })

    it("should include docs link when available", () => {
      const error = parseOauthError(new Error("invalid"), {
        provider: "plaid",
        operation: "link_token",
      })
      const formatted = formatOauthError(error)

      expect(formatted).toContain("Learn more:")
      expect(formatted).toContain("https://plaid.com/docs/link/")
    })

    it("should include error code at the end", () => {
      const error = parseOauthError(new Error("test"), {
        provider: "gmail",
        operation: "auth_url",
      })
      const formatted = formatOauthError(error)

      expect(formatted).toContain("Error code:")
    })

    it("should handle empty suggestions array", () => {
      const error = parseOauthError(new Error("unknown"), {
        provider: "gmail",
        operation: "code_exchange",
      })
      const formatted = formatOauthError(error)

      // Should not crash and should still include error code
      expect(formatted).toContain("Error code:")
    })
  })

  describe("Error Type Safety", () => {
    it("should handle Error objects", () => {
      const error = new Error("Standard error")
      const result = parseOauthError(error, {
        provider: "plaid",
        operation: "link_token",
      })

      expect(result).toBeDefined()
      expect(result.errorCode).toBeDefined()
    })

    it("should handle error-like objects with code", () => {
      const error = { code: "TEST_ERROR", message: "Test message" }
      const result = parseOauthError(error, {
        provider: "gmail",
        operation: "auth_url",
      })

      expect(result).toBeDefined()
    })

    it("should handle error-like objects with status", () => {
      const error = { status: 500, message: "Server error" }
      const result = parseOauthError(error, {
        provider: "plaid",
        operation: "public_token_exchange",
      })

      expect(result).toBeDefined()
    })

    it("should handle error-like objects with code and status", () => {
      const error = {
        code: "ERROR_CODE",
        status: 400,
        message: "Bad request",
      }
      const result = parseOauthError(error, {
        provider: "gmail",
        operation: "code_exchange",
      })

      expect(result).toBeDefined()
    })

    it("should handle objects with only message", () => {
      const error = { message: "Just a message" }
      const result = parseOauthError(error, {
        provider: "plaid",
        operation: "polling",
      })

      expect(result).toBeDefined()
    })
  })
})
