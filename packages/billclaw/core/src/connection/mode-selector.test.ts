/**
 * Tests for connection mode selector
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  isDirectAvailable,
  isRelayAvailable,
  selectConnectionMode,
  getFallbackMode,
  canUpgradeMode,
  getBestAvailableMode,
  selectMode,
} from "./mode-selector.js"
import { MemoryConfigProvider, MemoryEventEmitter, ConsoleLogger } from "../runtime/types.js"
import type { RuntimeContext } from "../runtime/types.js"
import type { BillclawConfig } from "../models/config.js"

describe("connection mode selector", () => {
  let mockContext: RuntimeContext
  let mockConfig: BillclawConfig

  beforeEach(() => {
    vi.clearAllMocks()

    mockConfig = {
      storage: {
        path: "~/.billclaw",
        format: "json",
        encryption: { enabled: false },
      },
      accounts: [],
      connect: {
        port: 4456,
        host: "localhost",
        publicUrl: "https://example.com/connect",
        connection: {
          mode: "auto",
          healthCheck: {
            enabled: true,
            timeout: 5000,
            retries: 2,
            retryDelay: 1000,
          },
        },
      },
    }

    mockContext = {
      logger: new ConsoleLogger(),
      config: new MemoryConfigProvider(mockConfig),
      events: new MemoryEventEmitter(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("isDirectAvailable", () => {
    it("should return available when publicUrl is set and health check passes", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const result = await isDirectAvailable(mockContext)

      expect(result.available).toBe(true)
      expect(result.latency).toBeGreaterThanOrEqual(0)
      expect(result.error).toBeUndefined()
    })

    it("should return unavailable when publicUrl is not set", async () => {
      mockConfig.connect!.publicUrl = undefined
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await isDirectAvailable(mockContext)

      expect(result.available).toBe(false)
      expect(result.error).toBe("No publicUrl configured")
    })

    it("should return unavailable when health check fails", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
        } as Response)),
      )

      const result = await isDirectAvailable(mockContext)

      expect(result.available).toBe(false)
      expect(result.error).toBe("Health check returned 503")
    })

    it("should return unavailable on network error", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.reject(new Error("Network error"))),
      )

      const result = await isDirectAvailable(mockContext)

      expect(result.available).toBe(false)
      expect(result.error).toBe("Network error")
    })
  })

  describe("isRelayAvailable", () => {
    it("should return available=false when relay config missing", async () => {
      const result = await isRelayAvailable(mockContext)
      expect(result.available).toBe(false)
      expect(result.error).toBe("Relay URL or API key not configured")
    })

    it("should return available=false when relay.url missing", async () => {
      mockConfig.relay = { apiKey: "test-key" }
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await isRelayAvailable(mockContext)
      expect(result.available).toBe(false)
      expect(result.error).toBe("Relay URL or API key not configured")
    })

    it("should return available=false when relay.apiKey missing", async () => {
      mockConfig.relay = { url: "https://relay.firela.io" }
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await isRelayAvailable(mockContext)
      expect(result.available).toBe(false)
      expect(result.error).toBe("Relay URL or API key not configured")
    })

    it("should return available=true on successful health check", async () => {
      mockConfig.relay = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
      }
      mockContext.config = new MemoryConfigProvider(mockConfig)

      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const result = await isRelayAvailable(mockContext)
      expect(result.available).toBe(true)
      expect(result.latency).toBeGreaterThanOrEqual(0)
      expect(result.error).toBeUndefined()
    })

    it("should return latency on successful check", async () => {
      mockConfig.relay = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
      }
      mockContext.config = new MemoryConfigProvider(mockConfig)

      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const result = await isRelayAvailable(mockContext)
      expect(result.latency).toBeDefined()
      expect(result.latency).toBeGreaterThanOrEqual(0)
    })

    it("should return error message on failed check", async () => {
      mockConfig.relay = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
      }
      mockContext.config = new MemoryConfigProvider(mockConfig)

      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
        } as Response)),
      )

      const result = await isRelayAvailable(mockContext)
      expect(result.available).toBe(false)
      expect(result.error).toBe("Health check returned 503")
    })

    it("should use custom timeout when provided", async () => {
      mockConfig.relay = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
      }
      mockContext.config = new MemoryConfigProvider(mockConfig)

      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const result = await isRelayAvailable(mockContext, 10000)
      expect(result.available).toBe(true)
    })
  })

  describe("selectConnectionMode", () => {
    it("should return configured mode when explicitly set to direct", async () => {
      mockConfig.connect!.connection!.mode = "direct"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "webhook")

      expect(result.mode).toBe("direct")
      expect(result.reason).toContain("User configured mode")
    })

    it("should return relay mode when explicitly set to relay", async () => {
      mockConfig.connect!.connection!.mode = "relay"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "webhook")

      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("User configured mode")
    })

    it("should return relay mode for OAuth when explicitly set to relay", async () => {
      mockConfig.connect!.connection!.mode = "relay"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "oauth")

      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("User configured mode")
    })

    it("should return relay when auto mode and relay config available", async () => {
      mockConfig.relay = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
      }
      mockConfig.connect!.connection!.mode = "auto"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const result = await selectConnectionMode(mockContext, "webhook")

      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("Relay mode available")
    })

    it("should return direct when auto and publicUrl is set (no relay)", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      mockConfig.connect!.connection!.mode = "auto"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "webhook")

      expect(result.mode).toBe("direct")
      expect(result.reason).toContain("Direct mode available")
    })

    it("should return polling when polling mode is configured for webhooks", async () => {
      mockConfig.connect!.connection!.mode = "polling"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "webhook")

      expect(result.mode).toBe("polling")
      expect(result.reason).toContain("User configured mode")
    })

    it("should fallback to polling for webhooks when relay and direct are not available", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
        } as Response)),
      )

      mockConfig.connect!.connection!.mode = "auto"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "webhook")

      expect(result.mode).toBe("polling")
      expect(result.reason).toContain("Relay unavailable")
      expect(result.reason).toContain("Direct unavailable")
    })

    it("should return relay with error reason for OAuth when no publicUrl is configured", async () => {
      mockConfig.connect!.publicUrl = undefined
      mockContext.config = new MemoryConfigProvider(mockConfig)

      // OAuth returns relay mode with error reason (not throw)
      const result = await selectConnectionMode(mockContext, "oauth")
      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("OAuth requires Relay or Direct mode")
    })

    it("should return error for OAuth when polling mode is configured", async () => {
      mockConfig.connect!.connection!.mode = "polling"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "oauth")

      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("Polling mode not supported for OAuth")
    })

    it("should detect modes in order: Relay -> Direct -> Polling", async () => {
      // All modes available: should pick Relay
      mockConfig.relay = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
      }
      mockConfig.connect!.connection!.mode = "auto"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const result = await selectConnectionMode(mockContext, "webhook")
      expect(result.mode).toBe("relay")
    })
  })

  describe("getFallbackMode", () => {
    it("should return direct when current mode is relay for webhooks", () => {
      const fallback = getFallbackMode("relay", "webhook")
      expect(fallback).toBe("direct")
    })

    it("should return polling when current mode is direct for webhooks", () => {
      const fallback = getFallbackMode("direct", "webhook")
      expect(fallback).toBe("polling")
    })

    it("should throw error for OAuth fallback", () => {
      expect(() => getFallbackMode("direct", "oauth")).toThrow(
        "OAuth requires Relay or Direct mode",
      )
    })

    it("should return polling when current mode is polling", () => {
      const fallback = getFallbackMode("polling", "webhook")
      expect(fallback).toBe("polling")
    })
  })

  describe("canUpgradeMode", () => {
    it("should return true when polling can upgrade to relay or direct", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const canUpgrade = await canUpgradeMode("polling", mockContext)
      expect(canUpgrade).toBe(true)
    })

    it("should return true when polling can upgrade to relay", async () => {
      mockConfig.relay = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
      }
      mockContext.config = new MemoryConfigProvider(mockConfig)

      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const canUpgrade = await canUpgradeMode("polling", mockContext)
      expect(canUpgrade).toBe(true)
    })

    it("should return true when direct can upgrade to relay", async () => {
      mockConfig.relay = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
      }
      mockContext.config = new MemoryConfigProvider(mockConfig)

      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const canUpgrade = await canUpgradeMode("direct", mockContext)
      expect(canUpgrade).toBe(true)
    })

    it("should return false when direct is already optimal (no relay)", async () => {
      const canUpgrade = await canUpgradeMode("direct", mockContext)
      expect(canUpgrade).toBe(false)
    })

    it("should return false when relay is already optimal", async () => {
      const canUpgrade = await canUpgradeMode("relay", mockContext)
      expect(canUpgrade).toBe(false)
    })

    it("should return false when auto is selected", async () => {
      const canUpgrade = await canUpgradeMode("auto", mockContext)
      expect(canUpgrade).toBe(false)
    })
  })

  describe("getBestAvailableMode", () => {
    it("should return relay when available", async () => {
      mockConfig.relay = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
      }
      mockContext.config = new MemoryConfigProvider(mockConfig)

      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const best = await getBestAvailableMode(mockContext, "webhook")
      expect(best).toBe("relay")
    })

    it("should return direct when relay unavailable but direct available", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const best = await getBestAvailableMode(mockContext, "webhook")
      expect(best).toBe("direct")
    })

    it("should return polling for webhooks when both unavailable", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
        } as Response)),
      )

      const best = await getBestAvailableMode(mockContext, "webhook")
      expect(best).toBe("polling")
    })

    it("should return relay for OAuth when relay available", async () => {
      mockConfig.relay = {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
      }
      mockContext.config = new MemoryConfigProvider(mockConfig)

      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const best = await getBestAvailableMode(mockContext, "oauth")
      expect(best).toBe("relay")
    })

    it("should return relay for OAuth when no modes available (as suggestion)", async () => {
      mockConfig.connect!.publicUrl = undefined
      mockContext.config = new MemoryConfigProvider(mockConfig)

      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
        } as Response)),
      )

      const best = await getBestAvailableMode(mockContext, "oauth")
      expect(best).toBe("relay")
    })
  })

  describe("selectMode (legacy compatibility)", () => {
    it("should return mode and reason in legacy format", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      mockConfig.connect!.connection!.mode = "auto"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectMode(mockContext)

      expect(result).toHaveProperty("mode")
      expect(result).toHaveProperty("reason")
      expect(result.mode).toBe("direct")
    })
  })
})
