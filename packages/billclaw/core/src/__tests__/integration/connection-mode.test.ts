/**
 * Integration test for connection mode selection
 *
 * Tests the connection mode selector which determines how BillClaw
 * connects to external services (Direct, Relay, or Polling).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { IntegrationTestHelpers } from "./setup.js"
import {
  selectConnectionMode,
  isDirectAvailable,
  isRelayAvailable,
  getFallbackMode,
  canUpgradeMode,
  getBestAvailableMode,
} from "../../connection/mode-selector.js"

describe("Connection Mode Integration", () => {
  const helpers = new IntegrationTestHelpers()

  beforeEach(async () => {
    await helpers.setupTempDir("billclaw-connection-test")
  })

  afterEach(async () => {
    await helpers.cleanup()
    vi.restoreAllMocks()
  })

  describe("Health Checks", () => {
    it("should detect Direct mode unavailable without publicUrl", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          // No publicUrl configured
        },
      })

      const result = await isDirectAvailable(context)

      expect(result.available).toBe(false)
      expect(result.error).toContain("No publicUrl configured")
    })

    it("should detect Direct mode available when health check succeeds", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          publicUrl: "https://billclaw.example.com",
        },
      })

      // Mock successful fetch response
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
      vi.stubGlobal("fetch", mockFetch)

      const result = await isDirectAvailable(context, 5000)

      expect(result.available).toBe(true)
      expect(result.latency).toBeGreaterThanOrEqual(0)
      expect(mockFetch).toHaveBeenCalledWith(
        "https://billclaw.example.com/health",
        expect.objectContaining({ method: "GET" })
      )
    })

    it("should detect Direct mode unavailable on health check failure", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          publicUrl: "https://billclaw.example.com",
        },
      })

      // Mock failed fetch response
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      })
      vi.stubGlobal("fetch", mockFetch)

      const result = await isDirectAvailable(context, 5000)

      expect(result.available).toBe(false)
      expect(result.error).toContain("503")
    })

    it("should detect Relay mode unavailable without credentials", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          receiver: {
            mode: "auto",
            relay: {
              enabled: true,
              // No webhookId or apiKey
            },
          },
        },
      })

      const result = await isRelayAvailable(context, 5000)

      expect(result.available).toBe(false)
      expect(result.error).toContain("No Relay credentials")
    })

    it("should detect Relay mode unavailable when disabled", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          receiver: {
            mode: "auto",
            relay: {
              enabled: false,
              webhookId: "test-webhook-id",
              apiKey: "test-api-key",
            },
          },
        },
      })

      const result = await isRelayAvailable(context, 5000)

      expect(result.available).toBe(false)
      expect(result.error).toContain("disabled")
    })

    it("should detect Relay mode available when configured and healthy", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          receiver: {
            mode: "auto",
            relay: {
              enabled: true,
              webhookId: "test-webhook-id",
              apiKey: "test-api-key",
            },
          },
        },
      })

      // Mock successful fetch response
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
      vi.stubGlobal("fetch", mockFetch)

      const result = await isRelayAvailable(context, 5000)

      expect(result.available).toBe(true)
      expect(result.latency).toBeGreaterThanOrEqual(0)
    })
  })

  describe("Mode Selection", () => {
    it("should respect user-configured direct mode", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          connection: {
            mode: "direct",
          },
        },
      })

      const result = await selectConnectionMode(context, "webhook")

      expect(result.mode).toBe("direct")
      expect(result.reason).toContain("User configured")
    })

    it("should respect user-configured relay mode", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          connection: {
            mode: "relay",
          },
        },
      })

      const result = await selectConnectionMode(context, "webhook")

      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("User configured")
    })

    it("should respect user-configured polling mode for webhooks", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          connection: {
            mode: "polling",
          },
        },
      })

      const result = await selectConnectionMode(context, "webhook")

      expect(result.mode).toBe("polling")
      expect(result.reason).toContain("User configured")
    })

    it("should fallback from polling to relay for OAuth", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          connection: {
            mode: "polling",
          },
        },
      })

      const result = await selectConnectionMode(context, "oauth")

      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("Polling mode not supported for OAuth")
    })

    it("should auto-select direct mode when available", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          publicUrl: "https://billclaw.example.com",
          connection: {
            mode: "auto",
          },
        },
      })

      // Mock Direct mode available
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))

      const result = await selectConnectionMode(context, "webhook")

      expect(result.mode).toBe("direct")
      expect(result.reason).toContain("Direct mode available")
    })

    it("should auto-select relay mode when direct unavailable", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          // No publicUrl - Direct unavailable (returns early without fetch)
          receiver: {
            mode: "auto",
            relay: {
              enabled: true,
              webhookId: "test-id",
              apiKey: "test-key",
            },
          },
          connection: {
            mode: "auto",
          },
        },
      })

      // Mock: Only Relay health check will be called (Direct returns early)
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))

      const result = await selectConnectionMode(context, "webhook")

      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("Relay mode available")
    })

    it("should fallback to polling for webhooks when both unavailable", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          // No publicUrl - Direct unavailable
          // No relay config - Relay unavailable
          connection: {
            mode: "auto",
          },
        },
      })

      const result = await selectConnectionMode(context, "webhook")

      expect(result.mode).toBe("polling")
      expect(result.reason).toContain("Polling mode")
    })

    it("should fallback to relay for OAuth when both unavailable", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          // No publicUrl - Direct unavailable
          // No relay config - Relay unavailable
          connection: {
            mode: "auto",
          },
        },
      })

      const result = await selectConnectionMode(context, "oauth")

      // OAuth should use relay as last resort (not polling)
      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("last resort")
    })
  })

  describe("Fallback Chain", () => {
    it("should get correct fallback mode for webhooks", () => {
      expect(getFallbackMode("direct", "webhook")).toBe("relay")
      expect(getFallbackMode("relay", "webhook")).toBe("polling")
      expect(getFallbackMode("polling", "webhook")).toBe("polling")
    })

    it("should get correct fallback mode for OAuth", () => {
      expect(getFallbackMode("direct", "oauth")).toBe("relay")
      expect(getFallbackMode("relay", "oauth")).toBe("relay") // Can't fallback to polling
      expect(getFallbackMode("polling", "oauth")).toBe("relay")
    })
  })

  describe("Mode Upgrade", () => {
    it("should detect upgrade from polling to relay", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          receiver: {
            mode: "auto",
            relay: {
              enabled: true,
              webhookId: "test-id",
              apiKey: "test-key",
            },
          },
        },
      })

      // Mock Relay available
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))

      const canUpgrade = await canUpgradeMode("polling", context)
      expect(canUpgrade).toBe(true)
    })

    it("should detect no upgrade needed when at direct", async () => {
      const context = helpers.createMockContext()

      const canUpgrade = await canUpgradeMode("direct", context)
      expect(canUpgrade).toBe(false)
    })
  })

  describe("Best Available Mode", () => {
    it("should return direct when available", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          publicUrl: "https://billclaw.example.com",
        },
      })

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))

      const best = await getBestAvailableMode(context, "webhook")
      expect(best).toBe("direct")
    })

    it("should return relay when direct unavailable", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          // No publicUrl - Direct returns early without fetch
          receiver: {
            mode: "auto",
            relay: {
              enabled: true,
              webhookId: "test-id",
              apiKey: "test-key",
            },
          },
        },
      })

      // Mock: Only Relay health check will be called (Direct returns early)
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))

      const best = await getBestAvailableMode(context, "webhook")
      expect(best).toBe("relay")
    })

    it("should return polling for webhooks when all unavailable", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          // No publicUrl, no relay
        },
      })

      const best = await getBestAvailableMode(context, "webhook")
      expect(best).toBe("polling")
    })

    it("should return relay for OAuth when all unavailable", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          // No publicUrl, no relay
        },
      })

      const best = await getBestAvailableMode(context, "oauth")
      expect(best).toBe("relay") // Can't use polling for OAuth
    })
  })

  describe("End-to-End Mode Selection Scenarios", () => {
    it("should handle production-like config with publicUrl", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          publicUrl: "https://billclaw.production.com",
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
      })

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))

      const webhookMode = await selectConnectionMode(context, "webhook")
      expect(webhookMode.mode).toBe("direct")

      const oauthMode = await selectConnectionMode(context, "oauth")
      expect(oauthMode.mode).toBe("direct")
    })

    it("should handle development config without publicUrl", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          // No publicUrl - development mode
          connection: {
            mode: "auto",
          },
        },
      })

      const webhookMode = await selectConnectionMode(context, "webhook")
      expect(webhookMode.mode).toBe("polling") // Fallback

      const oauthMode = await selectConnectionMode(context, "oauth")
      expect(oauthMode.mode).toBe("relay") // Can't use polling for OAuth
    })

    it("should handle relay-only config", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          // No publicUrl
          receiver: {
            mode: "relay",
            relay: {
              enabled: true,
              webhookId: "relay-webhook-id",
              apiKey: "relay-api-key",
            },
          },
        },
      })

      const webhookMode = await selectConnectionMode(context, "webhook")
      expect(webhookMode.mode).toBe("relay")
      expect(webhookMode.purpose).toBe("webhook")
    })
  })
})
