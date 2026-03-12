/**
 * OAuth Flow Hook
 *
 * Custom hook for managing OAuth authentication flows.
 * Handles Plaid Link and Gmail OAuth with Direct mode polling support.
 */
import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import type {
  LinkTokenResponse,
  GmailAuthorizeResponse,
  OAuthExchangeResponse,
} from "@/types/api"

export type OAuthStatus = "idle" | "loading" | "success" | "error"
export type OAuthProvider = "plaid" | "gmail"

interface UseOAuthReturn {
  status: OAuthStatus
  error: string | null
  sessionId: string | null
  startOAuth: () => Promise<string | void>
  handleCallback: (code?: string, state?: string) => Promise<void>
}

/**
 * Hook for managing OAuth authentication flow
 */
export function useOAuth(provider: OAuthProvider): UseOAuthReturn {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<OAuthStatus>("idle")
  const [error, setError] = useState<string | null>(null)

  const sessionId = searchParams.get("session")
  const code = searchParams.get("code")
  const state = searchParams.get("state")

  const startOAuth = useCallback(async () => {
    setStatus("loading")
    setError(null)

    try {
      if (provider === "plaid") {
        // For Plaid, we fetch a link token and use Plaid Link SDK
        const res = await fetch(`/oauth/plaid/link-token${sessionId ? `?session=${sessionId}` : ""}`)
        const data: LinkTokenResponse = await res.json()

        if (!data.success) {
          throw new Error(data.error || "Failed to get link token")
        }

        // Return link token for Plaid Link SDK to handle
        return data.linkToken
      } else {
        // For Gmail, redirect to authorization URL
        const redirectUri = `${window.location.origin}/gmail-callback`
        const res = await fetch(
          `/oauth/gmail/authorize?redirectUri=${encodeURIComponent(redirectUri)}${sessionId ? `&session=${sessionId}` : ""}`
        )
        const data: GmailAuthorizeResponse = await res.json()

        if (!data.success) {
          throw new Error(data.error || "Failed to get authorization URL")
        }

        // Store state for callback verification
        if (data.state) {
          sessionStorage.setItem("gmail_oauth_state", data.state)
        }
        if (sessionId) {
          sessionStorage.setItem("gmail_session_id", sessionId)
        }

        // Redirect to Gmail OAuth
        if (data.authUrl) {
          window.location.href = data.authUrl
        }
      }
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "OAuth failed")
      throw err
    }
  }, [provider, sessionId])

  const handleCallback = useCallback(
    async (callbackCode?: string, callbackState?: string) => {
      setStatus("loading")
      setError(null)

      try {
        // Get session ID from URL or sessionStorage
        const effectiveSessionId =
          sessionId || sessionStorage.getItem("gmail_session_id")

        const requestBody: Record<string, string> = {}

        if (provider === "plaid") {
          requestBody.publicToken = callbackCode || ""
          if (effectiveSessionId) {
            requestBody.sessionId = effectiveSessionId
          }
        } else {
          requestBody.code = callbackCode || ""
          requestBody.state = callbackState || ""
          if (effectiveSessionId) {
            requestBody.sessionId = effectiveSessionId
          }
        }

        const res = await fetch(`/oauth/${provider}/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })

        const data: OAuthExchangeResponse = await res.json()

        if (!data.success) {
          throw new Error(data.error || "Token exchange failed")
        }

        setStatus("success")

        // Clean up session storage
        sessionStorage.removeItem("gmail_oauth_state")
        sessionStorage.removeItem("gmail_session_id")
      } catch (err) {
        setStatus("error")
        setError(err instanceof Error ? err.message : "Token exchange failed")
      }
    },
    [provider, sessionId],
  )

  // Handle OAuth callback on mount if code and state are present
  useEffect(() => {
    if (code && state && status === "idle") {
      handleCallback(code, state)
    }
  }, [code, state, status, handleCallback])

  return {
    status,
    error,
    sessionId,
    startOAuth,
    handleCallback,
  }
}
