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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Toaster position="top-right" />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Service Settings
        </h1>
        <p className="text-muted-foreground text-sm">
          Enable or disable services at runtime
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 text-muted-foreground py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading service settings...</span>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="flex items-center justify-between w-full">
            {error}
            <Button
              variant="ghost"
              size="sm"
              onClick={loadServiceState}
              className="ml-4"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Service toggles */}
      {!loading && serviceState && (
        <div className="space-y-4">
          {(Object.keys(serviceState) as ServiceId[]).map((serviceId) => {
            const config = getServiceConfig(serviceId)
            const isEnabled = serviceState[serviceId]
            const isToggling = toggling === serviceId

            return (
              <Card key={serviceId}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl">
                      {config?.id === "billclaw" ? "💰" : "🤖"}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold">
                        {config?.name || serviceId}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {config?.description || "Service configuration"}
                      </p>
                      <div className="flex items-center gap-2">
                        {isEnabled ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-600">Enabled</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Disabled</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={() => handleToggle(serviceId, isEnabled)}
                      disabled={isToggling}
                    />
                    {isToggling && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Info section */}
      {!loading && serviceState && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About Service Toggles</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>• Disabled services will return 503 (Service Unavailable) for their routes</li>
              <li>• Changes take effect immediately</li>
              <li>• Service state is persisted in KV store</li>
              <li>• Default values can be set via environment variables</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
