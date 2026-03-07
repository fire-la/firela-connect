/**
 * ConfigStore Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { useConfigStore } from "./configStore"
import type { BillclawConfig, Account } from "@/adapters/types"

// Mock the adapters module
vi.mock("@/adapters", () => ({
  createAdapter: vi.fn(),
}))

import { createAdapter } from "@/adapters"

describe("configStore", () => {
  let mockAdapter: {
    getConfig: ReturnType<typeof vi.fn>
    updateConfig: ReturnType<typeof vi.fn>
    listAccounts: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    // Reset store state
    useConfigStore.setState({
      config: null,
      accounts: [],
      loading: false,
      error: null,
    })

    // Create mock adapter
    mockAdapter = {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      listAccounts: vi.fn(),
    }

    vi.mocked(createAdapter).mockReturnValue(mockAdapter as any)
  })

  describe("initial state", () => {
    it("should have correct initial values", () => {
      const state = useConfigStore.getState()

      expect(state.config).toBeNull()
      expect(state.accounts).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe("loadConfig", () => {
    it("should load config successfully", async () => {
      const mockConfig: BillclawConfig = {
        plaid: { clientId: "test-id", env: "sandbox" },
      }
      mockAdapter.getConfig.mockResolvedValue(mockConfig)

      await useConfigStore.getState().loadConfig()

      const state = useConfigStore.getState()
      expect(state.config).toEqual(mockConfig)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it("should handle load error", async () => {
      mockAdapter.getConfig.mockRejectedValue(new Error("Failed to load"))

      await useConfigStore.getState().loadConfig()

      const state = useConfigStore.getState()
      expect(state.config).toBeNull()
      expect(state.loading).toBe(false)
      expect(state.error).toBe("Failed to load")
    })

    it("should set loading state during load", async () => {
      let resolveConfig: (value: BillclawConfig) => void
      mockAdapter.getConfig.mockImplementation(
        () => new Promise((resolve) => {
          resolveConfig = resolve
        })
      )

      const loadPromise = useConfigStore.getState().loadConfig()

      // Check loading state before promise resolves
      expect(useConfigStore.getState().loading).toBe(true)

      // Resolve and check final state
      resolveConfig!({} as BillclawConfig)
      await loadPromise

      expect(useConfigStore.getState().loading).toBe(false)
    })
  })

  describe("updateConfig", () => {
    it("should update config and reload", async () => {
      const mockConfig: BillclawConfig = {
        plaid: { clientId: "new-id" },
      }
      mockAdapter.updateConfig.mockResolvedValue(undefined)
      mockAdapter.getConfig.mockResolvedValue(mockConfig)

      await useConfigStore.getState().updateConfig({ plaid: { clientId: "new-id" } })

      expect(mockAdapter.updateConfig).toHaveBeenCalledWith({ plaid: { clientId: "new-id" } })
      expect(mockAdapter.getConfig).toHaveBeenCalled()
      expect(useConfigStore.getState().config).toEqual(mockConfig)
    })

    it("should handle update error", async () => {
      mockAdapter.updateConfig.mockRejectedValue(new Error("Update failed"))

      await useConfigStore.getState().updateConfig({})

      const state = useConfigStore.getState()
      expect(state.error).toBe("Update failed")
      expect(state.loading).toBe(false)
    })
  })

  describe("loadAccounts", () => {
    it("should load accounts successfully", async () => {
      const mockAccounts: Account[] = [
        {
          id: "acc-1",
          name: "Test Account",
          type: "plaid",
          enabled: true,
          status: "connected",
        },
      ]
      mockAdapter.listAccounts.mockResolvedValue(mockAccounts)

      await useConfigStore.getState().loadAccounts()

      const state = useConfigStore.getState()
      expect(state.accounts).toEqual(mockAccounts)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it("should handle load accounts error", async () => {
      mockAdapter.listAccounts.mockRejectedValue(new Error("Failed to load accounts"))

      await useConfigStore.getState().loadAccounts()

      const state = useConfigStore.getState()
      expect(state.accounts).toEqual([])
      expect(state.error).toBe("Failed to load accounts")
    })
  })
})
