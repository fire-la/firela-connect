/**
 * Connect Page
 *
 * Unified account management page for Plaid and Gmail connections.
 * Displays connected accounts and provides connect/disconnect actions.
 */
import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast, Toaster } from "sonner"
import {
  Link,
  Unlink,
  CheckCircle,
  XCircle,
  Loader2,
  CreditCard,
  Mail,
} from "lucide-react"
import { useConfigStore } from "@/stores/configStore"
import { createAdapter } from "@/adapters"
import type { Account } from "@/adapters/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function ConnectPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { accounts, loading, error, loadAccounts } = useConfigStore()
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  // Load accounts on mount
  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  // Handle OAuth callback success
  useEffect(() => {
    const connected = searchParams.get("connected")
    if (connected === "true") {
      toast.success("Account connected successfully!")
      // Refresh account list
      loadAccounts()
      // Clean up URL
      navigate("/connect", { replace: true })
    }
  }, [searchParams, loadAccounts, navigate])

  const handleConnectPlaid = () => {
    navigate("/connect/plaid")
  }

  const handleConnectGmail = () => {
    navigate("/connect/gmail")
  }

  const handleDisconnect = async (accountId: string) => {
    setDisconnecting(accountId)
    try {
      const adapter = createAdapter()
      await adapter.disconnectAccount(accountId)
      toast.success("Account disconnected successfully")
      // Refresh account list
      await loadAccounts()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to disconnect account"
      toast.error(message)
    } finally {
      setDisconnecting(null)
    }
  }

  const getStatusBadgeVariant = (status: Account["status"]): "default" | "secondary" | "destructive" => {
    switch (status) {
      case "connected":
        return "default"
      case "disconnected":
        return "secondary"
      case "error":
        return "destructive"
    }
  }

  const getStatusIcon = (status: Account["status"]) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="w-3 h-3" />
      case "disconnected":
        return <XCircle className="w-3 h-3" />
      case "error":
        return <XCircle className="w-3 h-3" />
    }
  }

  const getTypeIcon = (type: Account["type"]) => {
    switch (type) {
      case "plaid":
        return <CreditCard className="w-5 h-5" />
      case "gmail":
        return <Mail className="w-5 h-5" />
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Toaster position="top-right" />

      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Manage your Plaid and Gmail account connections
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Loading state */}
      {loading && accounts.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 text-muted-foreground py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading accounts...</span>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Account list */}
      {!loading && accounts.length > 0 && (
        <div className="space-y-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                    {getTypeIcon(account.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold">{account.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={getStatusBadgeVariant(account.status)} className="flex items-center gap-1">
                        {getStatusIcon(account.status)}
                        {account.status}
                      </Badge>
                      {account.lastSync && (
                        <span className="text-xs text-muted-foreground">
                          Last sync: {new Date(account.lastSync).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDisconnect(account.id)}
                  disabled={disconnecting === account.id}
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  {disconnecting === account.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlink className="w-4 h-4" />
                  )}
                  <span className="ml-2">Disconnect</span>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && accounts.length === 0 && !error && (
        <Card>
          <CardContent className="text-center text-muted-foreground py-8">
            No accounts connected yet. Connect your first account to get started.
          </CardContent>
        </Card>
      )}

      {/* Connect buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connect New Account</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Button onClick={handleConnectPlaid} className="gap-2">
            <Link className="w-4 h-4" />
            Connect Plaid
          </Button>
          <Button variant="outline" onClick={handleConnectGmail} className="gap-2">
            <Link className="w-4 h-4" />
            Connect Gmail
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
