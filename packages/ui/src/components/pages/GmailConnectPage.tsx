/**
 * Gmail Connect Page
 *
 * React component for Gmail OAuth flow.
 * Migrated from connect/src/public/gmail.html
 */
import { useEffect, useState, useCallback } from "react"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import "@/styles/firela-theme.css"
import type { GmailAuthorizeResponse, OAuthExchangeResponse } from "@/types/api"

type PageStatus = "ready" | "authorizing" | "exchanging" | "success" | "error"

export function GmailConnectPage() {
  const [status, setStatus] = useState<PageStatus>("ready")
  const [error, setError] = useState<string | null>(null)

  // Get session ID from URL for Direct mode polling
  const searchParams = new URLSearchParams(window.location.search)
  const sessionId = searchParams.get("session")
  const code = searchParams.get("code")
  const state = searchParams.get("state")

  // Handle OAuth callback on mount if code and state are present
  useEffect(() => {
    async function handleCallback() {
      if (!code || !state) return

      setStatus("exchanging")

      // Get session ID from URL or sessionStorage
      const effectiveSessionId =
        sessionId || sessionStorage.getItem("gmail_session_id")

      try {
        const requestBody: { code: string; state: string; sessionId?: string } =
          {
            code,
            state,
          }
        if (effectiveSessionId) {
          requestBody.sessionId = effectiveSessionId
        }

        const res = await fetch("/oauth/gmail/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })

        const data: OAuthExchangeResponse = await res.json()

        if (data.success) {
          setStatus("success")
          // Clean up session storage
          sessionStorage.removeItem("gmail_oauth_state")
          sessionStorage.removeItem("gmail_session_id")
        } else {
          throw new Error(data.error || "Token exchange failed")
        }
      } catch (err) {
        setStatus("error")
        setError(err instanceof Error ? err.message : "Token exchange failed")
      }
    }

    handleCallback()
  }, [code, state, sessionId])

  const handleAuthorize = useCallback(async () => {
    setStatus("authorizing")
    setError(null)

    try {
      // Store session ID for persistence across OAuth redirect
      if (sessionId) {
        sessionStorage.setItem("gmail_session_id", sessionId)
      }

      const redirectUri = `${window.location.origin}/gmail-callback`
      const url = sessionId
        ? `/oauth/gmail/authorize?redirectUri=${encodeURIComponent(redirectUri)}&session=${sessionId}`
        : `/oauth/gmail/authorize?redirectUri=${encodeURIComponent(redirectUri)}`

      const res = await fetch(url)
      const data: GmailAuthorizeResponse = await res.json()

      if (data.success && data.authUrl) {
        // Store state for callback verification
        if (data.state) {
          sessionStorage.setItem("gmail_oauth_state", data.state)
        }
        // Redirect to Gmail OAuth page
        window.location.href = data.authUrl
      } else {
        throw new Error(data.error || "Failed to generate authorization URL")
      }
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Authorization failed")
    }
  }, [sessionId])

  return (
    <div
      data-testid="gmail-connect-page"
      className="min-h-screen flex items-center justify-center p-5"
      style={{ background: "var(--firela-gradient-gmail)" }}
    >
      <div className="firela-card" data-testid="gmail-card">
        <div className="text-5xl mb-5">📧</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Connect Gmail</h1>
        <p className="text-gray-600 text-sm mb-8">
          BillClaw Connect - Gmail Integration
        </p>

        {(status === "authorizing" || status === "exchanging") && (
          <div data-testid="gmail-status" className="status-badge loading flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              {status === "authorizing"
                ? "Preparing authorization..."
                : "Exchanging authorization code..."}
            </span>
          </div>
        )}

        {status === "success" && (
          <div data-testid="gmail-status" className="status-badge success flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>Gmail connected successfully!</span>
          </div>
        )}

        {status === "error" && (
          <div data-testid="gmail-status" className="status-badge error flex items-center justify-center gap-2">
            <XCircle className="w-5 h-5" />
            <span>{error || "An error occurred"}</span>
          </div>
        )}

        {status === "ready" && !code && !state && (
          <>
            <p className="text-gray-500 leading-relaxed mb-8">
              Authorize BillClaw to access your Gmail for automatic bill
              extraction. We only read emails with bills and invoices - your
              personal emails remain private.
            </p>
            <button data-testid="gmail-connect-btn" className="btn-firela btn-gmail" onClick={handleAuthorize}>
              Authorize Gmail
            </button>
          </>
        )}

        <div className="mt-8 text-xs text-gray-400">
          OAuth 2.0 + PKCE for secure authentication
        </div>
      </div>
    </div>
  )
}
