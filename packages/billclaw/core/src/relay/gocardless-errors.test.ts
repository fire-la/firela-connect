/**
 * Comprehensive tests for GoCardless error mapping branch coverage.
 *
 * Covers all branches of mapGoCardlessError and parseGoCardlessRelayError
 * to reach 90%+ branch coverage for gocardless-errors.ts.
 */

import { describe, it, expect } from "vitest"
import {
  GOCARDLESS_ERROR_MAPPING,
  mapGoCardlessError,
  parseGoCardlessRelayError,
} from "./gocardless-errors.js"
import {
  ERROR_CODES,
  ErrorCategory,
  type UserError,
} from "../errors/errors.js"

// ============================================================================
// mapGoCardlessError
// ============================================================================

describe("mapGoCardlessError", () => {
  describe("all mapping entries", () => {
    it("should map every entry in GOCARDLESS_ERROR_MAPPING correctly", () => {
      for (const [key, expected] of Object.entries(GOCARDLESS_ERROR_MAPPING)) {
        expect(mapGoCardlessError(key)).toBe(expected)
      }
    })

    it("should have exactly 15 mapping entries", () => {
      expect(Object.keys(GOCARDLESS_ERROR_MAPPING)).toHaveLength(15)
    })
  })

  describe("case-insensitive matching", () => {
    it("should match lowercase input", () => {
      expect(mapGoCardlessError("access token expired")).toBe("token_expired")
    })

    it("should match uppercase input", () => {
      expect(mapGoCardlessError("RATE LIMIT EXCEEDED")).toBe(
        "rate_limit_exceeded",
      )
    })

    it("should match mixed case input", () => {
      expect(mapGoCardlessError("Institution DOWN")).toBe("institution_down")
    })
  })

  describe("fallback for unknown summaries", () => {
    it("should return 'provider_error' for unknown summary", () => {
      expect(mapGoCardlessError("Unknown error")).toBe("provider_error")
    })

    it("should return 'provider_error' for empty string", () => {
      expect(mapGoCardlessError("")).toBe("provider_error")
    })

    it("should return 'provider_error' for unrelated text", () => {
      expect(mapGoCardlessError("Something went wrong")).toBe("provider_error")
    })
  })
})

// ============================================================================
// parseGoCardlessRelayError - raw response objects
// ============================================================================

describe("parseGoCardlessRelayError - raw response objects", () => {
  it("should handle { provider: 'gocardless', summary: 'Rate limit exceeded' }", () => {
    const rawError = {
      provider: "gocardless" as const,
      summary: "Rate limit exceeded",
    }
    const userError = parseGoCardlessRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.GOCARDLESS_RELAY_RATE_LIMITED,
    )
    expect(userError.category).toBe(ErrorCategory.RELAY_PROVIDER)
  })

  it("should handle { error: { provider: 'gocardless', code: 'test' }, summary: 'Rate limit exceeded' }", () => {
    const rawError = {
      error: { provider: "gocardless", code: "test" },
      summary: "Rate limit exceeded",
    }
    const userError = parseGoCardlessRelayError(rawError)

    expect(userError.type).toBe("UserError")
    expect(userError.category).toBe(ErrorCategory.RELAY_PROVIDER)
  })

  it("should handle { summary: 'Institution down', detail: 'detail' }", () => {
    const rawError = {
      summary: "Institution down",
      detail: "The institution is experiencing issues",
    }
    const userError = parseGoCardlessRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.GOCARDLESS_RELAY_INSTITUTION_DOWN,
    )
  })

  it("should handle { error: { code: 'SOME_CODE', message: 'msg' } } (relay error structure)", () => {
    const rawError = {
      error: { code: "SOME_CODE", message: "Something went wrong" },
    }
    const userError = parseGoCardlessRelayError(rawError)

    expect(userError.type).toBe("UserError")
    expect(userError.category).toBe(ErrorCategory.RELAY)
  })

  it("should handle { provider: 'gocardless', summary: 'Access token expired' }", () => {
    const rawError = {
      provider: "gocardless" as const,
      summary: "Access token expired",
    }
    const userError = parseGoCardlessRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.GOCARDLESS_RELAY_TOKEN_EXPIRED,
    )
  })

  it("should handle { provider: 'gocardless', summary: 'Invalid access token' }", () => {
    const rawError = {
      provider: "gocardless" as const,
      summary: "Invalid access token",
    }
    const userError = parseGoCardlessRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.GOCARDLESS_RELAY_TOKEN_EXPIRED,
    )
    expect(userError.recoverable).toBe(true)
  })

  it("should handle { summary: 'Requisition not found' }", () => {
    const rawError = { summary: "Requisition not found" }
    const userError = parseGoCardlessRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.GOCARDLESS_RELAY_REQUISITION_NOT_FOUND,
    )
    expect(userError.recoverable).toBe(true)
  })

  it("should handle { summary: 'Requisition expired' }", () => {
    const rawError = { summary: "Requisition expired" }
    const userError = parseGoCardlessRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.GOCARDLESS_RELAY_REQUISITION_NOT_FOUND,
    )
  })

  it("should handle { summary: 'Access denied' }", () => {
    const rawError = { summary: "Access denied" }
    const userError = parseGoCardlessRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.GOCARDLESS_RELAY_ACCESS_DENIED,
    )
    expect(userError.recoverable).toBe(false)
  })

  it("should handle { summary: 'Rate limit exceeded' }", () => {
    const rawError = { summary: "Rate limit exceeded" }
    const userError = parseGoCardlessRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.GOCARDLESS_RELAY_RATE_LIMITED,
    )
    expect(userError.severity).toBe("warning")
    expect(userError.nextActions?.[0]?.delayMs).toBe(300000)
  })

  it("should handle { summary: 'Institution not found' }", () => {
    const rawError = { summary: "Institution not found" }
    const userError = parseGoCardlessRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.GOCARDLESS_RELAY_INSTITUTION_DOWN,
    )
  })
})

