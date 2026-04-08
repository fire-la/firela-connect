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
  lastFetched: number | null
  loadHealth: () => Promise<void>
}

const STALE_THRESHOLD = 30_000 // 30 seconds

export const useRelayStore = create<RelayState>((set, get) => ({
  health: null,
  loading: false,
  error: null,
  lastFetched: null,

  loadHealth: async () => {
    const { lastFetched, health } = get()

    // Skip entirely if data is fresh
    if (lastFetched && Date.now() - lastFetched < STALE_THRESHOLD) {
      return
    }

    // Only show loading spinner if no stale data to display
    const hasExistingData = health !== null
    if (!hasExistingData) {
      set({ loading: true, error: null })
    }

    try {
      const adapter = createAdapter()
      const newHealth = await adapter.getRelayHealth()
      set({ health: newHealth, loading: false, error: null, lastFetched: Date.now() })
    } catch (error) {
      set({
        error: hasExistingData ? null : (error instanceof Error ? error.message : "Failed to load relay health"),
        loading: false,
      })
    }
  },
}))
