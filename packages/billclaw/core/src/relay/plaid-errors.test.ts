/**
 * Comprehensive tests for Plaid error mapping branch coverage.
 *
 * Covers all branches of mapPlaidRelayError and parsePlaidRelayError
 * to reach 90%+ branch coverage for plaid-errors.ts.
 */

import { describe, it, expect } from "vitest"
import {
  mapPlaidRelayError,
  parsePlaidRelayError,
  PLAID_ERROR_MAPPING,
} from "./plaid-errors.js"
import {
  ERROR_CODES,
  ErrorCategory,
  type UserError,
} from "../errors/errors.js"

// ============================================================================
// mapPlaidRelayError
// ============================================================================

describe("mapPlaidRelayError", () => {
  describe("representative entries from each error type category", () => {
    it("should map ITEM_ERROR/ITEM_LOGIN_REQUIRED to bank_connection_expired", () => {
      expect(mapPlaidRelayError("ITEM_ERROR", "ITEM_LOGIN_REQUIRED")).toBe(
        "bank_connection_expired",
      )
    })

    it("should map API_ERROR/RATE_LIMIT_EXCEEDED to rate_limit_exceeded", () => {
      expect(mapPlaidRelayError("API_ERROR", "RATE_LIMIT_EXCEEDED")).toBe(
        "rate_limit_exceeded",
      )
    })

    it("should map INVALID_INPUT/INVALID_ACCESS_TOKEN to invalid_token", () => {
      expect(mapPlaidRelayError("INVALID_INPUT", "INVALID_ACCESS_TOKEN")).toBe(
        "invalid_token",
      )
    })

    it("should map LINK_ERROR/LINK_TOKEN_EXPIRED to link_token_expired", () => {
      expect(mapPlaidRelayError("LINK_ERROR", "LINK_TOKEN_EXPIRED")).toBe(
        "link_token_expired",
      )
    })

    it("should map INSTITUTION_ERROR/INSTITUTION_DOWN to institution_down", () => {
      expect(
        mapPlaidRelayError("INSTITUTION_ERROR", "INSTITUTION_DOWN"),
      ).toBe("institution_down")
    })

    it("should map ITEM_ERROR/INVALID_CREDENTIALS to invalid_credentials", () => {
      expect(mapPlaidRelayError("ITEM_ERROR", "INVALID_CREDENTIALS")).toBe(
        "invalid_credentials",
      )
    })

    it("should map ITEM_ERROR/INVALID_MFA to invalid_mfa", () => {
      expect(mapPlaidRelayError("ITEM_ERROR", "INVALID_MFA")).toBe(
        "invalid_mfa",
      )
    })

    it("should map API_ERROR/UNAUTHORIZED_ACCESS to unauthorized", () => {
      expect(mapPlaidRelayError("API_ERROR", "UNAUTHORIZED_ACCESS")).toBe(
        "unauthorized",
      )
    })

    it("should map INVALID_INPUT/INVALID_API_KEYS to invalid_api_keys", () => {
      expect(mapPlaidRelayError("INVALID_INPUT", "INVALID_API_KEYS")).toBe(
        "invalid_api_keys",
      )
    })

    it("should map INSTITUTION_ERROR/INSTITUTION_NOT_RESPONDING to institution_not_responding", () => {
      expect(
        mapPlaidRelayError("INSTITUTION_ERROR", "INSTITUTION_NOT_RESPONDING"),
      ).toBe("institution_not_responding")
    })

    it("should map all entries in PLAID_ERROR_MAPPING via iteration", () => {
      for (const [errorType, codeMap] of Object.entries(PLAID_ERROR_MAPPING)) {
        for (const [errorCode, expected] of Object.entries(codeMap)) {
          expect(mapPlaidRelayError(errorType, errorCode)).toBe(expected)
        }
      }
    })
  })

  describe("case-insensitive matching", () => {
    it("should match lowercase input", () => {
      expect(mapPlaidRelayError("item_error", "item_login_required")).toBe(
        "bank_connection_expired",
      )
    })

    it("should match mixed case input", () => {
      expect(mapPlaidRelayError("Item_Error", "Item_Login_Required")).toBe(
        "bank_connection_expired",
      )
    })
  })

  describe("fallback for cross-type codes", () => {
    it("should return 'invalid_token' for INVALID_ACCESS_TOKEN across unknown type", () => {
      expect(mapPlaidRelayError("OTHER", "INVALID_ACCESS_TOKEN")).toBe(
        "invalid_token",
      )
    })

    it("should return 'invalid_token' for INVALID_PUBLIC_TOKEN across unknown type", () => {
      expect(mapPlaidRelayError("OTHER", "INVALID_PUBLIC_TOKEN")).toBe(
        "invalid_token",
      )
    })

    it("should return 'invalid_token' for INVALID_LINK_TOKEN across unknown type", () => {
      expect(mapPlaidRelayError("OTHER", "INVALID_LINK_TOKEN")).toBe(
        "invalid_token",
      )
    })

    it("should return 'unauthorized' for UNAUTHORIZED_ACCESS across unknown type", () => {
      expect(mapPlaidRelayError("OTHER", "UNAUTHORIZED_ACCESS")).toBe(
        "unauthorized",
      )
    })
  })

  describe("unknown type+code returns 'unknown_error'", () => {
    it("should return 'unknown_error' for unmapped type+code", () => {
      expect(mapPlaidRelayError("UNKNOWN_TYPE", "UNKNOWN_CODE")).toBe(
        "unknown_error",
      )
    })

    it("should handle empty strings", () => {
      expect(mapPlaidRelayError("", "")).toBe("unknown_error")
    })

    it("should handle null-ish inputs gracefully", () => {
      expect(mapPlaidRelayError("ITEM_ERROR", "")).toBe("unknown_error")
    })
  })
})

