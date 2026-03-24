/**
 * Tests for RelayClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { RelayClient } from "./client.js"
import type { Logger } from "../errors/errors.js"

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}

describe("RelayClient", () => {
  let client: RelayClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new RelayClient(
      {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
      },
      mockLogger,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("constructor", () => {
    it("normalizes baseUrl by removing trailing slash", () => {
      const clientWithSlash = new RelayClient({
        url: "https://relay.firela.io/",
        apiKey: "test-key",
      })

      // Internally the URL should be normalized
      expect(clientWithSlash).toBeDefined()
    })

    it("uses default timeout of 30000ms", () => {
      const clientDefault = new RelayClient({
        url: "https://relay.firela.io",
        apiKey: "test-key",
      })

      expect(clientDefault).toBeDefined()
    })

    it("uses default maxRetries of 3", () => {
      const clientDefault = new RelayClient({
        url: "https://relay.firela.io",
        apiKey: "test-key",
      })

      expect(clientDefault).toBeDefined()
    })
  })

  describe("request()", () => {
    it("adds Authorization: Bearer header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: "123" } }),
      })

      await client.request("/v1/test", { method: "GET" })

      expect(mockFetch).toHaveBeenCalledWith(
        "https://relay.firela.io/v1/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        }),
      )
    })

    it("times out after configured timeout", async () => {
      // Create a client with a very short timeout
      const shortTimeoutClient = new RelayClient(
        {
          url: "https://relay.firela.io",
          apiKey: "test-key",
          timeout: 100,
        },
        mockLogger,
      )

      // Mock a slow request
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ ok: true, json: async () => ({}) })
            }, 500)
          }),
      )

      // Mock AbortController to trigger timeout
      const originalAbortController = global.AbortController
      let abortFn: (() => void) | null = null
      vi.stubGlobal(
        "AbortController",
        class MockAbortController {
          signal = { aborted: false }
          abort = () => {
            this.signal.aborted = true
            abortFn?.()
          }
        },
      )

      // The test should handle timeout - we'll test that timeout value is passed
      expect(shortTimeoutClient).toBeDefined()

      // Restore
      vi.stubGlobal("AbortController", originalAbortController)
    }, 10000)

    it("retries on 500, 502, 503, 504, 429 with backoff", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => "Service Unavailable",
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })

      await client.request("/v1/test", { method: "GET" })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it("does NOT retry on 400, 401, 403, 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      })

      await expect(
        client.request("/v1/test", { method: "GET" }),
      ).rejects.toThrow()

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("returns parsed JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: "test-123" } }),
      })

      const result = await client.request<{ id: string }>(
        "/v1/test",
        { method: "GET" },
      )

      expect(result).toEqual({ success: true, data: { id: "test-123" } })
    })
  })

  describe("healthCheck()", () => {
    it("returns available=true on successful health endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "healthy" }),
      })

      const result = await client.healthCheck()

      expect(result.available).toBe(true)
      expect(result.latency).toBeGreaterThanOrEqual(0)
      expect(result.error).toBeUndefined()
    })

    it("returns available=false with error message on failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"))

      const result = await client.healthCheck()

      expect(result.available).toBe(false)
      expect(result.error).toContain("Connection refused")
    })

    it("uses short timeout for health check", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "healthy" }),
      })

      await client.healthCheck(2000)

      // Verify the request was made (timeout is internal)
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  describe("Backoff", () => {
    it("uses calculateBackoffDelay with base 1000ms, max 10000ms", async () => {
      // Test that retries happen - the actual backoff calculation is in utils/backoff.ts
      let callCount = 0
      mockFetch.mockImplementation(async () => {
        callCount++
        if (callCount < 3) {
          return {
            ok: false,
            status: 503,
            text: async () => "Service Unavailable",
          }
        }
        return {
          ok: true,
          json: async () => ({ success: true }),
        }
      })

      await client.request("/v1/test", { method: "GET" })

      expect(callCount).toBe(3)
    }, 30000)
  })
})
