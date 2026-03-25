/**
 * Tests for RelayPlaidClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { RelayPlaidClient } from "./relay-plaid-client.js"
import type { Logger } from "../../errors/errors.js"

// Mock RelayClient
vi.mock("../../relay/client.js", () => ({
  RelayClient: vi.fn().mockImplementation(() => ({
    request: vi.fn(),
    healthCheck: vi.fn(),
  })),
}))

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}

describe("RelayPlaidClient", () => {
  let client: RelayPlaidClient
  let mockRelayClient: { request: ReturnType<typeof vi.fn>; healthCheck: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Get the mock constructor and instance
    const { RelayClient } = await import("../../relay/client.js")
    mockRelayClient = {
      request: vi.fn(),
      healthCheck: vi.fn(),
    }
    vi.mocked(RelayClient).mockReturnValue(mockRelayClient as any)

    client = new RelayPlaidClient(
      {
        relayUrl: "https://relay.firela.io",
        relayApiKey: "test-api-key",
      },
      mockLogger,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("constructor", () => {
    it("creates RelayClient with correct config", async () => {
      const { RelayClient } = await import("../../relay/client.js")

      new RelayPlaidClient(
        {
          relayUrl: "https://relay.firela.io",
          relayApiKey: "test-api-key",
        },
        mockLogger,
      )

      expect(RelayClient).toHaveBeenCalledWith(
        {
          url: "https://relay.firela.io",
          apiKey: "test-api-key",
        },
        mockLogger,
      )
    })
  })

  describe("createLinkToken", () => {
    it("calls POST /api/open-banking/plaid/link/token/create", async () => {
      const mockResponse = {
        link_token: "link-sandbox-123",
        expiration: "2024-01-01T00:00:00Z",
      }
      mockRelayClient.request.mockResolvedValueOnce(mockResponse)

      const result = await client.createLinkToken({
        client_name: "BillClaw",
        language: "en",
        country_codes: ["US"],
        user: { client_user_id: "user-123" },
      })

      expect(mockRelayClient.request).toHaveBeenCalledWith(
        "/api/open-banking/plaid/link/token/create",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        }),
      )

      // Verify request body contains the correct data
      const callArgs = mockRelayClient.request.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      expect(requestBody).toEqual({
        client_name: "BillClaw",
        language: "en",
        country_codes: ["US"],
        user: { client_user_id: "user-123" },
      })

      expect(result).toEqual(mockResponse)
    })
  })

  describe("exchangePublicToken", () => {
    it("calls POST /api/open-banking/plaid/item/public_token/exchange", async () => {
      const mockResponse = {
        access_token: "access-sandbox-123",
        item_id: "item-456",
      }
      mockRelayClient.request.mockResolvedValueOnce(mockResponse)

      const result = await client.exchangePublicToken("public-token-123")

      expect(mockRelayClient.request).toHaveBeenCalledWith(
        "/api/open-banking/plaid/item/public_token/exchange",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        }),
      )

      // Verify public_token is in body
      const callArgs = mockRelayClient.request.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      expect(requestBody).toEqual({
        public_token: "public-token-123",
      })

      expect(result).toEqual(mockResponse)
    })
  })

  describe("getAccounts", () => {
    it("calls POST /api/open-banking/plaid/accounts/get with access_token in body", async () => {
      const mockResponse = {
        accounts: [
          {
            account_id: "acc-1",
            balances: { available: 100, current: 150, iso_currency_code: "USD" },
            name: "Checking",
            type: "depository",
          },
        ],
        item: { item_id: "item-1" },
      }
      mockRelayClient.request.mockResolvedValueOnce(mockResponse)

      const result = await client.getAccounts("access-token-123")

      expect(mockRelayClient.request).toHaveBeenCalledWith(
        "/api/open-banking/plaid/accounts/get",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        }),
      )

      // SECURITY: Verify access_token is in body, NOT in URL
      const callArgs = mockRelayClient.request.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      expect(requestBody).toEqual({
        access_token: "access-token-123",
      })

      // Verify endpoint does NOT contain token
      expect(callArgs[0]).not.toContain("access-token")

      expect(result).toEqual(mockResponse)
    })
  })

  describe("syncTransactions", () => {
    it("calls POST /api/open-banking/plaid/transactions/sync with cursor", async () => {
      const mockResponse = {
        added: [],
        modified: [],
        removed: [],
        next_cursor: "cursor-next",
        has_more: false,
      }
      mockRelayClient.request.mockResolvedValueOnce(mockResponse)

      const result = await client.syncTransactions("access-token-123", "cursor-abc")

      expect(mockRelayClient.request).toHaveBeenCalledWith(
        "/api/open-banking/plaid/transactions/sync",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        }),
      )

      // Verify request body
      const callArgs = mockRelayClient.request.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      expect(requestBody).toEqual({
        access_token: "access-token-123",
        cursor: "cursor-abc",
        count: 500,
      })

      expect(result).toEqual(mockResponse)
    })

    it("works without cursor (initial sync)", async () => {
      const mockResponse = {
        added: [],
        modified: [],
        removed: [],
        next_cursor: "cursor-first",
        has_more: true,
      }
      mockRelayClient.request.mockResolvedValueOnce(mockResponse)

      const result = await client.syncTransactions("access-token-123")

      const callArgs = mockRelayClient.request.mock.calls[0]
      const requestBody = JSON.parse(callArgs[1].body)
      expect(requestBody).toEqual({
        access_token: "access-token-123",
        cursor: undefined,
        count: 500,
      })

      expect(result).toEqual(mockResponse)
    })

    it("passes access_token in body, never in URL", async () => {
      mockRelayClient.request.mockResolvedValueOnce({
        added: [],
        modified: [],
        removed: [],
        next_cursor: "cursor",
        has_more: false,
      })

      await client.syncTransactions("secret-access-token", "cursor")

      const callArgs = mockRelayClient.request.mock.calls[0]
      const endpoint = callArgs[0]
      const requestBody = JSON.parse(callArgs[1].body)

      // SECURITY: Verify token is NOT in URL
      expect(endpoint).not.toContain("secret")
      expect(endpoint).not.toContain("token")

      // SECURITY: Verify token IS in body
      expect(requestBody.access_token).toBe("secret-access-token")
    })
  })

  describe("getMode", () => {
    it("returns 'relay'", () => {
      expect(client.getMode()).toBe("relay")
    })
  })

  describe("error propagation", () => {
    it("properly propagates errors from relay", async () => {
      const relayError = new Error("Relay connection failed")
      mockRelayClient.request.mockRejectedValueOnce(relayError)

      await expect(client.getAccounts("access-token")).rejects.toThrow(
        "Relay connection failed",
      )
    })

    it("propagates ProviderError from relay", async () => {
      const providerError = new Error("Plaid error: ITEM_LOGIN_REQUIRED")
      mockRelayClient.request.mockRejectedValueOnce(providerError)

      await expect(client.syncTransactions("access-token")).rejects.toThrow(
        "Plaid error",
      )
    })
  })
})