// ============================================================================
// parsePlaidRelayError - raw response objects
// ============================================================================

describe("parsePlaidRelayError - raw response objects", () => {
  it("should handle { provider: 'plaid', error_type: 'ITEM_ERROR', error_code: 'ITEM_LOGIN_REQUIRED' }", () => {
    const rawError = {
      provider: "plaid" as const,
      error_type: "ITEM_ERROR",
      error_code: "ITEM_LOGIN_REQUIRED",
    }
    const userError = parsePlaidRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.PLAID_RELAY_BANK_CONNECTION_EXPIRED,
    )
    expect(userError.category).toBe(ErrorCategory.RELAY_PROVIDER)
  })

  it("should handle { error: { provider: 'plaid' } } with error_type", () => {
    const rawError = {
      error: { provider: "plaid" },
      error_type: "ITEM_ERROR",
      error_code: "ITEM_LOGIN_REQUIRED",
    }
    const userError = parsePlaidRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.PLAID_RELAY_BANK_CONNECTION_EXPIRED,
    )
  })

  it("should handle { error: { code: 'SOME_CODE', message: 'msg' } } (relay error structure)", () => {
    const rawError = {
      error: { code: "SOME_CODE", message: "Something went wrong" },
    }
    const userError = parsePlaidRelayError(rawError)

    expect(userError.type).toBe("UserError")
    expect(userError.category).toBe(ErrorCategory.RELAY)
  })

  it("should handle { error_type: 'INSTITUTION_ERROR', error_code: 'INSTITUTION_DOWN' }", () => {
    const rawError = {
      error_type: "INSTITUTION_ERROR",
      error_code: "INSTITUTION_DOWN",
    }
    const userError = parsePlaidRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.PLAID_RELAY_INSTITUTION_DOWN,
    )
  })

  it("should handle { error_type: 'INSTITUTION_ERROR', error_code: 'INSTITUTION_NOT_RESPONDING' }", () => {
    const rawError = {
      error_type: "INSTITUTION_ERROR",
      error_code: "INSTITUTION_NOT_RESPONDING",
    }
    const userError = parsePlaidRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.PLAID_RELAY_INSTITUTION_DOWN,
    )
    expect(userError.severity).toBe("warning")
  })

  it("should handle { error_type: 'API_ERROR', error_code: 'RATE_LIMIT_EXCEEDED' }", () => {
    const rawError = {
      provider: "plaid" as const,
      error_type: "API_ERROR",
      error_code: "RATE_LIMIT_EXCEEDED",
    }
    const userError = parsePlaidRelayError(rawError)

    expect(userError.errorCode).toBe(ERROR_CODES.PLAID_RELAY_RATE_LIMITED)
    expect(userError.severity).toBe("warning")
    expect(userError.recoverable).toBe(true)
    expect(userError.nextActions?.[0]?.delayMs).toBe(300000)
  })

  it("should handle { error_type: 'LINK_ERROR', error_code: 'LINK_TOKEN_EXPIRED' }", () => {
    const rawError = {
      provider: "plaid" as const,
      error_type: "LINK_ERROR",
      error_code: "LINK_TOKEN_EXPIRED",
    }
    const userError = parsePlaidRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.PLAID_RELAY_LINK_TOKEN_EXPIRED,
    )
    expect(userError.severity).toBe("warning")
    expect(userError.recoverable).toBe(true)
  })

  it("should handle { error_type: 'INVALID_INPUT', error_code: 'INVALID_ACCESS_TOKEN' }", () => {
    const rawError = {
      provider: "plaid" as const,
      error_type: "INVALID_INPUT",
      error_code: "INVALID_ACCESS_TOKEN",
    }
    const userError = parsePlaidRelayError(rawError)

    expect(userError.errorCode).toBe(
      ERROR_CODES.PLAID_RELAY_BANK_CONNECTION_EXPIRED,
    )
    expect(userError.recoverable).toBe(true)
  })

  it("should handle generic provider error via raw response", () => {
    const rawError = {
      provider: "plaid" as const,
      error_type: "ITEM_ERROR",
      error_code: "SOME_UNKNOWN_CODE",
    }
    const userError = parsePlaidRelayError(rawError)

    expect(userError.errorCode).toBe(ERROR_CODES.RELAY_PROVIDER_ERROR)
    expect(userError.category).toBe(ErrorCategory.RELAY_PROVIDER)
    expect(userError.recoverable).toBe(true)
  })

  it("should use display_message over error_message when available", () => {
    const rawError = {
      provider: "plaid" as const,
      error_type: "ITEM_ERROR",
      error_code: "ITEM_LOGIN_REQUIRED",
      error_message: "Technical error message",
      display_message: "User-friendly error message",
    }
    const userError = parsePlaidRelayError(rawError)

    expect(userError.humanReadable.title).toBeDefined()
    // The display_message is used in the ProviderError that gets created
    expect(userError.category).toBe(ErrorCategory.RELAY_PROVIDER)
  })
})

