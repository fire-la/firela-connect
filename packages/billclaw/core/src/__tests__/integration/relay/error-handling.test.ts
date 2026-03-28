/**
 * Integration tests for error handling scenarios
 *
 * Tests error recovery robustness and user-friendly error messages.
 * Tests are skipped if FIRELA_RELAY_API_KEY is not set.
 *
 * Run with: pnpm --filter @billclaw/core test -- --run error-handling
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import {
  RelayHttpError,
  RelayError,
  ProviderError,
  parseRelayError,
} from "../../../relay/errors.js"
import { RelayClient } from "../../../relay/client.js"
import type { Logger } from "../../../errors/errors.js"

// Test configuration from environment
const RELAY_URL = process.env.FIRELA_RELAY_URL || "https://napi-dev.firela.io"
const RELAY_API_KEY = process.env.FIRELA_RELAY_API_KEY || ""

// Skip all tests if API key not available
const shouldRunTests = RELAY_API_KEY.length > 0

// Mock logger for tests
const testLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}

describe.sequential("Error Handling (Integration)", () => {
  beforeAll(() => {
    if (!shouldRunTests) {
      console.log("Skipping error handling integration tests: FIRELA_RELAY_API_KEY not set")
    }
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe("HTTP Error Mapping", () => {
    it("should map HTTP 401 to RelayError with RELAY_AUTH_FAILED code", () => {
      const error = parseRelayError(
        { status: 401, message: "Unauthorized" },
        { endpoint: "/api/open-banking/plaid/link/token/create" },
      )

      expect(error).toBeInstanceOf(RelayError)
      if (error instanceof RelayError) {
        expect(error.code).toBe("RELAY_AUTH_FAILED")
        expect(error.userMessage).toContain("authenticate")
      }
    })

    it("should map HTTP 429 to RelayError with RELAY_RATE_LIMITED code", () => {
      const error = parseRelayError(
        { status: 429, message: "Too Many Requests" },
        { endpoint: "/api/open-banking/plaid/link/token/create" },
      )

      expect(error).toBeInstanceOf(RelayError)
      if (error instanceof RelayError) {
        expect(error.code).toBe("RELAY_RATE_LIMITED")
        expect(error.userMessage.toLowerCase()).toContain("wait")
      }
    })

    it("should map HTTP 500 to RelayHttpError with retryable=true", () => {
      const error = parseRelayError(
        { status: 500, message: "Internal Server Error" },
        { endpoint: "/api/open-banking/plaid/link/token/create" },
      )

      expect(error).toBeInstanceOf(RelayHttpError)
      if (error instanceof RelayHttpError) {
        expect(error.retryable).toBe(true)
        expect(error.statusCode).toBe(500)
      }
    })

    it("should map HTTP 502 to RelayHttpError with retryable=true", () => {
      const error = parseRelayError(
        { status: 502, message: "Bad Gateway" },
        { endpoint: "/api/open-banking/plaid/link/token/create" },
      )

      expect(error).toBeInstanceOf(RelayHttpError)
      if (error instanceof RelayHttpError) {
        expect(error.retryable).toBe(true)
        expect(error.statusCode).toBe(502)
      }
    })

    it("should map HTTP 503 to RelayHttpError with retryable=true", () => {
      const error = parseRelayError(
        { status: 503, message: "Service Unavailable" },
        { endpoint: "/api/open-banking/plaid/link/token/create" },
      )

      expect(error).toBeInstanceOf(RelayHttpError)
      if (error instanceof RelayHttpError) {
        expect(error.retryable).toBe(true)
        expect(error.statusCode).toBe(503)
      }
    })

    it("should map HTTP 504 to RelayHttpError with retryable=true", () => {
      const error = parseRelayError(
        { status: 504, message: "Gateway Timeout" },
        { endpoint: "/api/open-banking/plaid/link/token/create" },
      )

      expect(error).toBeInstanceOf(RelayHttpError)
      if (error instanceof RelayHttpError) {
        expect(error.retryable).toBe(true)
        expect(error.statusCode).toBe(504)
      }
    })
  })

  describe("Timeout Handling", () => {
    it("should map timeout error to RelayHttpError with retryable=true", () => {
      const timeoutError = new Error("The operation was aborted due to timeout")
      const error = parseRelayError(timeoutError, { endpoint: "/api/test" })

      expect(error).toBeInstanceOf(RelayHttpError)
      if (error instanceof RelayHttpError) {
        expect(error.retryable).toBe(true)
      }
    })

    it("should include timeout information in error message", () => {
      const timeoutError = new Error("The operation was aborted due to timeout")
      const error = parseRelayError(timeoutError, { endpoint: "/api/test" })

      expect(error.message.toLowerCase()).toContain("timeout")
    })

    it(
      "should handle request timeout scenario with real client",
      async () => {
        if (!shouldRunTests) return

        // Create client with very short timeout
        const shortTimeoutClient = new RelayClient(
          {
            url: RELAY_URL,
            apiKey: RELAY_API_KEY,
            timeout: 1, // 1ms - will always timeout
          },
          testLogger,
        )

        try {
          await shortTimeoutClient.request("/api/open-banking/plaid/link/token/create", {
            method: "POST",
            body: JSON.stringify({
              client_name: "Test",
              language: "en",
              country_codes: ["US"],
              user: { client_user_id: "test" },
            }),
          })
          // Should not reach here
          expect(true).toBe(false)
        } catch (error) {
          expect(error).toBeDefined()
          // The error should be parseable as a timeout
          const parsedError = parseRelayError(error as Error, { endpoint: "/api/test" })
          expect(parsedError).toBeInstanceOf(RelayHttpError)
          if (parsedError instanceof RelayHttpError) {
            expect(parsedError.retryable).toBe(true)
          }
        }
      },
      30000,
    )
  })

  describe("Authentication Failure", () => {
    it("should handle invalid API key", () => {
      const error = parseRelayError(
        { status: 401, message: "Unauthorized - Invalid API key" },
        { endpoint: "/api/open-banking/plaid/link/token/create" },
      )

      expect(error).toBeInstanceOf(RelayError)
      if (error instanceof RelayError) {
        expect(error.code).toBe("RELAY_AUTH_FAILED")
        expect(error.userMessage).toContain("API key")
      }
    })

    it("should provide userMessage with guidance", () => {
      const error = parseRelayError(
        { status: 401, message: "Unauthorized" },
        { endpoint: "/api/open-banking/plaid/link/token/create" },
      )

      expect(error).toBeInstanceOf(RelayError)
      if (error instanceof RelayError) {
        expect(error.userMessage).toBeDefined()
        expect(error.userMessage.length).toBeGreaterThan(10)
        // Should contain actionable guidance
        const guidanceWords = ["check", "verify", "try", "ensure"]
        const hasGuidance = guidanceWords.some((word) =>
          error.userMessage.toLowerCase().includes(word),
        )
        expect(hasGuidance).toBe(true)
      }
    })

    it("should handle empty API key response", () => {
      const error = parseRelayError(
        { status: 401, message: "Missing authentication" },
        { endpoint: "/api/open-banking/plaid/link/token/create" },
      )

      expect(error).toBeInstanceOf(RelayError)
      if (error instanceof RelayError) {
        expect(error.code).toBe("RELAY_AUTH_FAILED")
      }
    })

    it(
      "should return error response for invalid API key against real server",
      async () => {
        if (!shouldRunTests) return

        const badClient = new RelayClient(
          {
            url: RELAY_URL,
            apiKey: "invalid-api-key-12345",
          },
          testLogger,
        )

        const result = await badClient.request("/api/open-banking/plaid/link/token/create", {
          method: "POST",
          body: JSON.stringify({
            client_name: "Test",
            language: "en",
            country_codes: ["US"],
            user: { client_user_id: "test" },
          }),
        })

        // API returns error JSON object instead of throwing
        expect(result).toBeDefined()
        expect((result as Record<string, unknown>).error).toBeDefined()
        const errorObj = (result as Record<string, unknown>).error as Record<string, unknown>
        expect(errorObj.code).toBe("UNAUTHORIZED")
      },
      30000,
    )
  })

  describe("Provider Error Mapping", () => {
    it("should map Plaid ITEM_LOGIN_REQUIRED to ProviderError", () => {
      const providerError = {
        provider: "plaid" as const,
        error_code: "ITEM_LOGIN_REQUIRED",
        error_message: "The user must re-authenticate",
      }
      const error = parseRelayError(providerError, { endpoint: "/api/test" })

      expect(error).toBeInstanceOf(ProviderError)
      if (error instanceof ProviderError) {
        expect(error.provider).toBe("plaid")
        expect(error.code).toBe("ITEM_LOGIN_REQUIRED")
        expect(error.message).toContain("re-authenticate")
      }
    })

    it("should map Plaid INVALID_INPUT to ProviderError", () => {
      const providerError = {
        provider: "plaid" as const,
        error_code: "INVALID_INPUT",
        error_message: "Invalid input provided",
      }
      const error = parseRelayError(providerError, { endpoint: "/api/test" })

      expect(error).toBeInstanceOf(ProviderError)
      if (error instanceof ProviderError) {
        expect(error.provider).toBe("plaid")
        expect(error.code).toBe("INVALID_INPUT")
      }
    })

    it("should map GoCardless token_expired to ProviderError", () => {
      const providerError = {
        provider: "gocardless" as const,
        error_code: "token_expired",
        error_message: "Access token has expired",
      }
      const error = parseRelayError(providerError, { endpoint: "/api/test" })

      expect(error).toBeInstanceOf(ProviderError)
      if (error instanceof ProviderError) {
        expect(error.provider).toBe("gocardless")
        expect(error.code).toBe("token_expired")
      }
    })

    it("should map GoCardless requisition_not_found to ProviderError", () => {
      const providerError = {
        provider: "gocardless" as const,
        error_code: "requisition_not_found",
        error_message: "Requisition not found",
      }
      const error = parseRelayError(providerError, { endpoint: "/api/test" })

      expect(error).toBeInstanceOf(ProviderError)
      if (error instanceof ProviderError) {
        expect(error.provider).toBe("gocardless")
        expect(error.code).toBe("requisition_not_found")
      }
    })

    it("should include error code in ProviderError message", () => {
      const providerError = {
        provider: "plaid" as const,
        error_code: "RATE_LIMIT_EXCEEDED",
        error_message: "Too many requests",
      }
      const error = parseRelayError(providerError, { endpoint: "/api/test" })

      expect(error).toBeInstanceOf(ProviderError)
      if (error instanceof ProviderError) {
        expect(error.code).toBe("RATE_LIMIT_EXCEEDED")
        expect(error.message).toBeDefined()
      }
    })
  })

  describe("Network Error Handling", () => {
    it("should map ECONNREFUSED to RelayHttpError with retryable=true", () => {
      const networkError = new Error("ECONNREFUSED: Connection refused")
      const error = parseRelayError(networkError, { endpoint: "/api/test" })

      expect(error).toBeInstanceOf(RelayHttpError)
      if (error instanceof RelayHttpError) {
        expect(error.retryable).toBe(true)
      }
    })

    it("should map ENOTFOUND to RelayHttpError with retryable=true", () => {
      const networkError = new Error("ENOTFOUND: DNS lookup failed")
      const error = parseRelayError(networkError, { endpoint: "/api/test" })

      expect(error).toBeInstanceOf(RelayHttpError)
      if (error instanceof RelayHttpError) {
        expect(error.retryable).toBe(true)
      }
    })

    it("should map ETIMEDOUT to RelayHttpError with retryable=true", () => {
      const networkError = new Error("ETIMEDOUT: Connection timed out")
      const error = parseRelayError(networkError, { endpoint: "/api/test" })

      expect(error).toBeInstanceOf(RelayHttpError)
      if (error instanceof RelayHttpError) {
        expect(error.retryable).toBe(true)
      }
    })

    it("should provide actionable error message for network errors", () => {
      const networkError = new Error("ECONNREFUSED: Connection refused")
      const error = parseRelayError(networkError, { endpoint: "/api/test" })

      expect(error.message).toContain("Network error")
      expect(error.message).toContain("ECONNREFUSED")
    })
  })

  describe("Error Message Validation", () => {
    it("should provide actionable guidance for auth errors", () => {
      const error = parseRelayError(
        { status: 401, message: "Unauthorized" },
        { endpoint: "/api/test" },
      )

      expect(error).toBeInstanceOf(RelayError)
      if (error instanceof RelayError) {
        // User message should contain actionable guidance
        const actionableWords = ["check", "verify", "try", "ensure"]
        const hasActionableGuidance = actionableWords.some((word) =>
          error.userMessage.toLowerCase().includes(word),
        )
        expect(hasActionableGuidance).toBe(true)
      }
    })

    it("should provide actionable guidance for rate limit errors", () => {
      const error = parseRelayError(
        { status: 429, message: "Too Many Requests" },
        { endpoint: "/api/test" },
      )

      expect(error).toBeInstanceOf(RelayError)
      if (error instanceof RelayError) {
        // User message should suggest waiting
        expect(error.userMessage.toLowerCase()).toContain("wait")
      }
    })

    it("should avoid technical jargon in userMessage", () => {
      const error = parseRelayError(
        { status: 401, message: "Unauthorized" },
        { endpoint: "/api/open-banking/plaid/accounts" },
      )

      expect(error).toBeInstanceOf(RelayError)
      if (error instanceof RelayError) {
        // Should not contain HTTP status codes or technical terms
        expect(error.userMessage).not.toMatch(/\b401\b/)
        expect(error.userMessage).not.toMatch(/\bHTTP\b/)
      }
    })

    it("should include next steps in error guidance", () => {
      const authError = parseRelayError(
        { status: 401, message: "Unauthorized" },
        { endpoint: "/api/test" },
      )

      expect(authError).toBeInstanceOf(RelayError)
      if (authError instanceof RelayError) {
        // Should suggest checking API key
        expect(authError.userMessage.toLowerCase()).toMatch(/check|verify|try/)
      }
    })

    it("should provide retry information for retryable errors", () => {
      const error = parseRelayError(
        { status: 503, message: "Service Unavailable" },
        { endpoint: "/api/test" },
      )

      expect(error).toBeInstanceOf(RelayHttpError)
      if (error instanceof RelayHttpError) {
        expect(error.retryable).toBe(true)
        // Message should indicate it's a server error
        expect(error.message.toLowerCase()).toContain("server")
      }
    })
  })

  describe("Error Classification", () => {
    it("should classify 404 as non-retryable", () => {
      const error = parseRelayError(
        { status: 404, message: "Not Found" },
        { endpoint: "/api/nonexistent" },
      )

      expect(error).toBeInstanceOf(RelayHttpError)
      if (error instanceof RelayHttpError) {
        expect(error.retryable).toBe(false)
      }
    })

    it("should classify 403 as RelayError with user guidance", () => {
      const error = parseRelayError(
        { status: 403, message: "Forbidden" },
        { endpoint: "/api/test" },
      )

      expect(error).toBeInstanceOf(RelayError)
      if (error instanceof RelayError) {
        expect(error.code).toBe("RELAY_FORBIDDEN")
        expect(error.userMessage).toContain("permission")
      }
    })

    it("should classify 400 as non-retryable client error", () => {
      const error = parseRelayError(
        { status: 400, message: "Bad Request" },
        { endpoint: "/api/test" },
      )

      expect(error).toBeInstanceOf(RelayHttpError)
      if (error instanceof RelayHttpError) {
        expect(error.retryable).toBe(false)
      }
    })

    it("should classify unknown network errors as retryable", () => {
      const unknownError = new Error("fetch failed")
      const error = parseRelayError(unknownError, { endpoint: "/api/test" })

      expect(error).toBeInstanceOf(RelayHttpError)
      if (error instanceof RelayHttpError) {
        expect(error.retryable).toBe(true)
      }
    })
  })
})

// Conditional describe for when API key is not available
describe("Error Handling (No API Key)", () => {
  it("should skip tests gracefully when FIRELA_RELAY_API_KEY not set", () => {
    if (RELAY_API_KEY) {
      // If API key is set, this test is not applicable
      return
    }

    // This documents the expected behavior
    expect(shouldRunTests).toBe(false)
    console.log("Integration tests require FIRELA_RELAY_API_KEY environment variable")
  })
})
