/**
 * Tests for GoCardless error mapping
 */

import { describe, it, expect } from "vitest"
import {
  GOCARDLESS_ERROR_MAPPING,
  mapGoCardlessError,
  parseGoCardlessRelayError,
} from "./gocardless-errors.js"
import { ProviderError, RelayError, RelayHttpError } from "./errors.js"
import { ERROR_CODES, ErrorCategory } from "../errors/errors.js"

describe("GoCardless Error Mapping", () => {
  describe("GOCARDLESS_ERROR_MAPPING constant", () => {
    it("should define 10-20 common error codes", () => {
      const mappingCount = Object.keys(GOCARDLESS_ERROR_MAPPING).length
      expect(mappingCount).toBeGreaterThanOrEqual(10)
      expect(mappingCount).toBeLessThanOrEqual(20)
    })

    it("should include key error mappings", () => {
      expect(GOCARDLESS_ERROR_MAPPING).toHaveProperty(
        "Rate limit exceeded",
        "rate_limit_exceeded",
      )
      expect(GOCARDLESS_ERROR_MAPPING).toHaveProperty(
        "Access token expired",
        "token_expired",
      )
      expect(GOCARDLESS_ERROR_MAPPING).toHaveProperty(
        "Requisition not found",
        "requisition_not_found",
      )
      expect(GOCARDLESS_ERROR_MAPPING).toHaveProperty(
        "Institution down",
        "institution_down",
      )
      expect(GOCARDLESS_ERROR_MAPPING).toHaveProperty(
        "Access denied",
        "access_denied",
      )
    })
  })

  describe("mapGoCardlessError", () => {
    it("should map error summaries to user-friendly codes", () => {
      expect(mapGoCardlessError("Rate limit exceeded")).toBe(
        "rate_limit_exceeded",
      )
      expect(mapGoCardlessError("Access token expired")).toBe("token_expired")
      expect(mapGoCardlessError("Requisition not found")).toBe(
        "requisition_not_found",
      )
    })

    it("should perform case-insensitive lookup", () => {
      expect(mapGoCardlessError("RATE LIMIT EXCEEDED")).toBe(
        "rate_limit_exceeded",
      )
      expect(mapGoCardlessError("access token expired")).toBe("token_expired")
      expect(mapGoCardlessError("Institution DOWN")).toBe("institution_down")
    })

    it("should return 'provider_error' for unknown codes", () => {
      expect(mapGoCardlessError("Unknown error")).toBe("provider_error")
      expect(mapGoCardlessError("Something went wrong")).toBe("provider_error")
    })
  })

  describe("parseGoCardlessRelayError", () => {
    it("should create UserError with guidance for ProviderError", () => {
      const error = new ProviderError(
        "gocardless",
        "token_expired",
        "Access token expired",
      )
      const userError = parseGoCardlessRelayError(error)

      expect(userError.type).toBe("UserError")
      expect(userError.errorCode).toBeDefined()
      expect(userError.category).toBe(ErrorCategory.RELAY_PROVIDER)
      expect(userError.humanReadable.title).toBeDefined()
      expect(userError.humanReadable.message).toBeDefined()
      expect(userError.humanReadable.suggestions.length).toBeGreaterThan(0)
    })

    it("should handle token_expired error with re-auth guidance", () => {
      const error = new ProviderError(
        "gocardless",
        "token_expired",
        "Access token expired",
      )
      const userError = parseGoCardlessRelayError(error, {
        accountId: "test-account",
      })

      expect(userError.errorCode).toBe(
        ERROR_CODES.GOCARDLESS_RELAY_TOKEN_EXPIRED,
      )
      expect(userError.recoverable).toBe(true)
      expect(userError.humanReadable.message).toContain("expired")
      expect(userError.nextActions).toBeDefined()
      expect(userError.nextActions?.length).toBeGreaterThan(0)
    })

    it("should handle requisition_not_found error with re-connect guidance", () => {
      const error = new ProviderError(
        "gocardless",
        "requisition_not_found",
        "Requisition not found",
      )
      const userError = parseGoCardlessRelayError(error)

      expect(userError.errorCode).toBe(
        ERROR_CODES.GOCARDLESS_RELAY_REQUISITION_NOT_FOUND,
      )
      expect(userError.recoverable).toBe(true)
      expect(userError.humanReadable.message).toContain("requisition")
    })

    it("should handle RelayError (auth failed, rate limited)", () => {
      const error = new RelayError(
        "RELAY_AUTH_FAILED",
        "Authentication failed",
        "Relay auth failed",
      )
      const userError = parseGoCardlessRelayError(error)

      expect(userError.type).toBe("UserError")
      expect(userError.category).toBe(ErrorCategory.RELAY)
      expect(userError.errorCode).toBe(ERROR_CODES.RELAY_AUTH_FAILED)
    })

    it("should handle RelayHttpError (network, timeout)", () => {
      const error = new RelayHttpError(500, "Server error", true)
      const userError = parseGoCardlessRelayError(error)

      expect(userError.type).toBe("UserError")
      expect(userError.category).toBe(ErrorCategory.NETWORK)
      expect(userError.recoverable).toBe(true)
    })

    it("should include next actions: retry, reauth, config_change", () => {
      const error = new ProviderError(
        "gocardless",
        "token_expired",
        "Token expired",
      )
      const userError = parseGoCardlessRelayError(error)

      expect(userError.nextActions).toBeDefined()
      const actionTypes = userError.nextActions?.map((a) => a.type)
      expect(
        actionTypes?.some((t) =>
          ["retry", "reauth", "config_change"].includes(t),
        ),
      ).toBe(true)
    })

    it("should handle unknown errors with fallback", () => {
      const error = { message: "Unknown error occurred", unknown: true }
      const userError = parseGoCardlessRelayError(error)

      expect(userError.type).toBe("UserError")
      expect(userError.errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR)
      expect(userError.humanReadable.message).toContain("unknown error")
    })
  })
})
