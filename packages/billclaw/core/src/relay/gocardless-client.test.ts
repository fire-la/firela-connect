/**
 * Tests for GoCardlessRelayClient
 *
 * Tests the GoCardless relay client implementation that wraps RelayClient
 * for all GoCardless Bank Account Data operations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { GoCardlessRelayClient, GOCARDLESS_RELAY_BASE } from "./gocardless-client.js"
import type { Institution, Requisition, Account, TransactionsResponse } from "./gocardless-types.js"
import { ProviderError } from "./errors.js"

// Mock RelayClient
vi.mock("./client.js", () => ({
  RelayClient: vi.fn().mockImplementation(() => ({
    request: vi.fn(),
  })),
}))

describe("GoCardlessRelayClient", () => {
  let client: GoCardlessRelayClient
  let mockRequest: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    client = new GoCardlessRelayClient(
      {
        relayUrl: "https://relay.firela.io",
        relayApiKey: "test-api-key",
      },
      {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as any,
    )
    // Access the mocked request method
    mockRequest = (client as any).client.request
  })

  describe("constructor", () => {
    it("creates RelayClient instance", () => {
      expect(client).toBeDefined()
    })
  })

  describe("getInstitutions", () => {
    it("returns filtered institutions", async () => {
      const mockInstitutions: Institution[] = [
        {
          id: "SANDBOXFINANCE_SFIN0000",
          name: "Sandbox Finance",
          bic: "SFIN0000",
          countries: ["GB"],
          logo: "https://example.com/logo.png",
          transaction_total_days: 90,
        },
        {
          id: "BANK_ID_DE",
          name: "German Bank",
          bic: "DEUTDEFF",
          countries: ["DE"],
          logo: "https://example.com/logo2.png",
          transaction_total_days: 90,
        },
      ]

      mockRequest.mockResolvedValueOnce(mockInstitutions)

      const result = await client.getInstitutions("DE")

      expect(mockRequest).toHaveBeenCalledWith(
        `${GOCARDLESS_RELAY_BASE}/institutions?country=DE`,
        { method: "GET" },
      )
      expect(result).toEqual(mockInstitutions)
    })
  })

  describe("createRequisition", () => {
    it("returns requisition with link", async () => {
      const mockRequisition: Requisition = {
        id: "req-uuid-123",
        redirect: "https://example.com/callback",
        status: "CR",
        accounts: [],
        reference: "ref-123",
        link: "https://ob.gocardless.com/link/123",
      }

      mockRequest.mockResolvedValueOnce(mockRequisition)

      const result = await client.createRequisition({
        institution_id: "SANDBOXFINANCE_SFIN0000",
        redirect: "https://example.com/callback",
        reference: "ref-123",
      })

      expect(mockRequest).toHaveBeenCalledWith(
        `${GOCARDLESS_RELAY_BASE}/requisitions`,
        {
          method: "POST",
          body: JSON.stringify({
            institution_id: "SANDBOXFINANCE_SFIN0000",
            redirect: "https://example.com/callback",
            reference: "ref-123",
          }),
        },
      )
      expect(result).toEqual(mockRequisition)
      expect(result.link).toBe("https://ob.gocardless.com/link/123")
    })
  })

  describe("getRequisition", () => {
    it("returns requisition status", async () => {
      const mockRequisition: Requisition = {
        id: "req-uuid-123",
        redirect: "https://example.com/callback",
        status: "DN",
        accounts: ["acc-uuid-1", "acc-uuid-2"],
        reference: "ref-123",
        link: "https://ob.gocardless.com/link/123",
      }

      mockRequest.mockResolvedValueOnce(mockRequisition)

      const result = await client.getRequisition("req-uuid-123", "access-token")

      expect(mockRequest).toHaveBeenCalledWith(
        `${GOCARDLESS_RELAY_BASE}/requisitions/req-uuid-123`,
        {
          method: "POST",
          // SECURITY: access_token in body, never in URL
          body: JSON.stringify({ access_token: "access-token" }),
        },
      )
      expect(result).toEqual(mockRequisition)
      expect(result.status).toBe("DN")
      expect(result.accounts).toHaveLength(2)
    })

    it("passes access_token in body, never in URL", async () => {
      const mockRequisition: Requisition = {
        id: "req-uuid-123",
        redirect: "https://example.com/callback",
        status: "CR",
        accounts: [],
        reference: "ref-123",
        link: "https://ob.gocardless.com/link/123",
      }

      mockRequest.mockResolvedValueOnce(mockRequisition)

      await client.getRequisition("req-uuid-123", "sensitive-token")

      // Verify the URL does NOT contain the token
      const calledUrl = mockRequest.mock.calls[0][0]
      expect(calledUrl).not.toContain("sensitive-token")
      expect(calledUrl).not.toContain("access_token")

      // Verify the body DOES contain the token
      const calledBody = mockRequest.mock.calls[0][1].body
      const parsedBody = JSON.parse(calledBody)
      expect(parsedBody.access_token).toBe("sensitive-token")
    })
  })

  describe("getAccounts", () => {
    it("returns account list", async () => {
      const mockAccounts: Account[] = [
        {
          id: "acc-uuid-1",
          created: "2024-01-15T10:30:00Z",
          iban: "GB29NWBK60161331926819",
          institution_id: "SANDBOXFINANCE_SFIN0000",
          status: "READY",
          owner_name: "John Doe",
        },
      ]

      mockRequest.mockResolvedValueOnce(mockAccounts)

      const result = await client.getAccounts("access-token")

      expect(mockRequest).toHaveBeenCalledWith(
        `${GOCARDLESS_RELAY_BASE}/accounts`,
        {
          method: "POST",
          // SECURITY: access_token in body, never in URL
          body: JSON.stringify({ access_token: "access-token" }),
        },
      )
      expect(result).toEqual(mockAccounts)
    })

    it("passes access_token in body, never in URL", async () => {
      mockRequest.mockResolvedValueOnce([])

      await client.getAccounts("sensitive-access-token")

      // Verify the URL does NOT contain the token
      const calledUrl = mockRequest.mock.calls[0][0]
      expect(calledUrl).not.toContain("sensitive-access-token")
      expect(calledUrl).not.toContain("access_token")

      // Verify the body DOES contain the token
      const calledBody = mockRequest.mock.calls[0][1].body
      const parsedBody = JSON.parse(calledBody)
      expect(parsedBody.access_token).toBe("sensitive-access-token")
    })
  })

  describe("getTransactions", () => {
    it("returns transactions response", async () => {
      const mockResponse: TransactionsResponse = {
        transactions: {
          booked: [
            {
              transactionId: "tx-1",
              bookingDate: "2024-01-15",
              valueDate: "2024-01-15",
              transactionAmount: { amount: "-50.00", currency: "EUR" },
            },
          ],
          pending: [],
        },
      }

      mockRequest.mockResolvedValueOnce(mockResponse)

      const result = await client.getTransactions({
        access_token: "access-token",
        account_id: "acc-uuid-1",
      })

      expect(mockRequest).toHaveBeenCalledWith(
        `${GOCARDLESS_RELAY_BASE}/transactions`,
        {
          method: "POST",
          body: JSON.stringify({
            access_token: "access-token",
            account_id: "acc-uuid-1",
          }),
        },
      )
      expect(result).toEqual(mockResponse)
      expect(result.transactions.booked).toHaveLength(1)
    })

    it("passes access_token in body, never in URL", async () => {
      mockRequest.mockResolvedValueOnce({ transactions: { booked: [], pending: [] } })

      await client.getTransactions({
        access_token: "sensitive-token",
        account_id: "acc-uuid-1",
      })

      // Verify the URL does NOT contain the token
      const calledUrl = mockRequest.mock.calls[0][0]
      expect(calledUrl).not.toContain("sensitive-token")
      expect(calledUrl).not.toContain("access_token")

      // Verify the body DOES contain the token
      const calledBody = mockRequest.mock.calls[0][1].body
      const parsedBody = JSON.parse(calledBody)
      expect(parsedBody.access_token).toBe("sensitive-token")
    })

    it("includes date filters when provided", async () => {
      mockRequest.mockResolvedValueOnce({ transactions: { booked: [], pending: [] } })

      await client.getTransactions({
        access_token: "access-token",
        account_id: "acc-uuid-1",
        date_from: "2024-01-01",
        date_to: "2024-01-31",
      })

      const calledBody = mockRequest.mock.calls[0][1].body
      const parsedBody = JSON.parse(calledBody)
      expect(parsedBody.date_from).toBe("2024-01-01")
      expect(parsedBody.date_to).toBe("2024-01-31")
    })
  })

  describe("getMode", () => {
    it("returns 'relay'", () => {
      expect(client.getMode()).toBe("relay")
    })
  })

  describe("token management", () => {
    let mockStorage: any

    beforeEach(() => {
      // Create mock storage
      mockStorage = {
        getGoCardlessToken: vi.fn(),
        storeGoCardlessToken: vi.fn(),
        deleteGoCardlessToken: vi.fn(),
      }

      // Create client with storage
      client = new GoCardlessRelayClient(
        {
          relayUrl: "https://relay.firela.io",
          relayApiKey: "test-api-key",
        },
        {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any,
        mockStorage,
      )
      mockRequest = (client as any).client.request
    })

    describe("ensureValidToken", () => {
      it("returns valid token when not expired", async () => {
        const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
        mockStorage.getGoCardlessToken.mockResolvedValueOnce({
          access_token: "valid-token",
          refresh_token: "refresh-token",
          expires_at: futureDate,
        })

        const token = await (client as any).ensureValidToken("account-1")

        expect(token).toBe("valid-token")
        expect(mockStorage.getGoCardlessToken).toHaveBeenCalledWith("account-1")
        expect(mockRequest).not.toHaveBeenCalled() // Should not refresh
      })

      it("triggers refresh when token expires within 5 minutes", async () => {
        const nearExpiryDate = new Date(Date.now() + 3 * 60 * 1000).toISOString() // 3 minutes from now
        mockStorage.getGoCardlessToken.mockResolvedValueOnce({
          access_token: "expiring-token",
          refresh_token: "refresh-token",
          expires_at: nearExpiryDate,
        })

        mockRequest.mockResolvedValueOnce({
          access: "new-access-token",
          refresh: "new-refresh-token",
          access_expires: 86400, // 24 hours
        })

        const token = await (client as any).ensureValidToken("account-1")

        expect(token).toBe("new-access-token")
        expect(mockRequest).toHaveBeenCalledWith(
          expect.stringContaining("/refresh"),
          expect.objectContaining({
            method: "POST",
          }),
        )
        expect(mockStorage.storeGoCardlessToken).toHaveBeenCalledWith(
          "account-1",
          expect.objectContaining({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
          }),
        )
      })

      it("throws ProviderError if no token found", async () => {
        mockStorage.getGoCardlessToken.mockResolvedValueOnce(null)

        await expect((client as any).ensureValidToken("account-1")).rejects.toThrow(
          "No token found",
        )
      })

      it("throws ProviderError with token_not_found code when token not found", async () => {
        mockStorage.getGoCardlessToken.mockResolvedValueOnce(null)

        try {
          await (client as any).ensureValidToken("account-1")
          // Should not reach here
          expect(true).toBe(false)
        } catch (error) {
          expect(error).toBeInstanceOf(ProviderError)
          expect((error as ProviderError).code).toBe("token_not_found")
          expect((error as ProviderError).provider).toBe("gocardless")
        }
      })
    })

    describe("refreshToken", () => {
      it("updates storage with new tokens", async () => {
        mockRequest.mockResolvedValueOnce({
          access: "new-access-token",
          refresh: "new-refresh-token",
          access_expires: 86400,
        })

        const token = await (client as any).refreshToken("account-1", "old-refresh-token")

        expect(token).toBe("new-access-token")
        expect(mockRequest).toHaveBeenCalledWith(
          expect.stringContaining("/refresh"),
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ refresh_token: "old-refresh-token" }),
          }),
        )
        expect(mockStorage.storeGoCardlessToken).toHaveBeenCalledWith(
          "account-1",
          expect.objectContaining({
            access_token: "new-access-token",
            refresh_token: "new-refresh-token",
          }),
        )
      })

      it("throws ProviderError with token_refresh_failed code on API failure", async () => {
        mockRequest.mockRejectedValueOnce(new Error("Refresh failed"))

        try {
          await (client as any).refreshToken("account-1", "invalid-refresh-token")
          // Should not reach here
          expect(true).toBe(false)
        } catch (error) {
          expect(error).toBeInstanceOf(ProviderError)
          expect((error as ProviderError).code).toBe("token_refresh_failed")
          expect((error as ProviderError).provider).toBe("gocardless")
        }
      })
    })
  })

  describe("ensureValidToken without storage", () => {
    it("throws ProviderError when storage not configured", async () => {
      // Create client without storage
      const clientWithoutStorage = new GoCardlessRelayClient(
        {
          relayUrl: "https://relay.firela.io",
          relayApiKey: "test-api-key",
        },
        {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any,
        // No storage parameter
      )

      try {
        await (clientWithoutStorage as any).ensureValidToken("account-1")
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError)
        expect((error as ProviderError).code).toBe("storage_not_configured")
        expect((error as ProviderError).provider).toBe("gocardless")
      }
    })
  })
})
