/**
 * Protected Route Component
 *
 * Route guard that blocks access to disabled services.
 * Shows loading spinner while fetching state, or "Service Disabled" message if service is off.
 * Displays a sticky warning banner when JWT auth is required but token is missing or expired.
 *
 * @packageDocumentation
 */
import { type ReactNode, useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { AlertCircle, AlertTriangle, Settings } from "lucide-react"
import { useServiceState } from "@/contexts/ServiceStateContext"
import { type ServiceId } from "@/types/services"
import { Button } from "@/components/ui/button"

interface ProtectedRouteProps {
  /** Service ID to check for enabled state */
  serviceId: ServiceId
  /** Children to render if service is enabled */
  children: ReactNode
}

/**
 * Protected route component that guards access based on service toggle state.
 * Also detects JWT auth expiry and shows a sticky warning banner.
 */
export function ProtectedRoute({ serviceId, children }: ProtectedRouteProps) {
  const { state, loading, error } = useServiceState()

  // Auth expiry detection
  const [authExpired, setAuthExpired] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function checkAuth() {
      try {
        // Step 1: Check if auth is configured at all
        const statusRes = await fetch("/auth/status")
        const statusData = (await statusRes.json()) as {
          configured?: boolean
        }

        // If auth not configured, skip check (no banner needed)
        if (!statusData.configured) {
          if (!cancelled) setAuthChecked(true)
          return
        }

        // Step 2: Probe an API endpoint to detect 401
        const probeRes = await fetch("/api/services", { method: "GET" })

        if (!cancelled) {
          if (probeRes.status === 401) {
            setAuthExpired(true)
          }
          setAuthChecked(true)
        }
      } catch {
        // Network error -- don't show banner (might be offline)
        if (!cancelled) setAuthChecked(true)
      }
    }

    checkAuth()
    return () => {
      cancelled = true
    }
  }, [])

  // Auth warning banner (rendered above everything when auth expired)
  const authBanner =
    authExpired && authChecked ? (
      <div className="sticky top-0 z-50 bg-yellow-500 text-black px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">
            Session expired. Sign in again.
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="bg-transparent border-black/30 hover:bg-black/10 text-black"
          onClick={() => {
            window.location.href = "/auth/setup"
          }}
        >
          Sign In
        </Button>
      </div>
    ) : null

  // Still loading or error/no state — render children (non-blocking)
  if (loading || error || !state) {
    return (
      <>
        {authBanner}
        {children}
      </>
    )
  }

  // Service confirmed disabled — show message with banner above
  if (!state[serviceId]) {
    return (
      <>
        {authBanner}
        <div className="protected-route-disabled">
          <div className="service-disabled-card">
            <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Service Disabled
            </h2>
            <p className="text-gray-600 mb-4">
              {getServiceName(serviceId)} service is currently disabled. Enable
              it in Settings to access this page.
            </p>
            <Link to="/settings" className="service-disabled-link">
              <Settings className="w-4 h-4 inline mr-2" />
              Go to Settings
            </Link>
          </div>
        </div>
      </>
    )
  }

  // Service enabled — render children with banner above
  return (
    <>
      {authBanner}
      {children}
    </>
  )
}

/**
 * Get human-readable service name
 */
function getServiceName(serviceId: ServiceId): string {
  switch (serviceId) {
    case "billclaw":
      return "BillClaw"
    case "firelaBot":
      return "Firela Bot"
    default:
      return serviceId
  }
}
