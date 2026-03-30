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
import { ProviderError, RelayError, RelayHttpError } from "./errors.js"
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
// parseGoCardlessRelayError - ProviderError branches
// ============================================================================

describe("parseGoCardlessRelayError - ProviderError branches", () => {
  describe("token_expired + invalid_access_token", () => {
    it("should return GOCARDLESS_RELAY_TOKEN_EXPIRED for token_expired code", () => {
      const error = new ProviderError(
        "gocardless",
        "token_expired",
        "Access token expired",
      )
      const userError = parseGoCardlessRelayError(error)

      expect(userError.errorCode).toBe(
        ERROR_CODES.GOCARDLESS_RELAY_TOKEN_EXPIRED,
      )
      expect(userError.category).toBe(ErrorCategory.RELAY_PROVIDER)
      expect(userError.severity).toBe("error")
      expect(userError.recoverable).toBe(true)
    })

    it("should return GOCARDLESS_RELAY_TOKEN_EXPIRED for invalid_access_token code", () => {
      const error = new ProviderError(
        "gocardless",
        "invalid_access_token",
        "Invalid access token",
      )
      const userError = parseGoCardlessRelayError(error)

      expect(userError.errorCode).toBe(
        ERROR_CODES.GOCARDLESS_RELAY_TOKEN_EXPIRED,
      )
      expect(userError.recoverable).toBe(true)
    })

    it("should include accountId in entities when context provided", () => {
      const error = new ProviderError(
        "gocardless",
        "token_expired",
        "Expired",
      )
      const userError = parseGoCardlessRelayError(error, {
        accountId: "acc-123",
      })

      expect(userError.entities?.accountId).toBe("acc-123")
    })
  })

  describe("requisition_not_found + requisition_expired", () => {
    it("should return REQUISITION_NOT_FOUND for requisition_not_found code", () => {
      const error = new ProviderError(
        "gocardless",
        "requisition_not_found",
        "Not found",
      )
      const userError = parseGoCardlessRelayError(error)

      expect(userError.errorCode).toBe(
        ERROR_CODES.GOCARDLESS_RELAY_REQUISITION_NOT_FOUND,
      )
      expect(userError.recoverable).toBe(true)
    })

    it("should return REQUISITION_NOT_FOUND for requisition_expired code", () => {
      const error = new ProviderError(
        "gocardless",
        "requisition_expired",
        "Expired",
      )
      const userError = parseGoCardlessRelayError(error)

      expect(userError.errorCode).toBe(
        ERROR_CODES.GOCARDLESS_RELAY_REQUISITION_NOT_FOUND,
      )
      expect(userError.recoverable).toBe(true)
    })
  })

  describe("access_denied", () => {
    it("should return ACCESS_DENIED for access_denied code", () => {
      const error = new ProviderError(
        "gocardless",
        "access_denied",
        "Access denied",
      )
      const userError = parseGoCardlessRelayError(error)

      expect(userError.errorCode).toBe(
        ERROR_CODES.GOCARDLESS_RELAY_ACCESS_DENIED,
      )
      expect(userError.recoverable).toBe(false)
    })
  })

  describe("rate_limit_exceeded", () => {
    it("should return RATE_LIMITED for rate_limit_exceeded code", () => {
      const error = new ProviderError(
        "gocardless",
        "rate_limit_exceeded",
        "Too many requests",
      )
      const userError = parseGoCardlessRelayError(error)

      expect(userError.errorCode).toBe(
        ERROR_CODES.GOCARDLESS_RELAY_RATE_LIMITED,
      )
      expect(userError.severity).toBe("warning")
      expect(userError.recoverable).toBe(true)
      expect(userError.nextActions?.[0]?.delayMs).toBe(300000)
    })
  })

  describe("institution_down + institution_not_found", () => {
    it("should return INSTITUTION_DOWN for institution_down code", () => {
      const error = new ProviderError(
        "gocardless",
        "institution_down",
        "Bank is down",
      )
      const userError = parseGoCardlessRelayError(error)

      expect(userError.errorCode).toBe(
        ERROR_CODES.GOCARDLESS_RELAY_INSTITUTION_DOWN,
      )
      expect(userError.severity).toBe("warning")
      expect(userError.recoverable).toBe(true)
    })

    it("should return INSTITUTION_DOWN for institution_not_found code", () => {
      const error = new ProviderError(
        "gocardless",
        "institution_not_found",
        "Not found",
      )
      const userError = parseGoCardlessRelayError(error)

      expect(userError.errorCode).toBe(
        ERROR_CODES.GOCARDLESS_RELAY_INSTITUTION_DOWN,
      )
    })
  })

  describe("generic provider error fallback", () => {
    it("should return RELAY_PROVIDER_ERROR for unknown provider code", () => {
      const error = new ProviderError(
        "gocardless",
        "unknown_code",
        "Some error",
      )
      const userError = parseGoCardlessRelayError(error)

      expect(userError.errorCode).toBe(ERROR_CODES.RELAY_PROVIDER_ERROR)
      expect(userError.recoverable).toBe(true)
    })
  })
})

