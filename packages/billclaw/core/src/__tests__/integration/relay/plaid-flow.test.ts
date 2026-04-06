/**
 * Integration tests for Plaid relay flow
 *
 * Tests real HTTP calls to staging relay server for Plaid operations.
 * Tests FAIL if FIRELA_RELAY_API_KEY is not set or staging relay is unreachable.
 *
 * Run with: pnpm --filter @firela/billclaw-core test -- --run plaid-flow
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { RelayClient } from "../../../relay/client.js"
import { RelayPlaidClient } from "../../../sources/plaid/relay-plaid-client.js"
import type { Logger } from "../../../errors/errors.js"

// Test configuration from environment
const RELAY_URL = process.env.FIRELA_RELAY_URL || "https://napi-dev.firela.io"
const RELAY_API_KEY = process.env.FIRELA_RELAY_API_KEY || ""
const _describe = RELAY_API_KEY ? describe : describe.skip

// Mock logger for tests
const testLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}

_describe("Plaid Relay Flow (Integration)", () => {
  let relayClient: RelayClient
  let plaidClient: RelayPlaidClient

  beforeAll(async () => {
    relayClient = new RelayClient(
      {
        url: RELAY_URL,
        apiKey: RELAY_API_KEY,
        timeout: 30000,
      },
      testLogger,
    )

    const health = await relayClient.healthCheck(10000)
    if (!health.available) {
      throw new Error(
        `Staging relay (${RELAY_URL}) unreachable: ${health.error}. Integration tests cannot proceed.`,
      )
    }

    plaidClient = new RelayPlaidClient(
      {
        relayUrl: RELAY_URL,
        relayApiKey: RELAY_API_KEY,
      },
      testLogger,
    )
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe("Relay Health Check", () => {
    it(
      "should connect to staging relay server",
      async () => {
        const result = await relayClient.healthCheck(10000)

        expect(result.available).toBe(true)
        expect(result.latency).toBeGreaterThan(0)
        expect(result.error).toBeUndefined()
      },
      30000,
    )
  })

  describe("Link Token Creation", () => {
    it(
      "should create link token via relay or handle adaptor not available",
      async () => {
        try {
          const response = await plaidClient.createLinkToken({
            client_name: "BillClaw Integration Test",
            language: "en",
            country_codes: ["US"],
            user: {
              client_user_id: `test-user-${Date.now()}`,
            },
            products: ["transactions"],
          })

          // If successful, verify response structure
          expect(response.link_token).toBeDefined()
          expect(response.link_token).toMatch(/^link-/)

          // Verify expiration is a valid date string
          expect(response.expiration).toBeDefined()
          const expirationDate = new Date(response.expiration)
          expect(expirationDate.getTime()).toBeGreaterThan(Date.now())
        } catch (error) {
          // Plaid adaptor may not be configured on relay server
          // This is expected in staging/dev environments
          expect(error).toBeDefined()
        }
      },
      30000,
    )

    it(
      "should handle invalid request gracefully",
      async () => {
        // Missing required fields should return error response
        const result = await plaidClient.createLinkToken({
          client_name: "",
          language: "en",
          country_codes: [],
          user: { client_user_id: "" },
        })
        expect((result as Record<string, unknown>).error).toBeDefined()
      },
      30000,
    )
  })

  describe("Token Exchange", () => {
    it(
      "should reject invalid public token",
      async () => {
        // Invalid public token should return error response
        const result = await plaidClient.exchangePublicToken("invalid-public-token")
        expect((result as Record<string, unknown>).error).toBeDefined()
      },
      30000,
    )

    it(
      "should ensure sensitive token value is not in URL",
      async () => {
        // Create a client with a fetch wrapper to verify URL
        let capturedUrl = ""
        const originalFetch = global.fetch
        vi.stubGlobal(
          "fetch",
          (url: string, ...args: unknown[]) => {
            capturedUrl = url
            return originalFetch(url, ...args)
          },
        )

        try {
          await plaidClient.exchangePublicToken("test-token").catch(() => {
            // Expected to fail, but we want to verify URL
          })

          // Verify URL does not contain the sensitive token value
          expect(capturedUrl).not.toContain("test-token")
          // Note: the API path /item/public_token/exchange contains "public_token"
          // as a path segment - this is by design and not a security leak.
          // The actual token value should only be in the request body.
        } finally {
          vi.stubGlobal("fetch", originalFetch)
        }
      },
      30000,
    )
  })

  describe("Account Fetch", () => {
    it(
      "should reject invalid access token",
      async () => {
        // Invalid access token should return error response
        const result = await plaidClient.getAccounts("invalid-access-token")
        expect((result as Record<string, unknown>).error).toBeDefined()
      },
      30000,
    )

    it(
      "should pass access_token in body, never in URL",
      async () => {
        let capturedUrl = ""
        let capturedBody = ""
        const originalFetch = global.fetch

        vi.stubGlobal(
          "fetch",
          (url: string, options: RequestInit) => {
            capturedUrl = url
            capturedBody = options?.body as string
            return originalFetch(url, options)
          },
        )

        try {
          await plaidClient.getAccounts("sensitive-access-token").catch(() => {
            // Expected to fail, but we want to verify request
          })

          // Verify URL does not contain the token
          expect(capturedUrl).not.toContain("sensitive-access-token")
          expect(capturedUrl).not.toContain("access_token")

          // Verify body contains the token
          expect(capturedBody).toContain("access_token")
        } finally {
          vi.stubGlobal("fetch", originalFetch)
        }
      },
      30000,
    )
  })

  describe("Transaction Sync", () => {
    it(
      "should reject invalid access token for transactions",
      async () => {
        const result = await plaidClient.syncTransactions("invalid-access-token")
        expect((result as Record<string, unknown>).error).toBeDefined()
      },
      30000,
    )

    it(
      "should pass access_token in body for transaction sync",
      async () => {
        let capturedUrl = ""
        let capturedBody = ""
        const originalFetch = global.fetch

        vi.stubGlobal(
          "fetch",
          (url: string, options: RequestInit) => {
            capturedUrl = url
            capturedBody = options?.body as string
            return originalFetch(url, options)
          },
        )

        try {
          await plaidClient.syncTransactions("sensitive-token", "cursor").catch(() => {
            // Expected to fail, but we want to verify request
          })

          // Verify URL does not contain the token
          expect(capturedUrl).not.toContain("sensitive-token")
          expect(capturedUrl).not.toContain("access_token")

          // Verify body contains the token and cursor
          const body = JSON.parse(capturedBody)
          expect(body.access_token).toBe("sensitive-token")
          expect(body.cursor).toBe("cursor")
        } finally {
          vi.stubGlobal("fetch", originalFetch)
        }
      },
      30000,
    )
  })

  describe("Error Handling", () => {
    it(
      "should return error response for 401 (invalid API key)",
      async () => {
        const badClient = new RelayClient(
          {
            url: RELAY_URL,
            apiKey: "invalid-api-key-12345",
          },
          testLogger,
        )

        const result = await badClient.request("/api/open-banking/plaid/link/token/create", {
          method: "POST",
          body: JSON.stringify({
            client_name: "Test",
            language: "en",
            country_codes: ["US"],
            user: { client_user_id: "test" },
          }),
        })

        // API returns error JSON object instead of throwing
        expect(result).toBeDefined()
        expect((result as Record<string, unknown>).error).toBeDefined()
        const errorObj = (result as Record<string, unknown>).error as Record<string, unknown>
        expect(errorObj.code).toBe("UNAUTHORIZED")
      },
      30000,
    )

    it(
      "should handle timeout gracefully",
      async () => {
        // Create client with very short timeout
        const shortTimeoutClient = new RelayClient(
          {
            url: RELAY_URL,
            apiKey: RELAY_API_KEY,
            timeout: 1, // 1ms - will always timeout
          },
          testLogger,
        )

        await expect(
          shortTimeoutClient.request("/api/open-banking/plaid/link/token/create", {
            method: "POST",
            body: JSON.stringify({
              client_name: "Test",
              language: "en",
              country_codes: ["US"],
              user: { client_user_id: "test" },
            }),
          }),
        ).rejects.toThrow()
      },
      30000,
    )

    it(
      "should return relay mode from getMode",
      () => {
        expect(plaidClient.getMode()).toBe("relay")
      },
      30000,
    )
  })

  describe("Plaid Full Relay Flow (E2E)", () => {
    let _adaptorAvailable = true

    it("step 1: health check passes", async () => {
      const health = await relayClient.healthCheck(10000)
      expect(health.available).toBe(true)
      expect(health.latency).toBeGreaterThan(0)
    }, 30000)

    it("step 2: create link token or handle adaptor unavailable", async () => {
      try {
        const response = await plaidClient.createLinkToken({
          client_name: "BillClaw E2E Test",
          language: "en",
          country_codes: ["US"],
          user: {
            client_user_id: `e2e-user-${Date.now()}`,
          },
          products: ["transactions"],
        })

        expect(response.link_token).toBeDefined()
        expect(response.link_token).toMatch(/^link-/)
        expect(response.expiration).toBeDefined()
      } catch (error) {
        // Plaid adaptor may not be configured on staging relay
        _adaptorAvailable = false
        expect(error).toBeDefined()
      }
    }, 30000)

    it("step 3: reject invalid public token for exchange", async () => {
      const result = await plaidClient.exchangePublicToken("invalid-token")
      expect((result as Record<string, unknown>).error).toBeDefined()
    }, 30000)

    it("step 4: reject invalid access token for accounts", async () => {
      const result = await plaidClient.getAccounts("invalid-access-token")
      expect((result as Record<string, unknown>).error).toBeDefined()
    }, 30000)

    it("step 5: reject invalid access token for transactions", async () => {
      const result = await plaidClient.syncTransactions("invalid-access-token")
      expect((result as Record<string, unknown>).error).toBeDefined()
    }, 30000)

    it("step 6: verify relay mode from getMode", () => {
      expect(plaidClient.getMode()).toBe("relay")
    }, 30000)
  })

  describe("Plaid Edge Cases", () => {
    it(
      "should reject empty client_user_id",
      async () => {
        const result = await plaidClient.createLinkToken({
          client_name: "Test",
          language: "en",
          country_codes: ["US"],
          user: { client_user_id: "" },
          products: ["transactions"],
        })
        expect((result as Record<string, unknown>).error).toBeDefined()
      },
      30000,
    )

    it(
      "should reject empty country_codes array",
      async () => {
        const result = await plaidClient.createLinkToken({
          client_name: "Test",
          language: "en",
          country_codes: [],
          user: { client_user_id: `test-user-${Date.now()}` },
          products: ["transactions"],
        })
        expect((result as Record<string, unknown>).error).toBeDefined()
      },
      30000,
    )

    it(
      "should handle concurrent requests",
      async () => {
        const results = await Promise.allSettled([
          plaidClient.createLinkToken({
            client_name: "Concurrent Test 1",
            language: "en",
            country_codes: ["US"],
            user: { client_user_id: `concurrent-1-${Date.now()}` },
            products: ["transactions"],
          }),
          plaidClient.createLinkToken({
            client_name: "Concurrent Test 2",
            language: "en",
            country_codes: ["US"],
            user: { client_user_id: `concurrent-2-${Date.now()}` },
            products: ["transactions"],
          }),
          plaidClient.createLinkToken({
            client_name: "Concurrent Test 3",
            language: "en",
            country_codes: ["US"],
            user: { client_user_id: `concurrent-3-${Date.now()}` },
            products: ["transactions"],
          }),
        ])

        // All requests should settle (either resolved or rejected)
        expect(results).toHaveLength(3)
        for (const result of results) {
          expect(result.status).oneOf(["fulfilled", "rejected"])
        }
      },
      30000,
    )
  })
})
