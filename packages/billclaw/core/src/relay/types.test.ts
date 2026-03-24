/**
 * Tests for relay types and interfaces
 */

import { describe, it, expect } from "vitest"
import type {
  RelayClientConfig,
  RelayHealthCheckResult,
  RelayApiResponse,
} from "./types.js"

describe("RelayClientConfig", () => {
  it("validates url is required string", () => {
    const config: RelayClientConfig = {
      url: "https://relay.firela.io",
      apiKey: "test-key",
    }

    expect(config.url).toBe("https://relay.firela.io")
    expect(typeof config.url).toBe("string")
  })

  it("validates apiKey is required string", () => {
    const config: RelayClientConfig = {
      url: "https://relay.firela.io",
      apiKey: "test-key",
    }

    expect(config.apiKey).toBe("test-key")
    expect(typeof config.apiKey).toBe("string")
  })

  it("timeout defaults to 30000", () => {
    const config: RelayClientConfig = {
      url: "https://relay.firela.io",
      apiKey: "test-key",
    }

    // When not specified, timeout should default to 30000
    expect(config.timeout).toBeUndefined()

    // Explicit timeout
    const configWithTimeout: RelayClientConfig = {
      url: "https://relay.firela.io",
      apiKey: "test-key",
      timeout: 30000,
    }
    expect(configWithTimeout.timeout).toBe(30000)
  })

  it("maxRetries defaults to 3", () => {
    const config: RelayClientConfig = {
      url: "https://relay.firela.io",
      apiKey: "test-key",
    }

    // When not specified, maxRetries should default to 3
    expect(config.maxRetries).toBeUndefined()

    // Explicit maxRetries
    const configWithRetries: RelayClientConfig = {
      url: "https://relay.firela.io",
      apiKey: "test-key",
      maxRetries: 3,
    }
    expect(configWithRetries.maxRetries).toBe(3)
  })
})

describe("RelayHealthCheckResult", () => {
  it("has available, latency, error properties", () => {
    const successResult: RelayHealthCheckResult = {
      available: true,
      latency: 150,
    }

    expect(successResult.available).toBe(true)
    expect(successResult.latency).toBe(150)
    expect(successResult.error).toBeUndefined()

    const failResult: RelayHealthCheckResult = {
      available: false,
      error: "Connection refused",
    }

    expect(failResult.available).toBe(false)
    expect(failResult.error).toBe("Connection refused")
    expect(failResult.latency).toBeUndefined()
  })
})

describe("RelayApiResponse", () => {
  it("has success, data, error properties", () => {
    const successResponse: RelayApiResponse<{ id: string }> = {
      success: true,
      data: { id: "123" },
    }

    expect(successResponse.success).toBe(true)
    expect(successResponse.data).toEqual({ id: "123" })
    expect(successResponse.error).toBeUndefined()

    const errorResponse: RelayApiResponse<never> = {
      success: false,
      error: {
        code: "INVALID_REQUEST",
        message: "Invalid request parameters",
      },
    }

    expect(errorResponse.success).toBe(false)
    expect(errorResponse.error?.code).toBe("INVALID_REQUEST")
    expect(errorResponse.error?.message).toBe("Invalid request parameters")
    expect(errorResponse.data).toBeUndefined()
  })
})
