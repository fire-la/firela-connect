/**
 * Webhooks Page
 *
 * Webhook configuration page for connection mode, public URL, and verification settings.
 */
import { useEffect, useState } from "react"
import { toast, Toaster } from "sonner"
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Webhook,
  Link,
  Activity,
  Shield,
  Radio,
  Clock,
} from "lucide-react"
import { useConfigStore } from "@/stores/configStore"
import "@/styles/firela-theme.css"
import type { WebhookResultResponse } from "@/types/api"

type ConnectionMode = "auto" | "direct" | "polling"

interface WebhookFormData {
  mode: ConnectionMode
  publicUrl: string
  healthCheckEnabled: boolean
  healthCheckTimeout: number
}

interface TestResult {
  success: boolean
  message: string
}

// Connection mode descriptions
const MODE_DESCRIPTIONS: Record<ConnectionMode, { title: string; description: string; icon: React.ReactNode }> = {
  auto: {
    title: "Auto",
    description: "Automatically select best available mode (Direct > Polling)",
    icon: <Radio className="w-5 h-5" />,
  },
  direct: {
    title: "Direct",
    description: "Receive webhooks directly. Best performance, requires public URL",
    icon: <Link className="w-5 h-5" />,
  },
  polling: {
    title: "Polling",
    description: "Periodically check for updates. Fallback when webhooks unavailable",
    icon: <Clock className="w-5 h-5" />,
  },
}

export function WebhooksPage() {
  const { config, loading, error, loadConfig, updateConfig } = useConfigStore()
  const [formData, setFormData] = useState<WebhookFormData>({
    mode: "auto",
    publicUrl: "",
    healthCheckEnabled: true,
    healthCheckTimeout: 5000,
  })
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  // Load config on mount
  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // Initialize form data from config
  useEffect(() => {
    if (config?.connect) {
      setFormData({
        mode: config.connect.connection?.mode || "auto",
        publicUrl: config.connect.publicUrl || "",
        healthCheckEnabled: config.connect.connection?.healthCheck?.enabled ?? true,
        healthCheckTimeout: config.connect.connection?.healthCheck?.timeout || 5000,
      })
    }
  }, [config])

  // Update form field
  const updateField = <K extends keyof WebhookFormData>(
    field: K,
    value: WebhookFormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setTestResult(null)
  }

  // Test webhook configuration
  const handleTest = async () => {
    try {
      setTesting(true)
      setTestResult(null)

      const response = await fetch("/api/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const result: WebhookResultResponse = await response.json()

      if (result.success) {
        toast.success(result.message || "Test successful")
        setTestResult({ success: true, message: result.message || "Test successful" })
      } else {
        toast.error(result.error || "Test failed")
        setTestResult({ success: false, message: result.error || "Test failed" })
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to test configuration"
      toast.error(message)
      setTestResult({ success: false, message })
    } finally {
      setTesting(false)
    }
  }

  // Save webhook settings
  const handleSave = async () => {
    try {
      setSaving(true)

      // Build connect config update
      const connectUpdate = {
        publicUrl: formData.mode === "direct" ? formData.publicUrl : undefined,
        connection: {
          mode: formData.mode,
          healthCheck: {
            enabled: formData.healthCheckEnabled,
            timeout: formData.healthCheckTimeout,
          },
        },
      }

      await updateConfig({ connect: connectUpdate })
      toast.success("Webhook settings saved successfully")
      setTestResult({ success: true, message: "Settings saved" })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save settings"
      toast.error(message)
      setTestResult({ success: false, message })
    } finally {
      setSaving(false)
    }
  }

  // Check if public URL is required
  const requiresPublicUrl = formData.mode === "direct"

  return (
    <div className="webhooks-page">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="connect-header">
        <div className="flex items-center gap-3">
          <Webhook className="w-6 h-6 text-gray-700" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Webhook Settings</h1>
            <p className="text-gray-600 text-sm mt-1">
              Configure how BillClaw receives webhooks from external services
            </p>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && !config && (
        <div className="firela-card">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading configuration...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="status-badge error">
          <AlertCircle className="w-4 h-4 inline mr-2" />
          {error}
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div
          className={`status-badge ${
            testResult.success ? "success" : "error"
          }`}
        >
          {testResult.success ? (
            <CheckCircle className="w-4 h-4 inline mr-1 text-green-600" />
          ) : (
            <XCircle className="w-4 h-4 inline mr-1 text-red-600" />
          )}
          <span className="text-sm">{testResult.message}</span>
        </div>
      )}

      {/* Connection mode section */}
      <div className="firela-card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Connection Mode
        </h3>

        <div className="space-y-3">
          {(Object.keys(MODE_DESCRIPTIONS) as ConnectionMode[]).map((mode) => (
            <label
              key={mode}
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                formData.mode === mode
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="connectionMode"
                value={mode}
                checked={formData.mode === mode}
                onChange={() => updateField("mode", mode)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">
                    {MODE_DESCRIPTIONS[mode].icon}
                  </span>
                  <span className="font-medium text-gray-800">
                    {MODE_DESCRIPTIONS[mode].title}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {MODE_DESCRIPTIONS[mode].description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Public URL section (for direct mode) */}
      {requiresPublicUrl && (
        <div className="firela-card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Link className="w-5 h-5" />
            Public URL
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Required for Direct mode. Enter the public URL where your Connect
            service is accessible.
          </p>
          <div className="form-group">
            <label htmlFor="publicUrl">Public URL</label>
            <input
              type="url"
              id="publicUrl"
              value={formData.publicUrl}
              onChange={(e) => updateField("publicUrl", e.target.value)}
              className="form-input"
              placeholder="https://billclaw.yourdomain.com"
              required={requiresPublicUrl}
            />
            <p className="text-xs text-gray-500 mt-1">
              Example: https://billclaw-worker.your-subdomain.workers.dev
            </p>
          </div>
        </div>
      )}

      {/* Health check section */}
      <div className="firela-card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Health Check
        </h3>

        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id="healthCheckEnabled"
              checked={formData.healthCheckEnabled}
              onChange={(e) => updateField("healthCheckEnabled", e.target.checked)}
              className="form-checkbox"
            />
            <span className="text-sm text-gray-700">
              Enable health checks for connection mode
            </span>
          </label>

          {formData.healthCheckEnabled && (
            <div className="form-group">
              <label htmlFor="healthCheckTimeout">Timeout (ms)</label>
              <input
                type="number"
                id="healthCheckTimeout"
                value={formData.healthCheckTimeout}
                onChange={(e) =>
                  updateField("healthCheckTimeout", parseInt(e.target.value) || 5000)
                }
                className="form-input"
                min="1000"
                max="30000"
                step="1000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum time to wait for health check response (1000-30000 ms)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Save and Test buttons */}
      <div className="form-actions">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || (requiresPublicUrl && !formData.publicUrl)}
          className="btn-primary"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
          Save Settings
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={testing || loading || (requiresPublicUrl && !formData.publicUrl)}
          className="btn-secondary"
        >
          {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
          Test Configuration
        </button>
      </div>
    </div>
  )
}
