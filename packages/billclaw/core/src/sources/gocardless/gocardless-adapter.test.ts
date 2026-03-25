/**
 * Tests for GoCardless adapter and factory
 *
 * Tests the factory function that creates GoCardless adapter instances
 * based on connection mode configuration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  GoCardlessSyncAdapter,
  createGoCardlessAdapter,
} from "./gocardless-adapter.js"
import type { RuntimeContext } from "../../runtime/types.js"

// Mock the mode selector
vi.mock("../../connection/mode-selector.js", () => ({
  selectConnectionMode: vi.fn(),
}))

// Mock the GoCardlessRelayClient
vi.mock("../../relay/gocardless-client.js", () => ({
  GoCardlessRelayClient: vi.fn().mockImplementation(() => ({
    getInstitutions: vi.fn(),
    createRequisition: vi.fn(),
    getRequisition: vi.fn(),
    getAccounts: vi.fn(),
    getTransactions: vi.fn(),
    getMode: vi.fn().mockReturnValue("relay"),
  })),
}))

import { selectConnectionMode } from "../../connection/mode-selector.js"
import { GoCardlessRelayClient } from "../../relay/gocardless-client.js"

describe("createGoCardlessAdapter", () => {
  let mockContext: RuntimeContext

  beforeEach(() => {
    vi.clearAllMocks()

    mockContext = {
      config: {
        getConfig: vi.fn().mockResolvedValue({
          relay: {
            url: "https://relay.firela.io",
            apiKey: "test-api-key",
          },
        }),
      },
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    } as any
  })

  describe("relay mode", () => {
    it("returns relay client when relay mode selected", async () => {
      vi.mocked(selectConnectionMode).mockResolvedValueOnce({
        mode: "relay",
        reason: "Relay URL and API key configured",
      })

      const adapter = await createGoCardlessAdapter(mockContext)

      expect(selectConnectionMode).toHaveBeenCalledWith(mockContext, "oauth")
      expect(adapter).toBeDefined()
      expect(adapter.getMode()).toBe("relay")
    })

    it("logs mode selection", async () => {
      vi.mocked(selectConnectionMode).mockResolvedValueOnce({
        mode: "relay",
        reason: "Relay URL and API key configured",
      })

      await createGoCardlessAdapter(mockContext)

      expect(mockContext.logger.info).toHaveBeenCalledWith(
        "Using GoCardless relay mode",
      )
    })

    it("throws error when relay not configured", async () => {
      vi.mocked(selectConnectionMode).mockResolvedValueOnce({
        mode: "relay",
        reason: "Relay URL and API key configured",
      })

      mockContext.config.getConfig = vi.fn().mockResolvedValue({
        relay: {}, // Missing url and apiKey
      })

      await expect(createGoCardlessAdapter(mockContext)).rejects.toThrow(
        "Relay mode selected but relay configuration is missing",
      )
    })
  })

  describe("direct mode (not supported)", () => {
    it("throws error for direct mode (GoCardless is relay-only)", async () => {
      vi.mocked(selectConnectionMode).mockResolvedValueOnce({
        mode: "direct",
        reason: "Direct mode configured",
      })

      await expect(createGoCardlessAdapter(mockContext)).rejects.toThrow(
        "GoCardless direct mode is not supported. Use relay mode.",
      )
    })
  })

  describe("polling mode (not supported)", () => {
    it("throws error for polling mode (GoCardless is relay-only)", async () => {
      vi.mocked(selectConnectionMode).mockResolvedValueOnce({
        mode: "polling",
        reason: "Polling mode fallback",
      })

      // Both direct and polling modes throw the same error
      await expect(createGoCardlessAdapter(mockContext)).rejects.toThrow(
        "GoCardless direct mode is not supported. Use relay mode.",
      )
    })
  })
})

describe("GoCardlessSyncAdapter interface", () => {
  it("matches PlaidSyncAdapter pattern", () => {
    // This test verifies the interface structure matches expected pattern
    const adapterMethods = [
      "getInstitutions",
      "createRequisition",
      "getRequisition",
      "getAccounts",
      "getTransactions",
      "getMode",
    ]

    // Create a mock adapter to verify interface
    const mockAdapter: GoCardlessSyncAdapter = {
      getInstitutions: async () => [],
      createRequisition: async () =>
        ({
          id: "test",
          redirect: "",
          status: "CR",
          accounts: [],
          reference: "",
          link: "",
        }) as any,
      getRequisition: async () =>
        ({
          id: "test",
          redirect: "",
          status: "DN",
          accounts: [],
          reference: "",
          link: "",
        }) as any,
      getAccounts: async () => [],
      getTransactions: async () => ({ transactions: { booked: [], pending: [] } }),
      getMode: () => "relay",
    }

    adapterMethods.forEach((method) => {
      expect(typeof (mockAdapter as any)[method]).toBe("function")
    })
  })
})
