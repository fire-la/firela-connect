/**
 * Gmail Connect Page
 *
 * React component for Gmail OAuth flow.
 * Migrated from connect/src/public/gmail.html
 */
import { useEffect, useState, useCallback } from "react"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import type { GmailAuthorizeResponse, OAuthExchangeResponse } from "@/types/api"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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
        ? `/api/oauth/gmail/authorize?redirectUri=${encodeURIComponent(redirectUri)}&session=${sessionId}`
        : `/api/oauth/gmail/authorize?redirectUri=${encodeURIComponent(redirectUri)}`

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
      className="min-h-screen flex items-center justify-center p-5 bg-gradient-to-br from-red-500 to-yellow-500 to-green-500"
    >
      <Card className="w-full max-w-md text-center" data-testid="gmail-card">
        <CardHeader>
          <div className="text-5xl mb-4">📧</div>
          <CardTitle className="text-2xl">Connect Gmail</CardTitle>
          <CardDescription>BillClaw Connect - Gmail Integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(status === "authorizing" || status === "exchanging") && (
            <div data-testid="gmail-status" className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {status === "authorizing"
                  ? "Preparing authorization..."
                  : "Exchanging authorization code..."}
              </span>
            </div>
          )}

          {status === "success" && (
            <div data-testid="gmail-status" className="flex items-center justify-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              <span>Gmail connected successfully!</span>
            </div>
          )}

          {status === "error" && (
            <div data-testid="gmail-status" className="flex items-center justify-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <XCircle className="w-5 h-5" />
              <span>{error || "An error occurred"}</span>
            </div>
          )}

          {status === "ready" && !code && !state && (
            <>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Authorize BillClaw to access your Gmail for automatic bill
                extraction. We only read emails with bills and invoices - your
                personal emails remain private.
              </p>
              <Button
                data-testid="gmail-connect-btn"
                className="w-full bg-gradient-to-r from-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-600"
                onClick={handleAuthorize}
              >
                Authorize Gmail
              </Button>
            </>
          )}

          <div className="pt-4 text-xs text-muted-foreground">
            OAuth 2.0 + PKCE for secure authentication
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