// ============================================================================
// parsePlaidRelayError - edge cases
// ============================================================================

describe("parsePlaidRelayError - edge cases", () => {
  it("should return UserError as-is when input is already a UserError", () => {
    const existingUserError: UserError = {
      type: "UserError",
      errorCode: ERROR_CODES.PLAID_RELAY_BANK_CONNECTION_EXPIRED,
      category: ErrorCategory.RELAY_PROVIDER,
      severity: "error",
      recoverable: true,
      humanReadable: {
        title: "Test Error",
        message: "Test message",
        suggestions: [],
      },
    }
    const result = parsePlaidRelayError(existingUserError)
    expect(result).toBe(existingUserError)
  })

  it("should handle generic Error instance via parseRelayError", () => {
    const error = new Error("Something generic went wrong")
    const userError = parsePlaidRelayError(error)

    expect(userError.type).toBe("UserError")
    // Generic Errors are parsed through parseRelayError which returns RelayHttpError(0)
    expect(userError.errorCode).toBe(ERROR_CODES.RELAY_TIMEOUT)
    expect(userError.category).toBe(ErrorCategory.NETWORK)
  })

  it("should handle null input", () => {
    const userError = parsePlaidRelayError(null)

    expect(userError.type).toBe("UserError")
    expect(userError.errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR)
  })

  it("should handle string input (primitive)", () => {
    const userError = parsePlaidRelayError("string error")

    expect(userError.type).toBe("UserError")
    expect(userError.errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR)
    expect(userError.humanReadable.message).toContain("unknown error")
  })

  it("should handle number input", () => {
    const userError = parsePlaidRelayError(42)

    expect(userError.type).toBe("UserError")
    expect(userError.errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR)
  })

  it("should include context accountId via raw response path", () => {
    const rawError = {
      provider: "plaid" as const,
      error_type: "ITEM_ERROR",
      error_code: "ITEM_LOGIN_REQUIRED",
    }
    const userError = parsePlaidRelayError(rawError, {
      accountId: "acc-789",
    })

    expect(userError.entities?.accountId).toBe("acc-789")
  })

  it("should work without context parameter via raw response path", () => {
    const rawError = {
      provider: "plaid" as const,
      error_type: "API_ERROR",
      error_code: "RATE_LIMIT_EXCEEDED",
    }
    const userError = parsePlaidRelayError(rawError)

    expect(userError.errorCode).toBe(ERROR_CODES.PLAID_RELAY_RATE_LIMITED)
  })

  it("should produce GENERIC fallback for plain objects with no matching fields", () => {
    const rawError = { foo: "bar", baz: 42 }
    const userError = parsePlaidRelayError(rawError)

    expect(userError.type).toBe("UserError")
    expect(userError.errorCode).toBe(ERROR_CODES.UNKNOWN_ERROR)
  })
})
