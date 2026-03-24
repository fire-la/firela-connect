/**
 * Tests for relay error types
 */

import { describe, it, expect } from "vitest"
import {
  RelayHttpError,
  RelayError,
  ProviderError,
  parseRelayError,
} from "./errors.js"

describe("RelayHttpError", () => {
  it("constructor sets statusCode, message, retryable properties", () => {
    const error = new RelayHttpError(503, "Service Unavailable", true)

    expect(error.statusCode).toBe(503)
    expect(error.message).toBe("Service Unavailable")
    expect(error.retryable).toBe(true)
    expect(error.name).toBe("RelayHttpError")
  })

  it("creates non-retryable error for 404", () => {
    const error = new RelayHttpError(404, "Not Found", false)

    expect(error.retryable).toBe(false)
  })
})

describe("RelayError", () => {
  it("constructor sets code, message, userMessage properties", () => {
    const error = new RelayError(
      "RELAY_AUTH_FAILED",
      "Authentication failed",
      "Failed to authenticate with relay service",
    )

    expect(error.code).toBe("RELAY_AUTH_FAILED")
    expect(error.message).toBe("Authentication failed")
    expect(error.userMessage).toBe("Failed to authenticate with relay service")
    expect(error.name).toBe("RelayError")
  })
})

describe("ProviderError", () => {
  it("constructor sets provider, code, message properties for Plaid", () => {
    const error = new ProviderError(
      "plaid",
      "INVALID_INPUT",
      "Invalid input provided",
    )

    expect(error.provider).toBe("plaid")
    expect(error.code).toBe("INVALID_INPUT")
    expect(error.message).toBe("Invalid input provided")
    expect(error.name).toBe("ProviderError")
  })

  it("constructor sets provider, code, message properties for GoCardless", () => {
    const error = new ProviderError(
      "gocardless",
      "RATE_LIMIT",
      "Rate limit exceeded",
    )

    expect(error.provider).toBe("gocardless")
    expect(error.code).toBe("RATE_LIMIT")
    expect(error.message).toBe("Rate limit exceeded")
    expect(error.name).toBe("ProviderError")
  })
})

describe("parseRelayError", () => {
  it("maps HTTP 401 to RelayError with RELAY_AUTH_FAILED code", () => {
    const error = parseRelayError(
      { status: 401, message: "Unauthorized" },
      { endpoint: "/test" },
    )

    expect(error).toBeInstanceOf(RelayError)
    if (error instanceof RelayError) {
      expect(error.code).toBe("RELAY_AUTH_FAILED")
      expect(error.userMessage).toContain("authenticate")
    }
  })

  it("maps HTTP 429 to RelayError with RELAY_RATE_LIMITED code", () => {
    const error = parseRelayError(
      { status: 429, message: "Too Many Requests" },
      { endpoint: "/test" },
    )

    expect(error).toBeInstanceOf(RelayError)
    if (error instanceof RelayError) {
      expect(error.code).toBe("RELAY_RATE_LIMITED")
      expect(error.userMessage.toLowerCase()).toContain("wait")
    }
  })

  it("maps timeout errors to RelayHttpError with retryable=true", () => {
    const timeoutError = new Error("The operation was aborted due to timeout")
    const error = parseRelayError(timeoutError, { endpoint: "/test" })

    expect(error).toBeInstanceOf(RelayHttpError)
    if (error instanceof RelayHttpError) {
      expect(error.retryable).toBe(true)
    }
  })

  it("maps HTTP 500 to RelayHttpError with retryable=true", () => {
    const error = parseRelayError(
      { status: 500, message: "Internal Server Error" },
      { endpoint: "/test" },
    )

    expect(error).toBeInstanceOf(RelayHttpError)
    if (error instanceof RelayHttpError) {
      expect(error.retryable).toBe(true)
      expect(error.statusCode).toBe(500)
    }
  })

  it("maps HTTP 502 to RelayHttpError with retryable=true", () => {
    const error = parseRelayError(
      { status: 502, message: "Bad Gateway" },
      { endpoint: "/test" },
    )

    expect(error).toBeInstanceOf(RelayHttpError)
    if (error instanceof RelayHttpError) {
      expect(error.retryable).toBe(true)
    }
  })

  it("maps HTTP 503 to RelayHttpError with retryable=true", () => {
    const error = parseRelayError(
      { status: 503, message: "Service Unavailable" },
      { endpoint: "/test" },
    )

    expect(error).toBeInstanceOf(RelayHttpError)
    if (error instanceof RelayHttpError) {
      expect(error.retryable).toBe(true)
    }
  })

  it("maps HTTP 504 to RelayHttpError with retryable=true", () => {
    const error = parseRelayError(
      { status: 504, message: "Gateway Timeout" },
      { endpoint: "/test" },
    )

    expect(error).toBeInstanceOf(RelayHttpError)
    if (error instanceof RelayHttpError) {
      expect(error.retryable).toBe(true)
    }
  })

  it("maps network errors to RelayHttpError with retryable=true", () => {
    const networkError = new Error("ECONNREFUSED")
    const error = parseRelayError(networkError, { endpoint: "/test" })

    expect(error).toBeInstanceOf(RelayHttpError)
    if (error instanceof RelayHttpError) {
      expect(error.retryable).toBe(true)
    }
  })

  it("maps provider errors to ProviderError", () => {
    const providerError = {
      provider: "plaid",
      error_code: "INVALID_INPUT",
      error_message: "Invalid input",
    }
    const error = parseRelayError(providerError, { endpoint: "/test" })

    expect(error).toBeInstanceOf(ProviderError)
    if (error instanceof ProviderError) {
      expect(error.provider).toBe("plaid")
      expect(error.code).toBe("INVALID_INPUT")
    }
  })

  it("maps 404 to RelayHttpError with retryable=false", () => {
    const error = parseRelayError(
      { status: 404, message: "Not Found" },
      { endpoint: "/test" },
    )

    expect(error).toBeInstanceOf(RelayHttpError)
    if (error instanceof RelayHttpError) {
      expect(error.retryable).toBe(false)
    }
  })
})
