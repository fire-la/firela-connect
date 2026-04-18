/**
 * BrowserAdapter Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BrowserAdapter } from "./browser"
import type { BillclawConfig, Account } from "./types"

// Mock auth module so apiFetch passes through to global fetch
vi.mock("../lib/auth", () => ({
  apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
  getToken: () => null,
  setToken: () => {},
  clearToken: () => {},
}))

describe("BrowserAdapter", () => {
  let adapter: BrowserAdapter
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    adapter = new BrowserAdapter()
    fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("getConfig", () => {
    it("should fetch and return config", async () => {
      const mockConfig: BillclawConfig = {
        plaid: { clientId: "test-id", env: "sandbox" },
      }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockConfig }),
      })

      const result = await adapter.getConfig()

      expect(fetchMock).toHaveBeenCalledWith("/api/config")
      expect(result).toEqual(mockConfig)
    })

    it("should throw error when fetch fails", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"))

      await expect(adapter.getConfig()).rejects.toThrow("Network error")
    })
  })

  describe("updateConfig", () => {
    it("should send PUT request with config updates", async () => {
      const updates: Partial<BillclawConfig> = {
        plaid: { clientId: "new-id" },
      }
      fetchMock.mockResolvedValueOnce({ ok: true })

      await adapter.updateConfig(updates)

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/config",
        expect.objectContaining({
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
      )
    })

    it("should throw error with message when update fails", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Invalid config" }),
      })

      await expect(adapter.updateConfig({})).rejects.toThrow("Invalid config")
    })

    it("should throw generic error when update fails without message", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      })

      await expect(adapter.updateConfig({})).rejects.toThrow("Failed to update config")
    })
  })

  describe("listAccounts", () => {
    it("should fetch and return accounts", async () => {
      const mockAccounts: Account[] = [
        { id: "acc-1", name: "Test Account", type: "plaid", enabled: true, status: "connected" },
      ]
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockAccounts }),
      })

      const result = await adapter.listAccounts()

      expect(fetchMock).toHaveBeenCalledWith("/api/accounts")
      expect(result).toEqual(mockAccounts)
    })
  })

  describe("connectAccount", () => {
    it("should initiate connection and return URL", async () => {
      const mockUrl = "https://oauth.example.com/authorize"
      fetchMock.mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true, data: { url: mockUrl } }),
      })

      const result = await adapter.connectAccount("plaid")

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/connect/plaid",
        expect.objectContaining({ method: "POST" })
      )
      expect(result).toEqual({ url: mockUrl })
    })
  })

  describe("disconnectAccount", () => {
    it("should send DELETE request for account", async () => {
      fetchMock.mockResolvedValueOnce({ ok: true })

      await adapter.disconnectAccount("acc-1")

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/accounts/acc-1",
        expect.objectContaining({ method: "DELETE" })
      )
    })

    it("should throw error when disconnect fails", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Account not found" }),
      })

      await expect(adapter.disconnectAccount("acc-1")).rejects.toThrow("Account not found")
    })
  })

  describe("syncAccount", () => {
    it("should trigger sync and return result", async () => {
      const mockResult = { success: true, transactionsAdded: 10 }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockResult }),
      })

      const result = await adapter.syncAccount("acc-1")

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sync/acc-1",
        expect.objectContaining({ method: "POST" })
      )
      expect(result).toEqual(mockResult)
    })
  })

  describe("getSyncStatus", () => {
    it("should fetch sync status", async () => {
      const mockStatus = {
        lastSync: "2024-01-01T00:00:00Z",
        status: "idle",
        accounts: [],
      }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockStatus }),
      })

      const result = await adapter.getSyncStatus()

      expect(fetchMock).toHaveBeenCalledWith("/api/sync/status")
      expect(result).toEqual(mockStatus)
    })
  })

  describe("getSystemStatus", () => {
    it("should fetch system status", async () => {
      const mockStatus = {
        version: "1.0.0",
        platform: "darwin",
        configPath: "/home/user/.billclaw",
      }
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockStatus }),
      })

      const result = await adapter.getSystemStatus()

      expect(fetchMock).toHaveBeenCalledWith("/api/system/status")
      expect(result).toEqual(mockStatus)
    })
  })
})
