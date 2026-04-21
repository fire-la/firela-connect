/**
 * Tests for Cloudflare API helpers
 *
 * Tests the cloudflare-api.ts utility functions using
 * mocked global fetch for HTTP calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  cfApiFetch,
  verifyCloudflareAuth,
  getAccountId,
  enumerateResources,
  deleteResources,
} from "../lib/cloudflare-api.js"

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

function cfResponse(success: boolean, result: any, errors?: Array<{ message: string }>) {
  return {
    ok: success,
    status: success ? 200 : 400,
    json: () =>
      Promise.resolve({ success, result, errors }),
  }
}

describe("cfApiFetch", () => {
  it("returns result on successful API call", async () => {
    mockFetch.mockResolvedValueOnce(
      cfResponse(true, [{ id: "acc-123" }]),
    )

    const result = await cfApiFetch("test-token", "/accounts")

    expect(result).toEqual([{ id: "acc-123" }])
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer test-token" },
      }),
    )
  })

  it("throws with error message on API failure", async () => {
    mockFetch.mockResolvedValueOnce(
      cfResponse(false, null, [{ message: "Invalid token" }]),
    )

    await expect(cfApiFetch("bad-token", "/accounts")).rejects.toThrow(
      "Cloudflare API error: Invalid token",
    )
  })

  it("sends body and content-type when provided", async () => {
    mockFetch.mockResolvedValueOnce(cfResponse(true, {}))

    await cfApiFetch(
      "token",
      "/accounts/acc/workers/scripts/my-worker/content",
      "PUT",
      "bundle-content",
      "application/javascript",
    )

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "PUT",
        body: "bundle-content",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/javascript",
        },
      }),
    )
  })
})

describe("verifyCloudflareAuth", () => {
  it("returns true for valid token (200 response)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    const result = await verifyCloudflareAuth("valid-token")
    expect(result).toBe(true)
  })

  it("returns false for invalid token (non-200 response)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })

    const result = await verifyCloudflareAuth("invalid-token")
    expect(result).toBe(false)
  })
})

describe("getAccountId", () => {
  it("returns first account ID", async () => {
    mockFetch.mockResolvedValueOnce(
      cfResponse(true, [{ id: "acc-001" }, { id: "acc-002" }]),
    )

    const result = await getAccountId("token")
    expect(result).toBe("acc-001")
  })

  it("throws when no accounts found", async () => {
    mockFetch.mockResolvedValueOnce(cfResponse(true, []))

    await expect(getAccountId("token")).rejects.toThrow(
      "No Cloudflare accounts found",
    )
  })
})

describe("enumerateResources", () => {
  it("filters to firela/billclaw resources only", async () => {
    // Mock three parallel fetches: workers, databases, kv
    mockFetch
      .mockResolvedValueOnce(
        cfResponse(true, [
          { id: "firela-connect" },
          { id: "other-worker" },
          { id: "billclaw-bot" },
        ]),
      )
      .mockResolvedValueOnce(
        cfResponse(true, [
          { id: "db-1", name: "firela-db" },
          { id: "db-2", name: "unrelated-db" },
          { id: "db-3", name: "billclaw-store" },
        ]),
      )
      .mockResolvedValueOnce(
        cfResponse(true, [
          { id: "kv-1", title: "firela-config" },
          { id: "kv-2", title: "random-cache" },
        ]),
      )

    const result = await enumerateResources("token", "acc-123")

    expect(result.workers).toEqual([
      { id: "firela-connect" },
      { id: "billclaw-bot" },
    ])
    expect(result.databases).toEqual([
      { id: "db-1", name: "firela-db" },
      { id: "db-3", name: "billclaw-store" },
    ])
    expect(result.kvNamespaces).toEqual([{ id: "kv-1", title: "firela-config" }])
  })

  it("returns empty arrays when no matching resources", async () => {
    mockFetch
      .mockResolvedValueOnce(cfResponse(true, [{ id: "other-worker" }]))
      .mockResolvedValueOnce(cfResponse(true, [{ id: "db-1", name: "random-db" }]))
      .mockResolvedValueOnce(cfResponse(true, [{ id: "kv-1", title: "cache" }]))

    const result = await enumerateResources("token", "acc-123")

    expect(result.workers).toEqual([])
    expect(result.databases).toEqual([])
    expect(result.kvNamespaces).toEqual([])
  })
})

describe("deleteResources", () => {
  it("continues after individual failure and reports per-resource status", async () => {
    // First deletion succeeds
    mockFetch.mockResolvedValueOnce(cfResponse(true, null))
    // Second deletion fails
    mockFetch.mockResolvedValueOnce(
      cfResponse(false, null, [{ message: "Not found" }]),
    )
    // Third deletion succeeds
    mockFetch.mockResolvedValueOnce(cfResponse(true, null))

    const result = await deleteResources("token", "acc-123", {
      workers: ["worker-1", "worker-2"],
      databases: ["db-1"],
    })

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({
      resource: "worker-1",
      type: "Worker",
      success: true,
    })
    expect(result[1]).toEqual({
      resource: "worker-2",
      type: "Worker",
      success: false,
      error: "Cloudflare API error: Not found",
    })
    expect(result[2]).toEqual({
      resource: "db-1",
      type: "D1 Database",
      success: true,
    })
  })

  it("handles empty resource lists", async () => {
    const result = await deleteResources("token", "acc-123", {})

    expect(result).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
