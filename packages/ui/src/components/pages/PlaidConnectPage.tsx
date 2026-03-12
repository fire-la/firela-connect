/**
 * Plaid Connect Page
 *
 * React component for Plaid OAuth flow.
 * Migrated from connect/src/public/index.html
 */
import { useEffect, useState, useCallback } from "react"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import "@/styles/firela-theme.css"
import type { LinkTokenResponse, OAuthExchangeResponse } from "@/types/api"

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
      className="min-h-screen flex items-center justify-center p-5"
      style={{ background: "var(--firela-gradient-plaid)" }}
    >
      <div className="firela-card" data-testid="plaid-connect-page">
        <div className="text-5xl mb-5">🏦</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Connect Your Bank
        </h1>
        <p className="text-gray-600 text-sm mb-8">
          BillClaw Connect - Plaid Integration
        </p>

        {status === "initializing" && (
          <div className="status-badge loading" data-testid="plaid-status">Initializing...</div>
        )}

        {status === "ready" && (
          <>
            <p className="text-gray-500 leading-relaxed mb-8">
              Securely connect your bank account using Plaid to automatically
              import transactions. Your credentials are encrypted and never
              stored on our servers.
            </p>
            <button
              data-testid="plaid-connect-btn"
              className="btn-firela btn-plaid"
              onClick={handleConnect}
              disabled={!plaidLoaded}
            >
              {plaidLoaded ? "Connect Bank Account" : "Loading..."}
            </button>
          </>
        )}

        {status === "connecting" && (
          <div data-testid="plaid-status" className="status-badge loading flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting...</span>
          </div>
        )}

        {status === "success" && (
          <div data-testid="plaid-status" className="status-badge success flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>Bank account connected successfully!</span>
          </div>
        )}

        {status === "error" && (
          <>
            <div className="status-badge error flex items-center justify-center gap-2">
              <XCircle className="w-5 h-5" />
              <span>{error || "An error occurred"}</span>
            </div>
            <button className="btn-firela btn-plaid mt-4" onClick={handleRetry}>
              Retry
            </button>
          </>
        )}

        <div className="mt-8 text-xs text-gray-400">
          Powered by Plaid • Bank-level security (256-bit encryption)
        </div>
      </div>
    </div>
  )
}
