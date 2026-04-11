/**
 * Gmail Connect Page
 *
 * Relay-only Gmail connection flow.
 * Directly integrates with firela-relay server using PKCE.
 * No local Gmail OAuth credentials needed.
 */
import { useEffect, useState, useCallback } from "react"
import { Loader2, CheckCircle, XCircle, ArrowLeft } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type PageStatus = "ready" | "loading" | "authorizing" | "success" | "error"

/**
 * Generate PKCE code verifier (random string)
 */
function generateCodeVerifier(length: number = 128): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Generate PKCE code challenge from verifier using SHA-256
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export function GmailConnectPage() {
  const [status, setStatus] = useState<PageStatus>("ready")
  const [error, setError] = useState<string | null>(null)

  // Check if returning from relay callback with credential available
  const searchParams = new URLSearchParams(window.location.search)
  const sessionId = searchParams.get("session")

  useEffect(() => {
    // If session ID is in URL, we're in polling mode after relay redirect
    if (!sessionId) return

    const verifier = sessionStorage.getItem("gmail_pkce_verifier")
    if (!verifier) {
      setStatus("error")
      setError("Session data lost. Please try again.")
      return
    }

    setStatus("authorizing")
    pollForCredential(sessionId, verifier)
  }, [sessionId])

  async function pollForCredential(sid: string, verifier: string) {
    const maxAttempts = 60 // 2 minutes at 2s intervals
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const url = `/api/relay/connect/credentials/${sid}?code_verifier=${encodeURIComponent(verifier)}`
        const res = await fetch(url, { method: "GET" })

        if (res.ok) {
          const data = (await res.json()) as { success: boolean; data?: Record<string, unknown> }
          if (data.success && data.data) {
            setStatus("success")
            sessionStorage.removeItem("gmail_pkce_verifier")
            sessionStorage.removeItem("gmail_session_id")
            return
          }
        }

        if (res.status === 410) {
          setStatus("error")
          setError("Session expired. Please try again.")
          return
        }

        // Not ready yet, wait and retry
        await new Promise((r) => setTimeout(r, 2000))
      } catch {
        // Network error, retry
        await new Promise((r) => setTimeout(r, 2000))
      }
    }

    setStatus("error")
    setError("Authorization timed out. Please try again.")
  }

  async function getRelayUrl(): Promise<string | null> {
    try {
      const res = await fetch("/api/relay/health")
      const data = (await res.json()) as { success: boolean; data?: { relayUrl?: string; available?: boolean } }
      if (data.success && data.data?.relayUrl) {
        return data.data.relayUrl
      }
      setStatus("error")
      setError("Relay server not configured. Set FIRELA_RELAY_URL environment variable.")
      return null
    } catch {
      setStatus("error")
      setError("Failed to reach relay server.")
      return null
    }
  }

  const handleAuthorize = useCallback(async () => {
    setStatus("loading")
    setError(null)

    try {
      const relayUrl = await getRelayUrl()
      if (!relayUrl) return

      // Generate PKCE pair
      const verifier = generateCodeVerifier()
      const challenge = await generateCodeChallenge(verifier)
      sessionStorage.setItem("gmail_pkce_verifier", verifier)

      // Create connect session via UI backend proxy (avoids CORS)
      const returnUrl = `${window.location.origin}/connect/gmail`
      const sessionRes = await fetch("/api/relay/connect/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "gmail",
          code_challenge: challenge,
          code_challenge_method: "S256",
          return_url: returnUrl,
        }),
      })

      if (!sessionRes.ok) {
        throw new Error(`Failed to create session: ${sessionRes.status}`)
      }

      const sessionData = (await sessionRes.json()) as { success: boolean; data?: { session_id?: string } }
      if (!sessionData.success || !sessionData.data?.session_id) {
        throw new Error("Failed to create connect session")
      }

      const sid = sessionData.data!.session_id!
      sessionStorage.setItem("gmail_session_id", sid)

      // Redirect to relay's Gmail authorize page
      window.location.href = `${relayUrl}/connect/gmail?session=${sid}`
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Authorization failed")
    }
  }, [])

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
          {(status === "loading" || status === "authorizing") && (
            <div data-testid="gmail-status" className="flex items-center justify-center gap-2 text-blue-600 bg-blue-50 p-3 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {status === "loading"
                  ? "Preparing authorization..."
                  : "Waiting for authorization..."}
              </span>
            </div>
          )}

          {status === "success" && (
            <>
              <div data-testid="gmail-status" className="flex items-center justify-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span>Gmail connected successfully!</span>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.href = "/connect/"}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Connect
              </Button>
            </>
          )}

          {status === "error" && (
            <div data-testid="gmail-status" className="flex items-center justify-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <XCircle className="w-5 h-5" />
              <span>{error || "An error occurred"}</span>
            </div>
          )}

          {status === "ready" && !sessionId && (
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
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => window.location.href = "/connect/"}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </>
          )}

          <div className="pt-4 text-xs text-muted-foreground">
            Secured via relay with PKCE authentication
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
