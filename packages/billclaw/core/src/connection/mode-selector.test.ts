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
        receiver: {
          relay: {
            webhookId: "wh_test123",
            apiKey: "sk_test_key",
            enabled: true,
            apiUrl: "https://relay.firela.io/api/webhook-relay",
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
    it("should return available when credentials are set and health check passes", async () => {
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

    it("should return unavailable when credentials are not configured", async () => {
      mockConfig.connect!.receiver!.relay = undefined as any
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await isRelayAvailable(mockContext)

      expect(result.available).toBe(false)
      expect(result.error).toBe("No Relay credentials configured")
    })

    it("should return unavailable when relay is disabled", async () => {
      mockConfig.connect!.receiver!.relay!.enabled = false
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await isRelayAvailable(mockContext)

      expect(result.available).toBe(false)
      expect(result.error).toBe("Relay mode is disabled")
    })

    it("should return unavailable when health check fails", async () => {
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
  })

  describe("selectConnectionMode", () => {
    it("should return configured mode when explicitly set to direct", async () => {
      mockConfig.connect!.connection!.mode = "direct"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "webhook")

      expect(result.mode).toBe("direct")
      expect(result.reason).toContain("User configured mode")
    })

    it("should return configured mode when explicitly set to relay", async () => {
      mockConfig.connect!.connection!.mode = "relay"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "webhook")

      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("User configured mode")
    })

    it("should return relay when polling mode is configured for OAuth", async () => {
      mockConfig.connect!.connection!.mode = "polling"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "oauth")

      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("Polling mode not supported for OAuth")
    })

    it("should return polling when polling mode is configured for webhooks", async () => {
      mockConfig.connect!.connection!.mode = "polling"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "webhook")

      expect(result.mode).toBe("polling")
      expect(result.reason).toContain("User configured mode")
    })

    it("should auto-select direct mode when available", async () => {
      vi.stubGlobal("fetch", vi.fn((url: string) => {
        if (url.includes("/health")) {
          return Promise.resolve({
            ok: true,
            status: 200,
          } as Response)
        }
        return Promise.reject(new Error("Not found"))
      }))

      mockConfig.connect!.connection!.mode = "auto"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "webhook")

      expect(result.mode).toBe("direct")
      expect(result.reason).toContain("Direct mode available")
    })

    it("should auto-select relay mode when direct is unavailable but relay is", async () => {
      vi.stubGlobal("fetch", vi.fn((url: string) => {
        if (url.includes("example.com")) {
          return Promise.resolve({
            ok: false,
            status: 503,
          } as Response)
        }
        if (url.includes("relay")) {
          return Promise.resolve({
            ok: true,
            status: 200,
          } as Response)
        }
        return Promise.reject(new Error("Not found"))
      }))

      mockConfig.connect!.connection!.mode = "auto"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "webhook")

      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("Relay mode available")
    })

    it("should fallback to polling for webhooks when neither direct nor relay is available", async () => {
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
      expect(result.reason).toContain("Polling mode")
    })

    it("should return relay as last resort for OAuth when no modes are available", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
        } as Response)),
      )

      mockConfig.connect!.connection!.mode = "auto"
      mockContext.config = new MemoryConfigProvider(mockConfig)

      const result = await selectConnectionMode(mockContext, "oauth")

      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("No mode available")
    })
  })

  describe("getFallbackMode", () => {
    it("should return relay when current mode is direct for webhooks", () => {
      const fallback = getFallbackMode("direct", "webhook")
      expect(fallback).toBe("relay")
    })

    it("should return relay when current mode is direct for OAuth", () => {
      const fallback = getFallbackMode("direct", "oauth")
      expect(fallback).toBe("relay")
    })

    it("should return polling when current mode is relay for webhooks", () => {
      const fallback = getFallbackMode("relay", "webhook")
      expect(fallback).toBe("polling")
    })

    it("should return relay when current mode is relay for OAuth", () => {
      const fallback = getFallbackMode("relay", "oauth")
      expect(fallback).toBe("relay")
    })

    it("should return polling when current mode is polling", () => {
      const fallback = getFallbackMode("polling", "webhook")
      expect(fallback).toBe("polling")
    })

    it("should return polling when current mode is auto", () => {
      const fallback = getFallbackMode("auto", "webhook")
      expect(fallback).toBe("polling")
    })
  })

  describe("canUpgradeMode", () => {
    it("should return true when polling can upgrade to relay", async () => {
      vi.stubGlobal("fetch", vi.fn((url: string) => {
        if (url.includes("relay")) {
          return Promise.resolve({
            ok: true,
            status: 200,
          } as Response)
        }
        return Promise.resolve({
          ok: false,
          status: 503,
        } as Response)
      }))

      const canUpgrade = await canUpgradeMode("polling", mockContext)
      expect(canUpgrade).toBe(true)
    })

    it("should return true when polling can upgrade to direct", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const canUpgrade = await canUpgradeMode("polling", mockContext)
      expect(canUpgrade).toBe(true)
    })

    it("should return true when relay can upgrade to direct", async () => {
      vi.stubGlobal("fetch", vi.fn((url: string) => {
        if (url.includes("example.com")) {
          return Promise.resolve({
            ok: true,
            status: 200,
          } as Response)
        }
        return Promise.resolve({
          ok: false,
          status: 503,
        } as Response)
      }))

      const canUpgrade = await canUpgradeMode("relay", mockContext)
      expect(canUpgrade).toBe(true)
    })

    it("should return false when direct is already optimal", async () => {
      const canUpgrade = await canUpgradeMode("direct", mockContext)
      expect(canUpgrade).toBe(false)
    })

    it("should return false when auto is selected", async () => {
      const canUpgrade = await canUpgradeMode("auto", mockContext)
      expect(canUpgrade).toBe(false)
    })
  })

  describe("getBestAvailableMode", () => {
    it("should return direct when available", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
        } as Response)),
      )

      const best = await getBestAvailableMode(mockContext, "webhook")
      expect(best).toBe("direct")
    })

    it("should return relay when direct is unavailable but relay is", async () => {
      vi.stubGlobal("fetch", vi.fn((url: string) => {
        if (url.includes("example.com")) {
          return Promise.resolve({
            ok: false,
            status: 503,
          } as Response)
        }
        return Promise.resolve({
          ok: true,
          status: 200,
        } as Response)
      }))

      const best = await getBestAvailableMode(mockContext, "webhook")
      expect(best).toBe("relay")
    })

    it("should return relay for OAuth when neither direct nor relay is available", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
        } as Response)),
      )

      const best = await getBestAvailableMode(mockContext, "oauth")
      expect(best).toBe("relay")
    })

    it("should return polling for webhooks when neither direct nor relay is available", async () => {
      vi.stubGlobal("fetch", vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
        } as Response)),
      )

      const best = await getBestAvailableMode(mockContext, "webhook")
      expect(best).toBe("polling")
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
