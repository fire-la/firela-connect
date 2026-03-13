/**
 * Protected Route Component
 *
 * Route guard that blocks access to disabled services.
 * Shows loading spinner while fetching state, or "Service Disabled" message if service is off.
 *
 * @packageDocumentation
 */
import { type ReactNode } from "react"
import { Link } from "react-router-dom"
import { AlertCircle, Settings, Loader2 } from "lucide-react"
import { useServiceState } from "@/contexts/ServiceStateContext"
import { type ServiceId } from "@/types/services"

interface ProtectedRouteProps {
  /** Service ID to check for enabled state */
  serviceId: ServiceId
  /** Children to render if service is enabled */
  children: ReactNode
}

/**
 * Protected route component that guards access based on service toggle state
 */
export function ProtectedRoute({ serviceId, children }: ProtectedRouteProps) {
  const { state, loading, error } = useServiceState()

  // Show loading spinner while fetching service state
  if (loading) {
    return (
      <div className="protected-route-loading">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        <p className="text-gray-500 mt-2">Loading service status...</p>
      </div>
    )
  }

  // If error occurred, show error but allow access (graceful degradation)
  if (error) {
    console.error("Failed to load service state:", error)
    // Allow access on error - don't block the entire app
    return <>{children}</>
  }

  // If no state available, allow access (graceful degradation)
  if (!state) {
    return <>{children}</>
  }

  // Check if service is enabled
  const isEnabled = state[serviceId]

  // If service is disabled, show "Service Disabled" message
  if (!isEnabled) {
    return (
      <div className="protected-route-disabled">
        <div className="service-disabled-card">
          <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Service Disabled
          </h2>
          <p className="text-gray-600 mb-4">
            {getServiceName(serviceId)} service is currently disabled.
            Enable it in Settings to access this page.
          </p>
          <Link to="/settings" className="service-disabled-link">
            <Settings className="w-4 h-4 inline mr-2" />
            Go to Settings
          </Link>
        </div>
      </div>
    )
  }

  // Service is enabled, render children
  return <>{children}</>
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
