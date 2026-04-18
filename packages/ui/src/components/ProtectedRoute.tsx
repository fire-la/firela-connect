/**
 * Protected Route Component
 *
 * Route guard that blocks access to disabled services.
 * Shows loading spinner while fetching state, or "Service Disabled" message if service is off.
 * Displays a sticky warning banner when JWT auth is required but token is missing or expired.
 *
 * @packageDocumentation
 */
import { type ReactNode, useEffect } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { AlertCircle, Loader2, Settings } from "lucide-react"
import { useServiceState } from "@/contexts/ServiceStateContext"
import { type ServiceId } from "@/types/services"
import { getToken, apiFetch } from "@/lib/auth"

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
  const { state, loading, error, refresh } = useServiceState()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let cancelled = false

    async function checkAuth() {
      // No token stored — redirect to setup immediately
      if (!getToken()) {
        const redirect = encodeURIComponent(location.pathname + location.search)
        navigate(`/auth/setup?redirect=${redirect}`, { replace: true })
        return
      }

      try {
        // Probe an API endpoint to detect 401 (expired/invalid token)
        const probeRes = await apiFetch("/api/services", { method: "GET" })

        if (!cancelled) {
          if (probeRes.status === 401) {
            const redirect = encodeURIComponent(location.pathname + location.search)
            navigate(`/auth/setup?redirect=${redirect}`, { replace: true })
          } else if (error || !state) {
            // Auth OK but service state is stale (e.g. from pre-login 401) — refresh
            refresh()
          }
        }
      } catch {
        // Network error — allow page to render (might be offline)
      }
    }

    checkAuth()
    return () => {
      cancelled = true
    }
  }, [])

  // Status verification banner (shown when service state cannot be confirmed)
  const statusBanner = loading ? (
    <div className="sticky top-0 z-40 bg-muted/80 backdrop-blur-sm px-4 py-1.5 flex items-center gap-2 border-b">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Verifying service status...</span>
    </div>
  ) : (error || !state) ? (
    <div className="sticky top-0 z-40 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-1.5 flex items-center gap-2">
      <AlertCircle className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
      <span className="text-xs text-yellow-700 dark:text-yellow-300">Unable to verify service status. Showing page without protection.</span>
    </div>
  ) : null

  // Still loading or error/no state — render children (non-blocking)
  if (loading || error || !state) {
    return (
      <>
        {statusBanner}
        {children}
      </>
    )
  }

  // Service confirmed disabled — show message with banner above
  if (!state[serviceId]) {
    return (
      <>
        {statusBanner}
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
      {statusBanner}
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
