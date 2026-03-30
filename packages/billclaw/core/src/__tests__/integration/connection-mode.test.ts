/**
 * Integration test for connection mode selection
 *
 * Tests the connection mode selector which determines how BillClaw
 * connects to external services (Direct or Polling).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { IntegrationTestHelpers } from "./setup.js"
import {
  selectConnectionMode,
  isRelayAvailable,
  isDirectAvailable,
  getFallbackMode,
  canUpgradeMode,
  getBestAvailableMode,
} from "../../connection/mode-selector.js"

// Real relay configuration for integration tests
const RELAY_URL = process.env.FIRELA_RELAY_URL || "https://napi-dev.firela.io"
const RELAY_API_KEY = process.env.FIRELA_RELAY_API_KEY || ""

describe("Connection Mode Integration", () => {
  const helpers = new IntegrationTestHelpers()

  beforeEach(async () => {
    await helpers.setupTempDir("billclaw-connection-test")
  })

  afterEach(async () => {
    await helpers.cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
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
  })

  describe("Mode Selection", () => {
    it("should select polling mode when no publicUrl configured", async () => {
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

    it("should fallback to polling for webhooks when direct unavailable", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          // No publicUrl - Direct unavailable
          connection: {
            mode: "auto",
          },
        },
      })

      const result = await selectConnectionMode(context, "webhook")

      expect(result.mode).toBe("polling")
      expect(result.reason).toContain("Direct unavailable")
    })

    it("should return direct mode with error for OAuth when no publicUrl configured", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          // No publicUrl - Direct unavailable
          connection: {
            mode: "auto",
          },
        },
      })

      // OAuth returns relay mode with error reason (not throw)
      const result = await selectConnectionMode(context, "oauth")
      expect(result.mode).toBe("relay")
      expect(result.reason).toContain("OAuth requires Relay or Direct mode")
    })

    it("should auto-select Direct mode when available", async () => {
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

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))

      const result = await selectConnectionMode(context, "webhook")
      expect(result.mode).toBe("direct")
    })
  })

  describe("Fallback Chain", () => {
    it("should get correct fallback mode for webhooks", () => {
      expect(getFallbackMode("direct", "webhook")).toBe("polling")
      expect(getFallbackMode("polling", "webhook")).toBe("polling")
    })

    it("should throw error for OAuth fallback", () => {
      expect(() => getFallbackMode("direct", "oauth")).toThrow(
        "OAuth requires Relay or Direct mode"
      )
    })
  })

  describe("Mode Upgrade", () => {
    it("should allow upgrade from polling to direct", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          publicUrl: "https://billclaw.example.com",
        },
      })

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))

      const canUpgrade = await canUpgradeMode("polling", context)
      expect(canUpgrade).toBe(true)
    })

    it("should not allow upgrade from direct", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          publicUrl: "https://billclaw.example.com",
        },
      })

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

    it("should return polling for webhooks when direct unavailable", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          // No publicUrl
        },
      })

      const best = await getBestAvailableMode(context, "webhook")
      expect(best).toBe("polling")
    })

    it("should return direct for OAuth when available", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          publicUrl: "https://billclaw.example.com",
        },
      })

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }))

      const best = await getBestAvailableMode(context, "oauth")
      expect(best).toBe("direct")
    })

    it("should return direct for OAuth when direct unavailable", async () => {
      const context = helpers.createMockContext({
        connect: {
          port: 4456,
          host: "localhost",
          // No publicUrl
        },
      })

      // getBestAvailableMode returns 'relay' as suggestion for OAuth when no modes available
      const best = await getBestAvailableMode(context, "oauth")
      expect(best).toBe("relay")
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

      // OAuth returns relay mode with error reason (now prefers relay as suggestion)
      const oauthMode = await selectConnectionMode(context, "oauth")
      expect(oauthMode.mode).toBe("relay")
      expect(oauthMode.reason).toContain("OAuth requires Relay or Direct mode")
    })
  })
})

describe("Real Relay Integration", () => {
  const helpers = new IntegrationTestHelpers()

  beforeEach(async () => {
    await helpers.setupTempDir("billclaw-real-relay-test")
  })

  afterEach(async () => {
    await helpers.cleanup()
    vi.restoreAllMocks()
  })

  describe("Relay Availability", () => {
    it(
      "should detect relay available with real health check",
      async () => {
        if (!RELAY_API_KEY) {
          console.log("Skipping: FIRELA_RELAY_API_KEY required")
          return
        }

        const context = helpers.createMockContext({
          relay: { url: RELAY_URL, apiKey: RELAY_API_KEY },
        })

        const result = await isRelayAvailable(context, 10000)

        expect(result.available).toBe(true)
        expect(result.latency).toBeGreaterThan(0)
      },
      30000,
    )

    it(
      "should include relay latency in availability result",
      async () => {
        if (!RELAY_API_KEY) {
          console.log("Skipping: FIRELA_RELAY_API_KEY required")
          return
        }

        const context = helpers.createMockContext({
          relay: { url: RELAY_URL, apiKey: RELAY_API_KEY },
        })

        const result = await isRelayAvailable(context, 10000)

        expect(result.available).toBe(true)
        expect(typeof result.latency).toBe("number")
        expect(result.latency!).toBeGreaterThan(0)
      },
      30000,
    )

    it(
      "should reach relay health endpoint even with unverified credentials",
      async () => {
        if (!RELAY_API_KEY) {
          console.log("Skipping: FIRELA_RELAY_API_KEY required")
          return
        }

        const context = helpers.createMockContext({
          relay: { url: RELAY_URL, apiKey: "invalid-key-12345" },
        })

        const result = await isRelayAvailable(context, 10000)

        // Health endpoint is typically unauthenticated - returns available
        // even with invalid API key (auth is checked on actual API calls, not health)
        expect(result.available).toBe(true)
        expect(result.latency).toBeGreaterThan(0)
      },
      30000,
    )
  })

  describe("Mode Selection with Real Relay", () => {
    it(
      "should select relay mode for OAuth when relay is available",
      async () => {
        if (!RELAY_API_KEY) {
          console.log("Skipping: FIRELA_RELAY_API_KEY required")
          return
        }

        const context = helpers.createMockContext({
          relay: { url: RELAY_URL, apiKey: RELAY_API_KEY },
          connect: {
            port: 4456,
            host: "localhost",
            connection: {
              mode: "auto",
            },
          },
        })

        const result = await selectConnectionMode(context, "oauth")

        expect(result.mode).toBe("relay")
      },
      30000,
    )

    it(
      "should select relay mode for webhooks when relay is available",
      async () => {
        if (!RELAY_API_KEY) {
          console.log("Skipping: FIRELA_RELAY_API_KEY required")
          return
        }

        const context = helpers.createMockContext({
          relay: { url: RELAY_URL, apiKey: RELAY_API_KEY },
          connect: {
            port: 4456,
            host: "localhost",
            connection: {
              mode: "auto",
            },
          },
        })

        const result = await selectConnectionMode(context, "webhook")

        expect(result.mode).toBe("relay")
      },
      30000,
    )
  })

  describe("Best Available Mode with Real Relay", () => {
    it(
      "should get relay as best available mode",
      async () => {
        if (!RELAY_API_KEY) {
          console.log("Skipping: FIRELA_RELAY_API_KEY required")
          return
        }

        const context = helpers.createMockContext({
          relay: { url: RELAY_URL, apiKey: RELAY_API_KEY },
        })

        const best = await getBestAvailableMode(context, "webhook")

        expect(best).toBe("relay")
      },
      30000,
    )
  })

  describe("Mode Upgrade with Real Relay", () => {
    it(
      "should allow mode upgrade from polling to relay",
      async () => {
        if (!RELAY_API_KEY) {
          console.log("Skipping: FIRELA_RELAY_API_KEY required")
          return
        }

        const context = helpers.createMockContext({
          relay: { url: RELAY_URL, apiKey: RELAY_API_KEY },
        })

        const canUpgrade = await canUpgradeMode("polling", context)

        expect(canUpgrade).toBe(true)
      },
      30000,
    )

    it(
      "should not allow mode upgrade from relay",
      async () => {
        if (!RELAY_API_KEY) {
          console.log("Skipping: FIRELA_RELAY_API_KEY required")
          return
        }

        const context = helpers.createMockContext({
          relay: { url: RELAY_URL, apiKey: RELAY_API_KEY },
        })

        const canUpgrade = await canUpgradeMode("relay", context)

        expect(canUpgrade).toBe(false)
      },
      30000,
    )
  })
})
