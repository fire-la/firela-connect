/**
 * Relay Store
 *
 * Zustand store for relay service health state management.
 */
import { create } from "zustand"
import type { RelayHealthInfo } from "@/types/relay"
import { createAdapter } from "@/adapters"

interface RelayState {
  health: RelayHealthInfo | null
  loading: boolean
  error: string | null
  loadHealth: () => Promise<void>
}

export const useRelayStore = create<RelayState>((set) => ({
  health: null,
  loading: false,
  error: null,

  loadHealth: async () => {
    set({ loading: true, error: null })
    try {
      const adapter = createAdapter()
      const health = await adapter.getRelayHealth()
      set({ health, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load relay health",
        loading: false,
      })
    }
  },
}))
