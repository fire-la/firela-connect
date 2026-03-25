import { describe, it, expect } from "vitest"
import {
  mapPlaidRelayError,
  parsePlaidRelayError,
  PLAID_ERROR_MAPPING,
} from "./plaid-errors.js"
import { ProviderError, RelayError, RelayHttpError } from "./errors.js"
import { ERROR_CODES, ErrorCategory, isUserError } from "../errors/errors.js"

describe("Plaid error mapping", () => {
  describe("PLAID_ERROR_MAPPING", () => {
    it("should map ITEM_ERROR/ITEM_LOGIN_REQUIRED to bank_connection_expired", () => {
      expect(PLAID_ERROR_MAPPING.ITEM_ERROR?.ITEM_LOGIN_REQUIRED).toBe(
        "bank_connection_expired",
      )
    })

    it("should map LINK_ERROR/LINK_TOKEN_EXPIRED to link_token_expired", () => {
      expect(PLAID_ERROR_MAPPING.LINK_ERROR?.LINK_TOKEN_EXPIRED).toBe(
        "link_token_expired",
      )
    })

    it("should map API_ERROR/RATE_LIMIT_EXCEEDED to rate_limit_exceeded", () => {
      expect(PLAID_ERROR_MAPPING.API_ERROR?.RATE_LIMIT_EXCEEDED).toBe(
        "rate_limit_exceeded",
      )
    })

    it("should map INSTITUTION_ERROR/INSTITUTION_DOWN to institution_down", () => {
      expect(PLAID_ERROR_MAPPING.INSTITUTION_ERROR?.INSTITUTION_DOWN).toBe(
        "institution_down",
      )
    })

    it("should map INVALID_INPUT/INVALID_ACCESS_TOKEN to invalid_token", () => {
      expect(PLAID_ERROR_MAPPING.INVALID_INPUT?.INVALID_ACCESS_TOKEN).toBe(
        "invalid_token",
      )
    })
  })

  describe("mapPlaidRelayError", () => {
    it("should map ITEM_ERROR/ITEM_LOGIN_REQUIRED to bank_connection_expired", () => {
      const result = mapPlaidRelayError("ITEM_ERROR", "ITEM_LOGIN_REQUIRED")
      expect(result).toBe("bank_connection_expired")
    })

    it("should map LINK_ERROR/LINK_TOKEN_EXPIRED to link_token_expired", () => {
      const result = mapPlaidRelayError("LINK_ERROR", "LINK_TOKEN_EXPIRED")
      expect(result).toBe("link_token_expired")
    })

    it("should map API_ERROR/RATE_LIMIT_EXCEEDED to rate_limit_exceeded", () => {
      const result = mapPlaidRelayError("API_ERROR", "RATE_LIMIT_EXCEEDED")
      expect(result).toBe("rate_limit_exceeded")
    })

    it("should return unknown_error for unrecognized codes", () => {
      const result = mapPlaidRelayError("UNKNOWN_TYPE", "UNKNOWN_CODE")
      expect(result).toBe("unknown_error")
    })

    it("should handle case-insensitive input", () => {
      const result = mapPlaidRelayError("item_error", "item_login_required")
      expect(result).toBe("bank_connection_expired")
    })

    it("should handle null/undefined input gracefully", () => {
      expect(mapPlaidRelayError("", "")).toBe("unknown_error")
      expect(mapPlaidRelayError("ITEM_ERROR", "")).toBe("unknown_error")
    })
  })

  describe("parsePlaidRelayError", () => {
    it("should create UserError with correct category for ProviderError", () => {
      const providerError = new ProviderError(
        "plaid",
        "bank_connection_expired",
        "Item login required",
      )
      const userError = parsePlaidRelayError(providerError, {
        accountId: "acc-123",
      })

      expect(isUserError(userError)).toBe(true)
      expect(userError.category).toBe(ErrorCategory.RELAY_PROVIDER)
      expect(userError.errorCode).toBe(
        ERROR_CODES.PLAID_RELAY_BANK_CONNECTION_EXPIRED,
      )
      expect(userError.recoverable).toBe(true)
    })

    it("should distinguish relay errors from provider errors", () => {
      const relayError = new RelayError(
        "RELAY_AUTH_FAILED",
        "Auth failed",
        "Check your API key",
      )
      const userError = parsePlaidRelayError(relayError)

      expect(isUserError(userError)).toBe(true)
      expect(userError.category).toBe(ErrorCategory.RELAY)
      expect(userError.errorCode).toBe(ERROR_CODES.RELAY_AUTH_FAILED)
    })

    it("should handle ProviderError from parseRelayError", () => {
      const providerError = new ProviderError(
        "plaid",
        "rate_limit_exceeded",
        "Rate limit exceeded",
      )
      const userError = parsePlaidRelayError(providerError)

      expect(isUserError(userError)).toBe(true)
      expect(userError.category).toBe(ErrorCategory.RELAY_PROVIDER)
      expect(userError.errorCode).toBe(ERROR_CODES.PLAID_RELAY_RATE_LIMITED)
    })

    it("should handle RelayHttpError with retry information", () => {
      const httpError = new RelayHttpError(502, "Bad Gateway", true)
      const userError = parsePlaidRelayError(httpError)

      expect(isUserError(userError)).toBe(true)
      expect(userError.category).toBe(ErrorCategory.NETWORK)
      expect(userError.recoverable).toBe(true)
      expect(userError.nextActions).toBeDefined()
      expect(userError.nextActions?.[0]?.type).toBe("retry")
    })

    it("should include actionable guidance for bank connection expired", () => {
      const providerError = new ProviderError(
        "plaid",
        "bank_connection_expired",
        "Item login required",
      )
      const userError = parsePlaidRelayError(providerError, {
        accountId: "acc-123",
      })

      expect(userError.humanReadable.suggestions.length).toBeGreaterThan(0)
      expect(userError.nextActions).toBeDefined()
      expect(userError.nextActions?.some((a) => a.type === "oauth_reauth")).toBe(true)
    })

    it("should include retry action for rate limit errors", () => {
      const providerError = new ProviderError(
        "plaid",
        "rate_limit_exceeded",
        "Rate limit",
      )
      const userError = parsePlaidRelayError(providerError)

      expect(userError.nextActions?.[0]?.type).toBe("retry")
      expect(userError.nextActions?.[0]?.delayMs).toBe(300000) // 5 minutes
    })

    it("should include retry action for institution down", () => {
      const providerError = new ProviderError(
        "plaid",
        "institution_down",
        "Bank is down",
      )
      const userError = parsePlaidRelayError(providerError)

      expect(userError.nextActions?.[0]?.type).toBe("retry")
      expect(userError.humanReadable.title).toContain("Unavailable")
    })

    it("should handle timeout errors with retry", () => {
      const httpError = new RelayHttpError(0, "Request timeout", true)
      const userError = parsePlaidRelayError(httpError)

      expect(userError.errorCode).toBe(ERROR_CODES.RELAY_TIMEOUT)
      expect(userError.nextActions?.[0]?.type).toBe("retry")
    })

    it("should handle raw Plaid error response objects", () => {
      const rawError = {
        error_type: "ITEM_ERROR",
        error_code: "ITEM_LOGIN_REQUIRED",
        error_message: "The login credentials are no longer valid",
        display_message: "Please re-authenticate",
      }
      const userError = parsePlaidRelayError(rawError, {
        accountId: "acc-456",
      })

      expect(isUserError(userError)).toBe(true)
      expect(userError.category).toBe(ErrorCategory.RELAY_PROVIDER)
    })

    it("should return UserError as-is if already a UserError", () => {
      const existingError = {
        type: "UserError" as const,
        errorCode: ERROR_CODES.PLAID_RELAY_BANK_CONNECTION_EXPIRED,
        category: ErrorCategory.RELAY_PROVIDER,
        severity: "error" as const,
        recoverable: true,
        humanReadable: {
          title: "Test Error",
          message: "Test message",
          suggestions: [],
        },
      }
      const result = parsePlaidRelayError(existingError)
      expect(result).toBe(existingError)
    })

    it("should handle 401 authentication failures with clear guidance", () => {
      const relayError = new RelayError(
        "RELAY_AUTH_FAILED",
        "Invalid API key",
        "Check your API key",
      )
      const userError = parsePlaidRelayError(relayError)

      expect(userError.errorCode).toBe(ERROR_CODES.RELAY_AUTH_FAILED)
      expect(
        userError.humanReadable.suggestions.some((s) =>
          s.includes("API key"),
        ),
      ).toBe(true)
    })
  })
})