// ============================================================================
// parseGoCardlessRelayError - RelayError branches
// ============================================================================

describe("parseGoCardlessRelayError - RelayError branches", () => {
  it("should handle RELAY_AUTH_FAILED", () => {
    const error = new RelayError(
      "RELAY_AUTH_FAILED",
      "Auth failed",
      "Check your API key",
    )
    const userError = parseGoCardlessRelayError(error)

    expect(userError.errorCode).toBe(ERROR_CODES.RELAY_AUTH_FAILED)
    expect(userError.category).toBe(ErrorCategory.RELAY)
    expect(userError.severity).toBe("error")
    expect(userError.recoverable).toBe(true)
  })

  it("should handle RELAY_RATE_LIMITED", () => {
    const error = new RelayError(
      "RELAY_RATE_LIMITED",
      "Rate limited",
      "Too many requests",
    )
    const userError = parseGoCardlessRelayError(error)

    expect(userError.errorCode).toBe(ERROR_CODES.RELAY_RATE_LIMITED)
    expect(userError.category).toBe(ErrorCategory.RELAY)
    expect(userError.severity).toBe("warning")
    expect(userError.recoverable).toBe(true)
  })

  it("should handle generic relay error code", () => {
    const error = new RelayError("OTHER", "Some error", "Generic relay error")
    const userError = parseGoCardlessRelayError(error)

    expect(userError.errorCode).toBe(ERROR_CODES.RELAY_PROVIDER_ERROR)
    expect(userError.category).toBe(ErrorCategory.RELAY)
    expect(userError.humanReadable.message).toContain("Generic relay error")
  })
})

// ============================================================================
// parseGoCardlessRelayError - RelayHttpError branches
// ============================================================================

describe("parseGoCardlessRelayError - RelayHttpError branches", () => {
  it("should handle timeout (statusCode 0)", () => {
    const error = new RelayHttpError(0, "Request timeout", true)
    const userError = parseGoCardlessRelayError(error)

    expect(userError.errorCode).toBe(ERROR_CODES.RELAY_TIMEOUT)
    expect(userError.category).toBe(ErrorCategory.NETWORK)
    expect(userError.severity).toBe("warning")
    expect(userError.recoverable).toBe(true)
  })

  it("should handle timeout via message containing 'timeout'", () => {
    const error = new RelayHttpError(500, "Connection timeout occurred", true)
    const userError = parseGoCardlessRelayError(error)

    expect(userError.errorCode).toBe(ERROR_CODES.RELAY_TIMEOUT)
  })

  it("should handle 5xx server error", () => {
    const error = new RelayHttpError(503, "Service unavailable", true)
    const userError = parseGoCardlessRelayError(error)

    expect(userError.errorCode).toBe(ERROR_CODES.RELAY_CONNECTION_FAILED)
    expect(userError.category).toBe(ErrorCategory.NETWORK)
    expect(userError.humanReadable.message).toContain("503")
  })

  it("should handle other HTTP error (4xx)", () => {
    const error = new RelayHttpError(418, "I'm a teapot", false)
    const userError = parseGoCardlessRelayError(error)

    expect(userError.errorCode).toBe(ERROR_CODES.RELAY_CONNECTION_FAILED)
    expect(userError.category).toBe(ErrorCategory.NETWORK)
    expect(userError.severity).toBe("error")
    expect(userError.recoverable).toBe(false)
  })

  it("should include retry action for non-retryable HTTP errors without nextActions", () => {
    const error = new RelayHttpError(418, "I'm a teapot", false)
    const userError = parseGoCardlessRelayError(error)

    expect(userError.nextActions).toBeUndefined()
  })

  it("should include retry action for retryable HTTP errors", () => {
    const error = new RelayHttpError(418, "I'm a teapot", true)
    const userError = parseGoCardlessRelayError(error)

    expect(userError.nextActions).toBeDefined()
    expect(userError.nextActions?.[0]?.type).toBe("retry")
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

  it("should include context accountId when provided", () => {
    const error = new ProviderError(
      "gocardless",
      "unknown_code",
      "Error msg",
    )
    const userError = parseGoCardlessRelayError(error, {
      accountId: "test-account",
    })

    expect(userError.entities?.accountId).toBe("test-account")
  })

  it("should work without context parameter", () => {
    const error = new ProviderError(
      "gocardless",
      "token_expired",
      "Expired",
    )
    const userError = parseGoCardlessRelayError(error)

    expect(userError.errorCode).toBe(
      ERROR_CODES.GOCARDLESS_RELAY_TOKEN_EXPIRED,
    )
  })
})
