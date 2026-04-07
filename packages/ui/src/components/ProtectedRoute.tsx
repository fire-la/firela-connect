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
import { AlertCircle, Settings } from "lucide-react"
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

  // Still loading or error/no state — render children (non-blocking)
  if (loading || error || !state) {
    return <>{children}</>
  }

  // Service confirmed disabled — show message
  if (!state[serviceId]) {
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
