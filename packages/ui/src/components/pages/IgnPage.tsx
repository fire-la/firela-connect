/**
 * IGN Page
 *
 * IGN configuration page for IGN Beancount SaaS integration settings.
 */
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast, Toaster } from "sonner"
import { z } from "zod"
import {
  Globe,
  Key,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Play,
} from "lucide-react"
import { useConfigStore } from "@/stores/configStore"
import { createAdapter } from "@/adapters"
import "@/styles/firela-theme.css"
import type { ApiResultResponse } from "@/types/api"

// Form schema for IGN settings
const IgnSettingsSchema = z.object({
  apiUrl: z.string().url().default("https://ign-dev.firela.io/api/v1"),
  accessToken: z.string().optional(),
  region: z.enum(["cn", "us", "eu-core", "de"]).default("us"),
  uploadMode: z.enum(["disabled", "auto", "manual"]).default("disabled"),
  sourceAccount: z.string().optional(),
  defaultCurrency: z.string().default("USD"),
  defaultExpenseAccount: z.string().default("Expenses:Unknown"),
  defaultIncomeAccount: z.string().default("Income:Unknown"),
  filterPending: z.boolean().default(true),
})

type IgnSettings = z.infer<typeof IgnSettingsSchema>

export function IgnPage() {
  const { config, loading, error, loadConfig, accounts } = useConfigStore()
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // Load config on mount
  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // Initialize form with current config values
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    getValues,
  } = useForm<IgnSettings>({
    defaultValues: {
      apiUrl: config?.ign?.apiUrl || "https://ign-dev.firela.io/api/v1",
      accessToken: config?.ign?.accessToken || "",
      region: config?.ign?.region || "us",
      uploadMode: config?.ign?.upload?.mode || "disabled",
      sourceAccount: config?.ign?.upload?.sourceAccount || "",
      defaultCurrency: config?.ign?.upload?.defaultCurrency || "USD",
      defaultExpenseAccount: config?.ign?.upload?.defaultExpenseAccount || "Expenses:Unknown",
      defaultIncomeAccount: config?.ign?.upload?.defaultIncomeAccount || "Income:Unknown",
      filterPending: config?.ign?.upload?.filterPending ?? true,
    },
  })

  // Test IGN configuration
  const handleTest = async () => {
    try {
      setTestResult(null)

      const response = await fetch("/api/ign/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: getValues("apiUrl"),
          accessToken: getValues("accessToken"),
          region: getValues("region"),
        }),
      })

      if (!response.ok) {
        throw new Error(`Test failed: ${response.statusText}`)
      }

      const result: ApiResultResponse = await response.json()
      if (result.success) {
        setTestResult({ success: true, message: result.message || "Configuration valid" })
        toast.success("IGN configuration is valid")
      } else {
        setTestResult({
          success: false,
          message: result.error || "Validation failed",
        })
        toast.error(result.error || "Validation failed")
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to test configuration"
      toast.error(message)
      setTestResult({ success: false, message })
    }
  }

  // Save IGN settings
  const handleSave = async (data: IgnSettings) => {
    try {
      const adapter = createAdapter()

      // Transform form data to config structure
      const ignConfig = {
        apiUrl: data.apiUrl,
        accessToken: data.accessToken || undefined,
        region: data.region,
        upload: data.uploadMode !== "disabled" ? {
          mode: data.uploadMode as "auto" | "manual",
          sourceAccount: data.sourceAccount || "",
          defaultCurrency: data.defaultCurrency,
          defaultExpenseAccount: data.defaultExpenseAccount,
          defaultIncomeAccount: data.defaultIncomeAccount,
          filterPending: data.filterPending,
        } : undefined,
      }

      await adapter.updateConfig({ ign: ignConfig })
      toast.success("IGN settings saved successfully")
      await loadConfig()
      setTestResult({ success: true, message: "Settings saved" })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save settings"
      toast.error(message)
      setTestResult({ success: false, message })
    }
  }

  return (
    <div className="ign-page">
      <Toaster position="top-right" />

      <div className="connect-header">
        <h1 className="text-2xl font-bold text-gray-800">IGN Integration</h1>
        <p className="text-gray-600 text-sm mt-1">
          Configure IGN Beancount SaaS upload settings
        </p>
      </div>

      {/* Loading state */}
      {loading && !testResult && (
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

      {/* IGN settings form */}
      <form onSubmit={handleSubmit(handleSave)} className="ign-form">
        <div className="form-group">
          <label htmlFor="apiUrl">API URL</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="url"
              id="apiUrl"
              {...register("apiUrl")}
              className="form-input pl-10"
              placeholder="https://ign-dev.firela.io/api/v1"
            />
          </div>
          {errors.apiUrl && (
            <p className="text-red-500 text-sm">{errors.apiUrl.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="accessToken">Access Token</label>
          <div className="relative">
            <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              id="accessToken"
              {...register("accessToken")}
              className="form-input pl-10"
              placeholder="Enter your access token"
            />
          </div>
          {errors.accessToken && (
            <p className="text-red-500 text-sm">{errors.accessToken.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="region">Region</label>
          <select id="region" {...register("region")} className="form-input">
            <option value="cn">China</option>
            <option value="us">United States</option>
            <option value="eu-core">EU Core</option>
            <option value="de">Germany</option>
          </select>
          {errors.region && (
            <p className="text-red-500 text-sm">{errors.region.message}</p>
          )}
        </div>

        <div className="form-group">
          <h3 className="text-lg font-semibold text-gray-800">Upload Settings</h3>

          <div className="form-group">
            <label htmlFor="uploadMode">Upload Mode</label>
            <select
              id="uploadMode"
              {...register("uploadMode")}
              className="form-input"
            >
              <option value="disabled">Disabled</option>
              <option value="auto">Automatic</option>
              <option value="manual">Manual</option>
            </select>
            {errors.uploadMode && (
              <p className="text-red-500 text-sm">{errors.uploadMode.message}</p>
            )}
          </div>

          {watch("uploadMode") !== "disabled" && (
            <>
              <div className="form-group">
                <label htmlFor="sourceAccount">Source Account</label>
                <select
                  id="sourceAccount"
                  {...register("sourceAccount")}
                  className="form-input"
                >
                  <option value="">Select an account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                {errors.sourceAccount && (
                  <p className="text-red-500 text-sm">{errors.sourceAccount.message}</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="defaultCurrency">Default Currency</label>
                <input
                  type="text"
                  id="defaultCurrency"
                  {...register("defaultCurrency")}
                  className="form-input"
                  placeholder="USD"
                />
                {errors.defaultCurrency && (
                  <p className="text-red-500 text-sm">{errors.defaultCurrency.message}</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="defaultExpenseAccount">Default Expense Account</label>
                <input
                  type="text"
                  id="defaultExpenseAccount"
                  {...register("defaultExpenseAccount")}
                  className="form-input"
                  placeholder="Expenses:Unknown"
                />
                {errors.defaultExpenseAccount && (
                  <p className="text-red-500 text-sm">{errors.defaultExpenseAccount.message}</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="defaultIncomeAccount">Default Income Account</label>
                <input
                  type="text"
                  id="defaultIncomeAccount"
                  {...register("defaultIncomeAccount")}
                  className="form-input"
                  placeholder="Income:Unknown"
                />
                {errors.defaultIncomeAccount && (
                  <p className="text-red-500 text-sm">{errors.defaultIncomeAccount.message}</p>
                )}
              </div>

              <div className="form-group">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="filterPending"
                    {...register("filterPending")}
                    className="form-checkbox"
                  />
                  <span>Filter pending transactions</span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Save and Test buttons */}
        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            Save Settings
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={loading}
            className="btn-secondary"
          >
            <Play className="w-4 h-4" />
            Test Configuration
          </button>
        </div>
      </form>
    </div>
  )
}
