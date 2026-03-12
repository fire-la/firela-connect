/**
 * Export Page
 *
 * Export configuration page for export format settings and output path configuration.
 */
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast, Toaster } from "sonner"
import {
  FolderOpen,
  Eye,
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

// Export config type
interface ExportConfig {
  format: "beancount" | "ledger"
  outputPath: string
  filePrefix: string
  includePending: boolean
  currencyColumn: boolean
}

// Sample Beancount transaction
const sampleBeancountTransaction = `2024-03-15 * "Coffee Shop"
  Expenses:Food:Coffee    $4.50
  Liabilities:Assets:Cash
`

// Sample Ledger transaction
const sampleLedgerTransaction = `2024-03-15 * Coffee Shop
  Expenses:Food:Coffee    $4.50
  ; Assets:Cash
`

export function ExportPage() {
  const { config, loading, error, loadConfig } = useConfigStore()
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const [previewFormat, setPreviewFormat] = useState<"beancount" | "ledger">("beancount")

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
  } = useForm<ExportConfig>({
    defaultValues: {
      format: config?.export?.format || "beancount",
      outputPath: config?.export?.outputPath || "~/.firela/billclaw/exports",
      filePrefix: config?.export?.filePrefix || "transactions",
      includePending: config?.export?.includePending || false,
      currencyColumn: config?.export?.currencyColumn || true,
    },
  })

  // Update preview when format changes
  useEffect(() => {
    const subscription = watch((value: Partial<ExportConfig>, { name }: { name?: string }) => {
      if (name === "format" && value.format) {
        setPreviewFormat(value.format as "beancount" | "ledger")
      }
    })
    return () => subscription.unsubscribe()
  }, [watch])

  // Test export configuration
  const handleTest = async () => {
    try {
      setTestResult(null)

      const response = await fetch("/api/export/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: getValues("format"),
          outputPath: getValues("outputPath"),
          filePrefix: getValues("filePrefix"),
        }),
      })

      if (!response.ok) {
        throw new Error(`Test failed: ${response.statusText}`)
      }

      const result: ApiResultResponse = await response.json()
      if (result.success) {
        setTestResult({ success: true, message: result.message || "Configuration valid" })
        toast.success("Export configuration is valid")
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

  // Save export settings
  const handleSave = async (data: ExportConfig) => {
    try {
      const adapter = createAdapter()
      await adapter.updateConfig({ export: data })
      toast.success("Export settings saved successfully")
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
    <div className="export-page">
      <Toaster position="top-right" />

      <div className="connect-header">
        <h1 className="text-2xl font-bold text-gray-800">Export Settings</h1>
        <p className="text-gray-600 text-sm mt-1">
          Configure Beancount or Ledger export format and output location
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

      {/* Export settings form */}
      <form onSubmit={handleSubmit(handleSave)} className="export-form">
        <div className="form-group">
          <label htmlFor="format">Export Format</label>
          <select id="format" {...register("format")} className="form-input">
            <option value="beancount">Beancount</option>
            <option value="ledger">Ledger</option>
          </select>
          {errors.format && (
            <p className="text-red-500 text-sm">{errors.format.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="outputPath">Output Path</label>
          <div className="relative">
            <FolderOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              id="outputPath"
              {...register("outputPath")}
              className="form-input pl-10"
              placeholder="~/.firela/billclaw/exports"
            />
          </div>
          {errors.outputPath && (
            <p className="text-red-500 text-sm">{errors.outputPath.message}</p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="filePrefix">File Prefix</label>
          <input
            type="text"
            id="filePrefix"
            {...register("filePrefix")}
            className="form-input"
            placeholder="transactions"
          />
          {errors.filePrefix && (
            <p className="text-red-500 text-sm">{errors.filePrefix.message}</p>
          )}
        </div>

        <div className="form-group">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              id="includePending"
              {...register("includePending")}
              className="form-checkbox"
            />
            <span>Include pending transactions</span>
          </label>
          {errors.includePending && (
            <p className="text-red-500 text-sm">
 {errors.includePending.message}</p>
          )}
        </div>

        <div className="form-group">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              id="currencyColumn"
              {...register("currencyColumn")}
              className="form-checkbox"
            />
            <span>Add currency column</span>
          </label>
          {errors.currencyColumn && (
            <p className="text-red-500 text-sm">{errors.currencyColumn.message}</p>
          )}
        </div>

        {/* Preview section */}
        <div className="preview-section mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-800">
                Output Preview ({previewFormat})
              </h3>
            </div>
          </div>

          <div className="firela-card">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
              {previewFormat === "beancount"
                ? sampleBeancountTransaction
                : sampleLedgerTransaction}
            </pre>
          </div>
        </div>

        {/* Save and Test buttons */}
        <div className="form-actions">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : null}
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
