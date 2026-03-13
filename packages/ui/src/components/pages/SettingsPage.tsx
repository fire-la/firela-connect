/**
 * Settings Page
 *
 * Service toggle configuration page for BillClaw and Firela-Bot.
 * Users can enable/disable services at runtime.
 */
import { useEffect, useState } from "react"
import { toast, Toaster } from "sonner"
import { Settings, RefreshCw, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { SERVICE_CONFIGS, type ServiceState, type ServiceId, type ServicesApiResponse } from "@/types/services"
import "@/styles/firela-theme.css"

export function SettingsPage() {
  const [serviceState, setServiceState] = useState<ServiceState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<ServiceId | null>(null)

  // Load service state on mount
  useEffect(() => {
    loadServiceState()
  }, [])

  const loadServiceState = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/services")
      const json: ServicesApiResponse = await res.json()
      if (json.success && json.data) {
        setServiceState(json.data)
      } else {
        setError(json.error || "Failed to load service state")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (serviceId: ServiceId, currentValue: boolean) => {
    setToggling(serviceId)
    try {
      const res = await fetch(`/api/services/${serviceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentValue }),
      })
      const json: ServicesApiResponse = await res.json()
      if (json.success && json.data) {
        setServiceState(json.data)
        toast.success(`${serviceId === "billclaw" ? "BillClaw" : "Firela Bot"} ${!currentValue ? "enabled" : "disabled"}`)
      } else {
        toast.error(json.error || "Failed to update service")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error"
      toast.error(message)
    } finally {
      setToggling(null)
    }
  }

  const getServiceConfig = (serviceId: ServiceId) => {
    return SERVICE_CONFIGS.find((c) => c.id === serviceId)
  }

  return (
    <div className="settings-page">
      <Toaster position="top-right" />

      <div className="settings-header">
        <h1 className="text-2xl font-bold text-gray-800">
          <Settings className="w-6 h-6 inline-block mr-2" />
          Service Settings
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Enable or disable services at runtime
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="firela-card">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading service settings...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="status-badge error">
          <AlertCircle className="w-4 h-4 inline mr-2" />
          {error}
          <button
            className="ml-4 text-blue-600 hover:text-blue-800"
            onClick={loadServiceState}
          >
            <RefreshCw className="w-4 h-4 inline" />
            Retry
          </button>
        </div>
      )}

      {/* Service toggles */}
      {!loading && serviceState && (
        <div className="service-list">
          {(Object.keys(serviceState) as ServiceId[]).map((serviceId) => {
            const config = getServiceConfig(serviceId)
            const isEnabled = serviceState[serviceId]
            const isToggling = toggling === serviceId

            return (
              <div key={serviceId} className="service-card">
                <div className="service-info">
                  <div className="service-icon">
                    {config?.id === "billclaw" ? (
                      <span className="text-2xl">💰</span>
                    ) : (
                      <span className="text-2xl">🤖</span>
                    )}
                  </div>
                  <div className="service-details">
                    <h3 className="font-semibold text-gray-800">
                      {config?.name || serviceId}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {config?.description || "Service configuration"}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {isEnabled ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-600">Enabled</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">Disabled</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="service-toggle">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleToggle(serviceId, isEnabled)}
                      disabled={isToggling}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  {isToggling && (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-2" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info section */}
      {!loading && serviceState && (
        <div className="settings-info">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            About Service Toggles
          </h2>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Disabled services will return 503 (Service Unavailable) for their routes</li>
            <li>• Changes take effect immediately</li>
            <li>• Service state is persisted in KV store</li>
            <li>• Default values can be set via environment variables</li>
          </ul>
        </div>
      )}
    </div>
  )
}
