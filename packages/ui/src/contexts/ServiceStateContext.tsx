/**
 * Service State Context
 *
 * React Context for sharing service toggle state across the application.
 * Fetches service state from /api/services and provides it to consumers.
 *
 * @packageDocumentation
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { type ServiceState, type ServicesApiResponse } from "@/types/services"

/**
 * Context value type
 */
interface ServiceStateContextValue {
  /** Current service toggle state */
  state: ServiceState | null
  /** Loading state */
  loading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Refresh service state from server */
  refresh: () => Promise<void>
}

const ServiceStateContext = createContext<ServiceStateContextValue | null>(null)

/**
 * Provider component that fetches and provides service state
 */
export function ServiceStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ServiceState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/services")
      const json: ServicesApiResponse = await res.json()
      if (json.success && json.data) {
        setState(json.data)
      } else {
        setError(json.error || "Failed to load service state")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <ServiceStateContext.Provider value={{ state, loading, error, refresh }}>
      {children}
    </ServiceStateContext.Provider>
  )
}

/**
 * Hook to access service state from context
 *
 * @throws Error if used outside ServiceStateProvider
 */
export function useServiceState(): ServiceStateContextValue {
  const context = useContext(ServiceStateContext)
  if (!context) {
    throw new Error("useServiceState must be used within a ServiceStateProvider")
  }
  return context
}
