/**
 * Tests for PlaidSyncAdapter interface and factory
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  DirectPlaidClient,
  createPlaidAdapter,
} from "./plaid-adapter.js"
import type { RuntimeContext } from "../../runtime/types.js"
import type { Logger } from "../../errors/errors.js"

// Mock RelayClient (the dependency of RelayPlaidClient)
vi.mock("../../relay/client.js", () => ({
  RelayClient: vi.fn().mockImplementation(() => ({
    request: vi.fn(),
    healthCheck: vi.fn(),
  })),
}))

// Mock mode-selector
vi.mock("../../connection/mode-selector.js", () => ({
  selectConnectionMode: vi.fn(),
}))

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}

// Mock RuntimeContext
const createMockContext = (config: any): RuntimeContext => ({
  config: {
    getConfig: vi.fn().mockResolvedValue(config),
  },
  logger: mockLogger,
  events: {
    emit: vi.fn(),
  },
} as any)

describe("PlaidSyncAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("PlaidSyncAdapter interface", () => {
    it("DirectPlaidClient has all required methods", () => {
      const client = new DirectPlaidClient(
        {
          clientId: "test-client-id",
          secret: "test-secret",
          environment: "sandbox",
        },
        mockLogger,
      )

      // Verify interface methods exist
      expect(typeof client.createLinkToken).toBe("function")
      expect(typeof client.exchangePublicToken).toBe("function")
      expect(typeof client.getAccounts).toBe("function")
      expect(typeof client.syncTransactions).toBe("function")
      expect(typeof client.getMode).toBe("function")
    })
  })

  describe("DirectPlaidClient", () => {
    it("implements PlaidSyncAdapter interface", () => {
      const client = new DirectPlaidClient(
        {
          clientId: "test-client-id",
          secret: "test-secret",
          environment: "sandbox",
        },
        mockLogger,
      )

      // Verify interface methods exist
      expect(typeof client.createLinkToken).toBe("function")
      expect(typeof client.exchangePublicToken).toBe("function")
      expect(typeof client.getAccounts).toBe("function")
      expect(typeof client.syncTransactions).toBe("function")
      expect(typeof client.getMode).toBe("function")
    })

    it("returns 'direct' from getMode()", () => {
      const client = new DirectPlaidClient(
        {
          clientId: "test-client-id",
          secret: "test-secret",
          environment: "sandbox",
        },
        mockLogger,
      )

      expect(client.getMode()).toBe("direct")
    })
  })

  describe("createPlaidAdapter factory", () => {
    it("returns RelayPlaidClient when relay mode selected", async () => {
      const { selectConnectionMode } = await import(
        "../../connection/mode-selector.js"
      )
      vi.mocked(selectConnectionMode).mockResolvedValueOnce({
        mode: "relay",
        reason: "Relay mode available",
        purpose: "oauth",
      })

      const context = createMockContext({
        relay: {
          url: "https://relay.firela.io",
          apiKey: "test-api-key",
        },
      })

      const adapter = await createPlaidAdapter(context)

      expect(adapter.getMode()).toBe("relay")
      expect(mockLogger.info).toHaveBeenCalledWith("Using Plaid relay mode")
    })

    it("returns DirectPlaidClient when direct mode selected", async () => {
      const { selectConnectionMode } = await import(
        "../../connection/mode-selector.js"
      )
      vi.mocked(selectConnectionMode).mockResolvedValueOnce({
        mode: "direct",
        reason: "Direct mode available",
        purpose: "oauth",
      })

      const context = createMockContext({
        plaid: {
          clientId: "test-client-id",
          secret: "test-secret",
          environment: "sandbox",
        },
      })

      const adapter = await createPlaidAdapter(context)

      expect(adapter.getMode()).toBe("direct")
      expect(mockLogger.info).toHaveBeenCalledWith("Using Plaid direct mode")
    })

    it("respects explicit mode from config (relay)", async () => {
      const { selectConnectionMode } = await import(
        "../../connection/mode-selector.js"
      )
      vi.mocked(selectConnectionMode).mockResolvedValueOnce({
        mode: "relay",
        reason: "User configured mode: relay",
        purpose: "oauth",
      })

      const context = createMockContext({
        connect: {
          connection: { mode: "relay" },
        },
        relay: {
          url: "https://relay.firela.io",
          apiKey: "test-api-key",
        },
      })

      const adapter = await createPlaidAdapter(context)
      expect(adapter.getMode()).toBe("relay")
    })

    it("respects explicit mode from config (direct)", async () => {
      const { selectConnectionMode } = await import(
        "../../connection/mode-selector.js"
      )
      vi.mocked(selectConnectionMode).mockResolvedValueOnce({
        mode: "direct",
        reason: "User configured mode: direct",
        purpose: "oauth",
      })

      const context = createMockContext({
        connect: {
          connection: { mode: "direct" },
        },
        plaid: {
          clientId: "test-client-id",
          secret: "test-secret",
          environment: "sandbox",
        },
      })

      const adapter = await createPlaidAdapter(context)
      expect(adapter.getMode()).toBe("direct")
    })

    it("throws error when relay mode selected but relay config missing", async () => {
      const { selectConnectionMode } = await import(
        "../../connection/mode-selector.js"
      )
      vi.mocked(selectConnectionMode).mockResolvedValueOnce({
        mode: "relay",
        reason: "Relay mode available",
        purpose: "oauth",
      })

      const context = createMockContext({
        // No relay config
      })

      await expect(createPlaidAdapter(context)).rejects.toThrow(
        "Relay mode selected but relay configuration is missing",
      )
    })

    it("throws error when direct mode selected but Plaid credentials missing", async () => {
      const { selectConnectionMode } = await import(
        "../../connection/mode-selector.js"
      )
      vi.mocked(selectConnectionMode).mockResolvedValueOnce({
        mode: "direct",
        reason: "Direct mode available",
        purpose: "oauth",
      })

      const context = createMockContext({
        // No Plaid credentials
      })

      await expect(createPlaidAdapter(context)).rejects.toThrow(
        "Direct mode selected but Plaid credentials are missing",
      )
    })
  })

  describe("both adapters have consistent getMode() return values", () => {
    it("RelayPlaidClient returns 'relay'", async () => {
      const { selectConnectionMode } = await import(
        "../../connection/mode-selector.js"
      )
      vi.mocked(selectConnectionMode).mockResolvedValueOnce({
        mode: "relay",
        reason: "Relay mode available",
        purpose: "oauth",
      })

      const context = createMockContext({
        relay: {
          url: "https://relay.firela.io",
          apiKey: "test-api-key",
        },
      })

      const client = await createPlaidAdapter(context)
      expect(client.getMode()).toBe("relay")
    })

    it("DirectPlaidClient returns 'direct'", () => {
      const client = new DirectPlaidClient(
        {
          clientId: "test-client-id",
          secret: "test-secret",
          environment: "sandbox",
        },
        mockLogger,
      )
      expect(client.getMode()).toBe("direct")
    })
  })
})