// ============================================================================
// parseGoCardlessRelayError - edge cases
// ============================================================================

describe("parseGoCardlessRelayError - edge cases", () => {
  it("should return UserError as-is when input is already a UserError", () => {
    const existingUserError: UserError = {
      type: "UserError",
      errorCode: ERROR_CODES.UNKNOWN_ERROR,
      category: ErrorCategory.UNKNOWN,
      severity: "error",
      recoverable: false,
      humanReadable: {
        title: "Test Error",
        message: "Test message",
        suggestions: [],
      },
    }
    const result = parseGoCardlessRelayError(existingUserError)
    expect(result).toBe(existingUserError)
  })

  it("should handle generic Error instance via parseRelayError", () => {
    const error = new Error("Something generic went wrong")
    const userError = parseGoCardlessRelayError(error)

    expect(userError.type).toBe("UserError")
    // Generic Errors are parsed through parseRelayError which returns RelayHttpError(0)
    // This triggers the timeout branch (statusCode === 0)
    expect(userError.errorCode).toBe(ERROR_CODES.RELAY_TIMEOUT)
    expect(userError.category).toBe(ErrorCategory.NETWORK)
  })

  it("should handle string input (primitive)", () => {
    const userError = parseGoCardlessRelayError("string error")

    expect(userError.type).toBe("UserError")
    expect(userError.errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR)
    expect(userError.humanReadable.message).toContain("unknown error")
  })

  it("should handle null input", () => {
    const userError = parseGoCardlessRelayError(null)

    expect(userError.type).toBe("UserError")
    expect(userError.errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR)
  })

  it("should handle undefined input", () => {
    const userError = parseGoCardlessRelayError(undefined)

    expect(userError.type).toBe("UserError")
    expect(userError.errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR)
  })

  it("should handle number input", () => {
    const userError = parseGoCardlessRelayError(42)

    expect(userError.type).toBe("UserError")
    expect(userError.errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR)
  })

  it("should include context accountId via raw response path", () => {
    const rawError = {
      provider: "gocardless" as const,
      summary: "Unknown provider error",
    }
    const userError = parseGoCardlessRelayError(rawError, {
      accountId: "test-account",
    })

    expect(userError.entities?.accountId).toBe("test-account")
  })

  it("should work without context parameter via raw response path", () => {
    const rawError = {
      provider: "gocardless" as const,
      summary: "Access token expired",
    }
    const userError = parseGoCardlessRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.GOCARDLESS_RELAY_TOKEN_EXPIRED,
    )
  })
})
