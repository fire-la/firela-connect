/**
 * Tests for relay configuration utilities
 *
 * Tests health check validation and error formatting for relay configuration display.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  validateRelayConnection,
  classifyRelayError,
  formatRelayStatus,
  STARTUP_HEALTH_CHECK_TIMEOUT,
} from "./relay-config.js"
import type { RelayHealthCheckResult } from "@firela/billclaw-core/relay"
import type { RelayConfig } from "@firela/billclaw-core"

// Mock the RelayClient
vi.mock("@firela/billclaw-core/relay", () => ({
  RelayClient: vi.fn(),
}))

import { RelayClient } from "@firela/billclaw-core/relay"

describe("relay-config utilities", () => {
  let mockLogger: { debug: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("STARTUP_HEALTH_CHECK_TIMEOUT", () => {
    it("should be 3000ms (3 seconds)", () => {
      expect(STARTUP_HEALTH_CHECK_TIMEOUT).toBe(3000)
    })
  })

  describe("validateRelayConnection", () => {
    it("should return not configured when config is undefined", async () => {
      const result = await validateRelayConnection(undefined)

      expect(result).toEqual({
        available: false,
        error: "Not configured",
      })
    })

    it("should return not configured when url is missing", async () => {
      const config: RelayConfig = { apiKey: "test-key", timeout: 30000, maxRetries: 3 }

      const result = await validateRelayConnection(config)

      expect(result).toEqual({
        available: false,
        error: "Not configured",
      })
    })

    it("should return not configured when apiKey is missing", async () => {
      const config: RelayConfig = { url: "https://relay.firela.io", timeout: 30000, maxRetries: 3 }

      const result = await validateRelayConnection(config)

      expect(result).toEqual({
        available: false,
        error: "Not configured",
      })
    })

    it("should call RelayClient healthCheck with valid config", async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue({
        available: true,
        latency: 150,
      })
      vi.mocked(RelayClient).mockImplementation(() => ({
        healthCheck: mockHealthCheck,
      }) as unknown as InstanceType<typeof RelayClient>)

      const config: RelayConfig = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
        timeout: 30000,
        maxRetries: 3,
      }

      const result = await validateRelayConnection(config, mockLogger as any)

      expect(RelayClient).toHaveBeenCalledWith(
        { url: config.url, apiKey: config.apiKey },
        mockLogger,
      )
      expect(mockHealthCheck).toHaveBeenCalledWith(STARTUP_HEALTH_CHECK_TIMEOUT)
      expect(result).toEqual({
        available: true,
        latency: 150,
      })
    })

    it("should use custom timeout when provided", async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue({
        available: true,
        latency: 100,
      })
      vi.mocked(RelayClient).mockImplementation(() => ({
        healthCheck: mockHealthCheck,
      }) as unknown as InstanceType<typeof RelayClient>)

      const config: RelayConfig = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
        timeout: 30000,
        maxRetries: 3,
      }

      const customTimeout = 5000
      await validateRelayConnection(config, mockLogger as any, customTimeout)

      expect(mockHealthCheck).toHaveBeenCalledWith(customTimeout)
    })

    it("should return error result when healthCheck throws", async () => {
      vi.mocked(RelayClient).mockImplementation(() => {
        throw new Error("Network error")
      })

      const config: RelayConfig = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
        timeout: 30000,
        maxRetries: 3,
      }

      const result = await validateRelayConnection(config, mockLogger as any)

      expect(result).toEqual({
        available: false,
        error: "Network error",
      })
    })

    it("should handle non-Error throws", async () => {
      vi.mocked(RelayClient).mockImplementation(() => {
        throw "string error"
      })

      const config: RelayConfig = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
        timeout: 30000,
        maxRetries: 3,
      }

      const result = await validateRelayConnection(config, mockLogger as any)

      expect(result).toEqual({
        available: false,
        error: "Unknown error",
      })
    })
  })

  describe("classifyRelayError", () => {
    it("should return missing category when no config", () => {
      const healthResult: RelayHealthCheckResult = {
        available: false,
        error: "Failed",
      }

      const guidance = classifyRelayError(healthResult, undefined)

      expect(guidance.category).toBe("missing")
      expect(guidance.message).toBe("Relay not configured")
      expect(guidance.action).toContain("FIRELA_RELAY_URL")
      expect(guidance.action).toContain("FIRELA_RELAY_API_KEY")
    })

    it("should return missing category when config has no url or apiKey", () => {
      const healthResult: RelayHealthCheckResult = {
        available: false,
        error: "Failed",
      }
      const config: RelayConfig = { timeout: 30000, maxRetries: 3 }

      const guidance = classifyRelayError(healthResult, config)

      expect(guidance.category).toBe("missing")
    })

    it("should return invalid category when url is missing", () => {
      const healthResult: RelayHealthCheckResult = {
        available: false,
        error: "Failed",
      }
      const config: RelayConfig = { apiKey: "test-key", timeout: 30000, maxRetries: 3 }

      const guidance = classifyRelayError(healthResult, config)

      expect(guidance.category).toBe("invalid")
      expect(guidance.message).toContain("FIRELA_RELAY_URL")
    })

    it("should return invalid category when apiKey is missing", () => {
      const healthResult: RelayHealthCheckResult = {
        available: false,
        error: "Failed",
      }
      const config: RelayConfig = { url: "https://relay.firela.io", timeout: 30000, maxRetries: 3 }

      const guidance = classifyRelayError(healthResult, config)

      expect(guidance.category).toBe("invalid")
      expect(guidance.message).toContain("FIRELA_RELAY_API_KEY")
    })

    it("should return auth category for 401 error", () => {
      const healthResult: RelayHealthCheckResult = {
        available: false,
        error: "HTTP 401: Unauthorized",
      }
      const config: RelayConfig = {
        url: "https://relay.firela.io",
        apiKey: "invalid-key",
        timeout: 30000,
        maxRetries: 3,
      }

      const guidance = classifyRelayError(healthResult, config)

      expect(guidance.category).toBe("auth")
      expect(guidance.message).toBe("Invalid API key")
    })

    it("should return auth category for Unauthorized error (case insensitive)", () => {
      const healthResult: RelayHealthCheckResult = {
        available: false,
        error: "unauthorized access",
      }
      const config: RelayConfig = {
        url: "https://relay.firela.io",
        apiKey: "invalid-key",
        timeout: 30000,
        maxRetries: 3,
      }

      const guidance = classifyRelayError(healthResult, config)

      expect(guidance.category).toBe("auth")
    })

    it("should return network category for connection errors", () => {
      const healthResult: RelayHealthCheckResult = {
        available: false,
        error: "ECONNREFUSED",
      }
      const config: RelayConfig = {
        url: "https://relay.firela.io",
        apiKey: "valid-key",
        timeout: 30000,
        maxRetries: 3,
      }

      const guidance = classifyRelayError(healthResult, config)

      expect(guidance.category).toBe("network")
      expect(guidance.message).toContain("Connection failed")
      expect(guidance.action).toContain("network connection")
    })

    it("should include URL in network error action", () => {
      const healthResult: RelayHealthCheckResult = {
        available: false,
        error: "Timeout",
      }
      const config: RelayConfig = {
        url: "https://custom.relay.io",
        apiKey: "valid-key",
        timeout: 30000,
        maxRetries: 3,
      }

      const guidance = classifyRelayError(healthResult, config)

      expect(guidance.action).toContain("https://custom.relay.io")
    })
  })

  describe("formatRelayStatus", () => {
    it("should return Not configured when no config", () => {
      const healthResult: RelayHealthCheckResult = { available: false }

      const status = formatRelayStatus(healthResult, undefined)

      expect(status).toBe("Not configured")
    })

    it("should return Not configured when config has no url or apiKey", () => {
      const healthResult: RelayHealthCheckResult = { available: false }
      const config: RelayConfig = { timeout: 30000, maxRetries: 3 }

      const status = formatRelayStatus(healthResult, config)

      expect(status).toBe("Not configured")
    })

    it("should return Connected when available", () => {
      const healthResult: RelayHealthCheckResult = {
        available: true,
        latency: 150,
      }
      const config: RelayConfig = {
        url: "https://relay.firela.io",
        apiKey: "test-key",
        timeout: 30000,
        maxRetries: 3,
      }

      const status = formatRelayStatus(healthResult, config)

      expect(status).toBe("Connected")
    })

    it("should return Connected with latency in verbose mode", () => {
      const healthResult: RelayHealthCheckResult = {
        available: true,
        latency: 150,
      }
      const config: RelayConfig = {
        url: "https://relay.firela.io",
        apiKey: "test-key",
        timeout: 30000,
        maxRetries: 3,
      }

      const status = formatRelayStatus(healthResult, config, true)

      expect(status).toBe("Connected (150ms)")
    })

    it("should return Connected without latency in verbose mode if no latency", () => {
      const healthResult: RelayHealthCheckResult = { available: true }
      const config: RelayConfig = {
        url: "https://relay.firela.io",
        apiKey: "test-key",
        timeout: 30000,
        maxRetries: 3,
      }

      const status = formatRelayStatus(healthResult, config, true)

      expect(status).toBe("Connected")
    })

    it("should return Failed when not available", () => {
      const healthResult: RelayHealthCheckResult = {
        available: false,
        error: "Connection refused",
      }
      const config: RelayConfig = {
        url: "https://relay.firela.io",
        apiKey: "test-key",
        timeout: 30000,
        maxRetries: 3,
      }

      const status = formatRelayStatus(healthResult, config)

      expect(status).toBe("Failed")
    })

    it("should return Failed in verbose mode when not available", () => {
      const healthResult: RelayHealthCheckResult = {
        available: false,
        latency: 3000,
        error: "Timeout",
      }
      const config: RelayConfig = {
        url: "https://relay.firela.io",
        apiKey: "test-key",
        timeout: 30000,
        maxRetries: 3,
      }

      const status = formatRelayStatus(healthResult, config, true)

      expect(status).toBe("Failed")
    })
  })
})
