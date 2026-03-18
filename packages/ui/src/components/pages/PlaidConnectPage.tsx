/**
 * Plaid Connect Page
 *
 * React component for Plaid OAuth flow.
 * Migrated from connect/src/public/index.html
 */
import { useEffect, useState, useCallback } from "react"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import type { LinkTokenResponse, OAuthExchangeResponse } from "@/types/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Type for Plaid Link handler
declare global {
  interface Window {
    Plaid: {
      create: (config: PlaidConfig) => PlaidHandler
    }
  }
}

interface PlaidConfig {
  token: string
  onSuccess: (publicToken: string, metadata: Record<string, unknown>) => void
  onExit: (error: { message: string } | null, metadata: Record<string, unknown>) => void
}

interface PlaidHandler {
  open: () => void
}

type PageStatus = "initializing" | "ready" | "connecting" | "success" | "error"

export function PlaidConnectPage() {
  const [status, setStatus] = useState<PageStatus>("initializing")
  const [error, setError] = useState<string | null>(null)
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [plaidLoaded, setPlaidLoaded] = useState(false)

  // Get session ID from URL for Direct mode polling
  const sessionId = new URLSearchParams(window.location.search).get("session")

  // Fetch link token on mount
  useEffect(() => {
    async function fetchLinkToken() {
      try {
        const url = sessionId
          ? `/oauth/plaid/link-token?session=${sessionId}`
          : "/oauth/plaid/link-token"
        const res = await fetch(url)
        const data: LinkTokenResponse = await res.json()

        if (data.success) {
          setLinkToken(data.linkToken)
          setStatus("ready")
        } else {
          throw new Error(data.error || "Failed to initialize")
        }
      } catch (err) {
        setStatus("error")
        setError(err instanceof Error ? err.message : "Initialization failed")
      }
    }

    fetchLinkToken()
  }, [sessionId])

  // Load Plaid SDK
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js"
    script.onload = () => setPlaidLoaded(true)
    script.onerror = () => {
      setStatus("error")
      setError("Failed to load Plaid SDK")
    }
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  const handleConnect = useCallback(() => {
    if (!linkToken || !plaidLoaded || !window.Plaid) {
      setError("Plaid Link not ready. Please wait...")
      return
    }

    setStatus("connecting")

    const handler = window.Plaid.create({
      token: linkToken,
      onSuccess: async (publicToken: string) => {
        try {
          const requestBody: { publicToken: string; sessionId?: string } = {
            publicToken,
          }
          if (sessionId) {
            requestBody.sessionId = sessionId
          }

          const res = await fetch("/oauth/plaid/exchange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          })

          const data: OAuthExchangeResponse = await res.json()

          if (data.success) {
            setStatus("success")
          } else {
            throw new Error(data.error || "Token exchange failed")
          }
        } catch (err) {
          setStatus("error")
          setError(err instanceof Error ? err.message : "Token exchange failed")
        }
      },
      onExit: (err) => {
        if (err) {
          setStatus("error")
          setError(err.message)
        } else {
          setStatus("ready")
        }
      },
    })

    handler.open()
  }, [linkToken, plaidLoaded, sessionId])

  const handleRetry = useCallback(() => {
    setStatus("initializing")
    setError(null)
    setLinkToken(null)
    // Re-fetch will be triggered by useEffect
    window.location.reload()
  }, [])

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-violet-500 to-purple-600"
    >
      <Card className="w-full max-w-md text-center" data-testid="plaid-connect-page">
        <CardHeader>
          <div className="text-5xl mb-4">🏦</div>
          <CardTitle className="text-2xl">Connect Your Bank</CardTitle>
          <CardDescription>BillClaw Connect - Plaid Integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "initializing" && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground" data-testid="plaid-status">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Initializing...</span>
            </div>
          )}

          {status === "ready" && (
            <>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Securely connect your bank account using Plaid to automatically
                import transactions. Your credentials are encrypted and never
                stored on our servers.
              </p>
              <Button
                data-testid="plaid-connect-btn"
                className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                onClick={handleConnect}
                disabled={!plaidLoaded}
              >
                {plaidLoaded ? "Connect Bank Account" : "Loading..."}
              </Button>
            </>
          )}

          {status === "connecting" && (
            <div data-testid="plaid-status" className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting...</span>
            </div>
          )}

          {status === "success" && (
            <div data-testid="plaid-status" className="flex items-center justify-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span>Bank account connected successfully!</span>
            </div>
          )}

          {status === "error" && (
            <>
              <Alert variant="destructive" data-testid="plaid-status">
                <XCircle className="w-4 h-4" />
                <AlertDescription>{error || "An error occurred"}</AlertDescription>
              </Alert>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleRetry}
              >
                Retry
              </Button>
            </>
          )}

          <div className="pt-4 text-xs text-muted-foreground">
            Powered by Plaid • Bank-level security (256-bit encryption)
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
