/**
 * Sync Page
 *
 * Sync configuration page with per-toggle optimistic UI and API persistence.
 */
import { useEffect, useState } from "react"
import { toast, Toaster } from "sonner"
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  CreditCard,
  Mail,
  Landmark,
  Loader2,
} from "lucide-react"
import { useConfigStore } from "@/stores/configStore"
import { createAdapter } from "@/adapters"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"

export function SyncPage() {
  const { loading, error, loadConfig, accounts, loadAccounts } =
    useConfigStore()
  const [enabledAccounts, setEnabledAccounts] = useState<Set<string>>(new Set())
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Load config and accounts on mount
  useEffect(() => {
    loadConfig()
    loadAccounts()
  }, [loadConfig, loadAccounts])

  // Initialize enabled accounts from config
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      const enabledIds = accounts.filter((a) => a.enabled).map((a) => a.id)
      setEnabledAccounts(new Set(enabledIds))
    }
  }, [accounts])

  // Get status icon for account
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case "disconnected":
        return <XCircle className="w-4 h-4 text-gray-400" />
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />
    }
  }

  // Get type icon for account
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "plaid":
        return <CreditCard className="w-5 h-5" />
      case "gmail":
        return <Mail className="w-5 h-5" />
      case "gocardless":
        return <Landmark className="w-5 h-5" />
      default:
        return null
    }
  }

  // Toggle account enabled status with optimistic UI and API persistence
  const toggleAccount = async (accountId: string) => {
    const wasEnabled = enabledAccounts.has(accountId)
    const account = accounts.find((a) => a.id === accountId)

    // Optimistic update: immediately toggle in UI
    setEnabledAccounts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(accountId)) {
        newSet.delete(accountId)
      } else {
        newSet.add(accountId)
      }
      return newSet
    })

    setTogglingId(accountId)
    try {
      const result = await createAdapter().updateAccount(accountId, !wasEnabled)
      if (result.success) {
        toast.success(
          `${!wasEnabled ? "Enabled" : "Disabled"} sync for ${account?.name ?? accountId}`
        )
      } else {
        // Revert on API-reported failure
        setEnabledAccounts((prev) => {
          const newSet = new Set(prev)
          if (wasEnabled) {
            newSet.add(accountId)
          } else {
            newSet.delete(accountId)
          }
          return newSet
        })
        toast.error(result.error ?? "Failed to update account")
      }
    } catch {
      // Revert on network error
      setEnabledAccounts((prev) => {
        const newSet = new Set(prev)
        if (wasEnabled) {
          newSet.add(accountId)
        } else {
          newSet.delete(accountId)
        }
        return newSet
      })
      toast.error("Failed to update account. Please try again.")
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Toaster position="top-right" />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Sync Settings</h1>
        <p className="text-muted-foreground text-sm">
          Configure sync frequency and select accounts for synchronization
        </p>
      </div>

      {/* Loading state */}
      {loading && accounts.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 text-muted-foreground py-8">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading accounts...</span>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Account list */}
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            Select which accounts to include in synchronization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No accounts found. Connect an account first to enable sync.
            </p>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => {
                const isEnabled = enabledAccounts.has(account.id)
                const isToggling = togglingId === account.id
                return (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-muted-foreground">
                        {getTypeIcon(account.type)}
                      </div>
                      <div>
                        <div className="font-medium">
                          {account.name}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {getStatusIcon(account.status)}
                          <span
                            className={
                              account.status === "connected"
                                ? "text-green-600"
                                : "text-muted-foreground"
                            }
                          >
                            {account.status}
                          </span>
                          {account.lastSync && (
                            <span className="text-xs text-muted-foreground">
                              Last sync:{" "}
                              {new Date(account.lastSync).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isToggling && (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      )}
                      <Checkbox
                        id={`account-${account.id}`}
                        checked={isEnabled}
                        onCheckedChange={() => toggleAccount(account.id)}
                        disabled={isToggling}
                      />
                      <Label
                        htmlFor={`account-${account.id}`}
                        className="text-sm text-muted-foreground cursor-pointer"
                      >
                        Enable sync
                      </Label>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
