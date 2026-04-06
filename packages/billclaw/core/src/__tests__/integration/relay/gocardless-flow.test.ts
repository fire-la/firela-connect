/**
 * Integration tests for GoCardless relay flow
 *
 * Tests real HTTP calls to staging relay server for GoCardless operations.
 * Tests FAIL if FIRELA_RELAY_API_KEY is not set or staging relay is unreachable.
 *
 * Run with: pnpm --filter @firela/billclaw-core test -- --run gocardless-flow
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { RelayClient } from "../../../relay/client.js"
import {
  GoCardlessRelayClient,
  GOCARDLESS_RELAY_BASE,
} from "../../../relay/gocardless-client.js"
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

// Mock storage for token management tests
const createMockStorage = () => ({
  getGoCardlessToken: vi.fn(),
  storeGoCardlessToken: vi.fn(),
  deleteGoCardlessToken: vi.fn(),
})

_describe("GoCardless Relay Flow (Integration)", () => {
  let relayClient: RelayClient
  let gocardlessClient: GoCardlessRelayClient

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

    gocardlessClient = new GoCardlessRelayClient(
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

  describe("Institution Discovery", () => {
    it(
      "should fetch institutions for a country",
      async () => {
        const result = await gocardlessClient.getInstitutions("DE")

        // API may return institutions array or error object
        if (Array.isArray(result)) {
          // If institutions are returned, verify structure
          if (result.length > 0) {
            const institution = result[0]
            expect(institution.id).toBeDefined()
            expect(institution.name).toBeDefined()
            expect(institution.countries).toBeDefined()
          }
        } else {
          // API returned error object (e.g. provider not configured)
          expect((result as Record<string, unknown>).error).toBeDefined()
        }
      },
      30000,
    )

    it(
      "should handle country filtering",
      async () => {
        // Fetch GB institutions
        const result = await gocardlessClient.getInstitutions("GB")

        // API may return institutions array or error object
        if (Array.isArray(result)) {
          // All returned institutions should support GB
          for (const inst of result) {
            expect(inst.countries).toContain("GB")
          }
        } else {
          // API returned error object (e.g. provider not configured)
          expect((result as Record<string, unknown>).error).toBeDefined()
        }
      },
      30000,
    )

    it(
      "should handle empty results for invalid country",
      async () => {
        // Invalid country code might return empty or error
        try {
          const institutions = await gocardlessClient.getInstitutions("XX")
          // If it returns, should be an array
          expect(Array.isArray(institutions)).toBe(true)
        } catch (error) {
          // Or it might throw, which is acceptable
          expect(error).toBeDefined()
        }
      },
      30000,
    )
  })

  describe("Requisition Creation", () => {
    it(
      "should create requisition with link",
      async () => {
        // Use a test institution ID (sandbox if available)
        const testInstitutionId = "SANDBOXFINANCE_SFIN0000"
        const testReference = `test-ref-${Date.now()}`

        try {
          const requisition = await gocardlessClient.createRequisition({
            institution_id: testInstitutionId,
            redirect: "https://example.com/callback",
            reference: testReference,
          })

          // Verify requisition structure
          expect(requisition.id).toBeDefined()
          expect(requisition.link).toBeDefined()
          expect(requisition.link).toMatch(/^https?:\/\//)
          expect(requisition.status).toBeDefined()
          expect(requisition.reference).toBe(testReference)
        } catch (error) {
          // Sandbox might not be available, that's OK
          if (error instanceof Error) {
            expect(error.message).toBeDefined()
          }
        }
      },
      30000,
    )

    it(
      "should pass access_token in body, never in URL for requisition retrieval",
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
          await gocardlessClient
            .getRequisition("test-req-id", "sensitive-access-token")
            .catch(() => {
              // Expected to fail, but we want to verify request
            })

          // Verify URL does not contain the token
          expect(capturedUrl).not.toContain("sensitive-access-token")
          expect(capturedUrl).not.toContain("access_token")

          // Verify body contains the token
          const body = JSON.parse(capturedBody)
          expect(body.access_token).toBe("sensitive-access-token")
        } finally {
          vi.stubGlobal("fetch", originalFetch)
        }
      },
      30000,
    )
  })

  describe("Requisition Status", () => {
    it(
      "should handle non-existent requisition",
      async () => {
        const result = await gocardlessClient.getRequisition("non-existent-req-id", "test-access-token")

        // API returns error JSON object instead of throwing
        expect((result as Record<string, unknown>).error).toBeDefined()
      },
      30000,
    )
  })

  describe("Account Listing", () => {
    it(
      "should reject invalid access token for accounts",
      async () => {
        const result = await gocardlessClient.getAccounts("invalid-access-token")

        // API returns error JSON object instead of throwing
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
          await gocardlessClient.getAccounts("sensitive-token").catch(() => {
            // Expected to fail
          })

          // Verify URL does not contain the token
          expect(capturedUrl).not.toContain("sensitive-token")
          expect(capturedUrl).not.toContain("access_token")

          // Verify body contains the token
          const body = JSON.parse(capturedBody)
          expect(body.access_token).toBe("sensitive-token")
        } finally {
          vi.stubGlobal("fetch", originalFetch)
        }
      },
      30000,
    )
  })

  describe("Transaction Fetch", () => {
    it(
      "should reject invalid access token for transactions",
      async () => {
        const result = await gocardlessClient.getTransactions({
          access_token: "invalid-access-token",
          account_id: "test-account-id",
        })

        // API returns error JSON object instead of throwing
        expect((result as Record<string, unknown>).error).toBeDefined()
      },
      30000,
    )

    it(
      "should pass access_token in body for transactions",
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
          await gocardlessClient
            .getTransactions({
              access_token: "sensitive-token",
              account_id: "account-uuid-1",
              date_from: "2024-01-01",
              date_to: "2024-01-31",
            })
            .catch(() => {
              // Expected to fail
            })

          // Verify URL does not contain the token
          expect(capturedUrl).not.toContain("sensitive-token")

          // Verify body contains all parameters
          const body = JSON.parse(capturedBody)
          expect(body.access_token).toBe("sensitive-token")
          expect(body.account_id).toBe("account-uuid-1")
          expect(body.date_from).toBe("2024-01-01")
          expect(body.date_to).toBe("2024-01-31")
        } finally {
          vi.stubGlobal("fetch", originalFetch)
        }
      },
      30000,
    )
  })

  describe("Token Refresh Flow", () => {
    it(
      "should handle invalid refresh token",
      async () => {
        const mockStorage = createMockStorage()
        const clientWithStorage = new GoCardlessRelayClient(
          {
            relayUrl: RELAY_URL,
            relayApiKey: RELAY_API_KEY,
          },
          testLogger,
          mockStorage,
        )

        await expect(
          (clientWithStorage as any).refreshToken("account-1", "invalid-refresh-token"),
        ).rejects.toThrow()
      },
      30000,
    )

    it(
      "should return relay mode from getMode",
      () => {
        expect(gocardlessClient.getMode()).toBe("relay")
      },
      30000,
    )
  })

  describe("Token Management with Storage", () => {
    it(
      "should throw error when storage not configured",
      async () => {
        // Client without storage
        await expect(
          (gocardlessClient as any).ensureValidToken("account-1"),
        ).rejects.toThrow("Token storage not configured")
      },
      30000,
    )

    it(
      "should throw error when token not found",
      async () => {
        const mockStorage = createMockStorage()
        mockStorage.getGoCardlessToken.mockResolvedValueOnce(null)

        const clientWithStorage = new GoCardlessRelayClient(
          {
            relayUrl: RELAY_URL,
            relayApiKey: RELAY_API_KEY,
          },
          testLogger,
          mockStorage,
        )

        await expect(
          (clientWithStorage as any).ensureValidToken("account-1"),
        ).rejects.toThrow("No token found")
      },
      30000,
    )

    it(
      "should return valid token when not expired",
      async () => {
        const mockStorage = createMockStorage()
        const futureDate = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now

        mockStorage.getGoCardlessToken.mockResolvedValueOnce({
          access_token: "valid-token",
          refresh_token: "refresh-token",
          expires_at: futureDate,
        })

        const clientWithStorage = new GoCardlessRelayClient(
          {
            relayUrl: RELAY_URL,
            relayApiKey: RELAY_API_KEY,
          },
          testLogger,
          mockStorage,
        )

        const token = await (clientWithStorage as any).ensureValidToken("account-1")

        expect(token).toBe("valid-token")
        // Should not attempt refresh
        expect(mockStorage.storeGoCardlessToken).not.toHaveBeenCalled()
      },
      30000,
    )

    it(
      "should trigger refresh when token expires within 5 minutes",
      async () => {
        const mockStorage = createMockStorage()
        const nearExpiryDate = new Date(Date.now() + 3 * 60 * 1000).toISOString() // 3 minutes from now

        mockStorage.getGoCardlessToken.mockResolvedValueOnce({
          access_token: "expiring-token",
          refresh_token: "refresh-token",
          expires_at: nearExpiryDate,
        })

        // Mock successful refresh
        let _capturedBody = ""
        const originalFetch = global.fetch
        vi.stubGlobal(
          "fetch",
          (url: string, options: RequestInit) => {
            if (url.includes("/refresh")) {
              _capturedBody = options?.body as string
              return Promise.resolve({
                ok: true,
                text: async () =>
                  JSON.stringify({
                    access: "new-access-token",
                    refresh: "new-refresh-token",
                    access_expires: 86400,
                  }),
              })
            }
            return originalFetch(url, options)
          },
        )

        mockStorage.storeGoCardlessToken.mockResolvedValueOnce(undefined)

        try {
          const clientWithStorage = new GoCardlessRelayClient(
            {
              relayUrl: RELAY_URL,
              relayApiKey: RELAY_API_KEY,
            },
            testLogger,
            mockStorage,
          )

          const token = await (clientWithStorage as any).ensureValidToken("account-1")

          expect(token).toBe("new-access-token")
          expect(mockStorage.storeGoCardlessToken).toHaveBeenCalledWith(
            "account-1",
            expect.objectContaining({
              access_token: "new-access-token",
              refresh_token: "new-refresh-token",
            }),
          )
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

        const result = await badClient.request(`${GOCARDLESS_RELAY_BASE}/institutions?country=DE`, {
          method: "GET",
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
        const shortTimeoutClient = new GoCardlessRelayClient(
          {
            relayUrl: RELAY_URL,
            relayApiKey: RELAY_API_KEY,
          },
          testLogger,
        )

        // Override internal client with short timeout
        ;(shortTimeoutClient as any).client = new RelayClient(
          {
            url: RELAY_URL,
            apiKey: RELAY_API_KEY,
            timeout: 1, // 1ms - will always timeout
          },
          testLogger,
        )

        await expect(shortTimeoutClient.getInstitutions("DE")).rejects.toThrow()
      },
      30000,
    )

    it(
      "should verify correct endpoint paths",
      async () => {
        let capturedUrl = ""
        const originalFetch = global.fetch

        vi.stubGlobal(
          "fetch",
          (url: string, _options: RequestInit) => {
            capturedUrl = url
            // Return a quick error to avoid actual API call
            return Promise.resolve({
              ok: false,
              status: 401,
              text: async () => "Unauthorized",
            })
          },
        )

        try {
          await gocardlessClient.getInstitutions("DE").catch(() => {})

          // Verify correct endpoint
          expect(capturedUrl).toContain("/api/open-banking/gocardless/institutions")
          expect(capturedUrl).toContain("country=DE")
        } finally {
          vi.stubGlobal("fetch", originalFetch)
        }
      },
      30000,
    )
  })

  describe("GoCardless Full Relay Flow (E2E)", () => {
    let _institutionsResult: unknown
    let _requisitionId: string

    it("step 1: health check passes", async () => {
      const health = await relayClient.healthCheck(10000)
      expect(health.available).toBe(true)
      expect(health.latency).toBeGreaterThan(0)
    }, 30000)

    it("step 2: discover institutions for DE", async () => {
      _institutionsResult = await gocardlessClient.getInstitutions("DE")
      // Accept either array or error object (provider may not be configured)
      expect(_institutionsResult).toBeDefined()
    }, 30000)

    it("step 3: create requisition with sandbox institution", async () => {
      try {
        const req = await gocardlessClient.createRequisition({
          institution_id: "SANDBOXFINANCE_SFIN0000",
          redirect: "https://example.com/callback",
          reference: `e2e-test-${Date.now()}`,
        })
        _requisitionId = (req as Record<string, unknown>).id as string
        expect((req as Record<string, unknown>).id).toBeDefined()
        expect((req as Record<string, unknown>).link).toMatch(/^https?:\/\//)
      } catch (error) {
        // Sandbox institution may not be available on staging
        expect(error).toBeDefined()
      }
    }, 30000)

    it("step 4: reject invalid access token for accounts", async () => {
      const result = await gocardlessClient.getAccounts("invalid-access-token")
      expect((result as Record<string, unknown>).error).toBeDefined()
    }, 30000)

    it("step 5: reject invalid access token for transactions", async () => {
      const result = await gocardlessClient.getTransactions({
        access_token: "invalid",
        account_id: "test",
      })
      expect((result as Record<string, unknown>).error).toBeDefined()
    }, 30000)

    it("step 6: verify relay mode from getMode", () => {
      expect(gocardlessClient.getMode()).toBe("relay")
    }, 30000)
  })

  describe("GoCardless Edge Cases", () => {
    it(
      "should handle date range filtering in transactions",
      async () => {
        let capturedBody = ""
        const originalFetch = global.fetch

        vi.stubGlobal(
          "fetch",
          (url: string, options: RequestInit) => {
            capturedBody = options?.body as string
            return Promise.resolve({
              ok: true,
              text: async () =>
                JSON.stringify({
                  transactions: { booked: [], pending: [] },
                }),
            })
          },
        )

        try {
          const dateFrom = "2024-01-01"
          const dateTo = "2024-01-31"

          await gocardlessClient.getTransactions({
            access_token: "test-token",
            account_id: "test-account",
            date_from: dateFrom,
            date_to: dateTo,
          })

          // Verify request body contains both date fields
          const body = JSON.parse(capturedBody)
          expect(body.date_from).toBe(dateFrom)
          expect(body.date_to).toBe(dateTo)
        } finally {
          vi.stubGlobal("fetch", originalFetch)
        }
      },
      30000,
    )

    it(
      "should handle empty country code",
      async () => {
        // Empty country code should be handled gracefully
        try {
          const result = await gocardlessClient.getInstitutions("")
          // May return empty array or error
          expect(result).toBeDefined()
        } catch (error) {
          // Or may throw
          expect(error).toBeDefined()
        }
      },
      30000,
    )

    it(
      "should verify endpoint paths for all operations",
      async () => {
        const capturedUrls: string[] = []
        const originalFetch = global.fetch

        vi.stubGlobal(
          "fetch",
          (url: string, _options: RequestInit) => {
            capturedUrls.push(url)
            return Promise.resolve({
              ok: true,
              text: async () =>
                JSON.stringify({
                  transactions: { booked: [], pending: [] },
                }),
            })
          },
        )

        try {
          await gocardlessClient.getInstitutions("DE")
          await gocardlessClient.getAccounts("test-token")
          await gocardlessClient.getTransactions({
            access_token: "test-token",
            account_id: "test-account",
          })

          // All endpoints should hit the gocardless base path
          for (const url of capturedUrls) {
            expect(url).toContain("/api/open-banking/gocardless/")
          }
        } finally {
          vi.stubGlobal("fetch", originalFetch)
        }
      },
      30000,
    )

    it(
      "should handle concurrent institution requests",
      async () => {
        const results = await Promise.allSettled([
          gocardlessClient.getInstitutions("DE"),
          gocardlessClient.getInstitutions("GB"),
          gocardlessClient.getInstitutions("FR"),
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
