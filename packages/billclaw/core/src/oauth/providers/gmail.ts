/**
 * Gmail OAuth provider - relay-only implementation
 *
 * All Gmail OAuth operations are proxied through the firela-relay server.
 * The relay holds Google OAuth credentials and refresh_tokens.
 * This client only receives short-lived access_tokens.
 *
 * The client no longer needs GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET.
 *
 * @packageDocumentation
 */

import type { Logger } from "../../runtime/types.js"

/**
 * Relay Connect API response types
 */
interface RelaySessionResponse {
  success: boolean
  data: {
    session_id: string
    provider: string
    expires_at: number
  }
}

interface RelayCredentialResponse {
  success: boolean
  data: {
    session_id: string
    provider: string
    public_token: string
    metadata: string
  }
}

interface RelayRefreshResponse {
  success: boolean
  data: {
    access_token: string
    expires_in: number
    token_type: string
  }
}

/**
 * Connect Gmail via relay server
 *
 * Flow:
 * 1. Create connect session on relay
 * 2. Return authorize URL for browser redirect
 * 3. Caller opens browser and polls for credential
 *
 * @param relayBaseUrl - Relay server base URL (e.g., "https://relay.firela.io")
 * @param codeChallenge - PKCE code challenge
 * @param logger - Optional logger
 * @returns Session ID and authorize URL
 */
export async function initiateGmailRelayAuth(
  relayBaseUrl: string,
  codeChallenge: string,
  logger?: Logger,
): Promise<{ sessionId: string; authorizeUrl: string }> {
  const response = await fetch(`${relayBaseUrl}/api/connect/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "gmail",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to create Gmail connect session: ${response.status}`)
  }

  const data = (await response.json()) as RelaySessionResponse
  if (!data.success) {
    throw new Error("Failed to create Gmail connect session")
  }

  const authorizeUrl = `${relayBaseUrl}/connect/gmail?session=${data.data.session_id}`
  logger?.info?.("Gmail relay auth initiated")

  return {
    sessionId: data.data.session_id,
    authorizeUrl,
  }
}

/**
 * Retrieve Gmail credential from relay (called after browser OAuth completes)
 *
 * Returns access_token, expiry, and the Gmail email address.
 * The email is critical for subsequent refresh calls -- it is the storage key
 * used by the relay to look up the stored refresh_token.
 *
 * @param relayBaseUrl - Relay server base URL
 * @param sessionId - Connect session ID
 * @param codeVerifier - PKCE code verifier
 * @returns Access token, expiry, and email address (no refresh_token)
 */
export async function retrieveGmailRelayCredential(
  relayBaseUrl: string,
  sessionId: string,
  codeVerifier: string,
): Promise<{ accessToken: string; expiresIn: number; email: string }> {
  const url = `${relayBaseUrl}/api/connect/credentials/${sessionId}?code_verifier=${codeVerifier}`
  const response = await fetch(url, { method: "GET" })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Gmail credential not yet available")
    }
    if (response.status === 410) {
      throw new Error("Gmail session expired")
    }
    throw new Error(`Failed to retrieve Gmail credential: ${response.status}`)
  }

  const data = (await response.json()) as RelayCredentialResponse
  if (!data.success || !data.data) {
    throw new Error("Failed to retrieve Gmail credential")
  }

  // Parse the access_token from public_token (JSON string)
  let tokenData: { access_token: string; expires_in: number }
  try {
    tokenData = JSON.parse(data.data.public_token) as {
      access_token: string
      expires_in: number
    }
  } catch {
    throw new Error(
      `Invalid credential format from relay: expected JSON string in public_token, got: ${typeof data.data.public_token}`,
    )
  }

  return {
    accessToken: tokenData.access_token,
    expiresIn: tokenData.expires_in,
    email: data.data.metadata, // Relay stores Gmail email in metadata
  }
}

/**
 * Refresh Gmail access token via relay
 *
 * The relay holds the refresh_token and proxies the refresh to Google.
 * This function only works with an API key that has openbanking:gmail scope.
 *
 * @param relayBaseUrl - Relay server base URL
 * @param apiKey - API key with openbanking:gmail scope
 * @param email - Gmail email address (used as storage key on relay)
 * @returns New access token and expiry
 */
export async function refreshGmailTokenViaRelay(
  relayBaseUrl: string,
  apiKey: string,
  email: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch(`${relayBaseUrl}/api/connect/gmail/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    if (response.status === 410) {
      throw new Error("GMAIL_AUTH_REVOKED")
    }
    throw new Error(`Gmail token refresh failed: ${response.status}`)
  }

  const data = (await response.json()) as RelayRefreshResponse
  if (!data.success) {
    throw new Error("Gmail token refresh failed")
  }

  return {
    accessToken: data.data.access_token,
    expiresIn: data.data.expires_in,
  }
}

// ─── Direct OAuth (for UI/Workers that hold Google credentials) ────────────────

import type {
  GmailOAuthConfig as DirectConfig,
  GmailAuthUrlResult,
  GmailTokenResult,
  GmailOAuthResult,
} from "../types.js"
import { generatePKCEPair } from "../pkce.js"

/**
 * State parameter storage (in-memory for security)
 */
const oauthStateStore = new Map<
  string,
  { codeVerifier: string; timestamp: number }
>()

function cleanupExpiredStates(): void {
  const now = Date.now()
  const maxAge = 10 * 60 * 1000
  for (const [key, value] of oauthStateStore.entries()) {
    if (now - value.timestamp > maxAge) {
      oauthStateStore.delete(key)
    }
  }
}

async function generateAuthorizationUrl(
  config: DirectConfig,
  redirectUri = "http://localhost:3000/callback",
  logger?: Logger,
): Promise<GmailAuthUrlResult> {
  cleanupExpiredStates()

  const pkcePair = await generatePKCEPair("S256", 128)
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  oauthStateStore.set(state, { codeVerifier: pkcePair.codeVerifier, timestamp: Date.now() })

  const params = new URLSearchParams()
  params.set("client_id", config.clientId)
  params.set("redirect_uri", redirectUri)
  params.set("response_type", "code")
  params.set("scope", "https://www.googleapis.com/auth/gmail.readonly")
  params.set("state", state)
  params.set("code_challenge", pkcePair.codeChallenge)
  params.set("code_challenge_method", "S256")
  params.set("access_type", "offline")
  params.set("prompt", "consent")

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  logger?.info?.("Gmail authorization URL generated")
  return { url, state }
}

async function exchangeCodeForToken(
  config: DirectConfig,
  code: string,
  state: string,
  redirectUri = "http://localhost:3000/callback",
  logger?: Logger,
): Promise<GmailTokenResult> {
  const storedState = oauthStateStore.get(state)
  if (!storedState) {
    throw new Error("Invalid or expired OAuth state. Please try again.")
  }
  oauthStateStore.delete(state)

  const params = new URLSearchParams()
  params.set("code", code)
  params.set("client_id", config.clientId)
  if (config.clientSecret) params.set("client_secret", config.clientSecret)
  params.set("redirect_uri", redirectUri)
  params.set("grant_type", "authorization_code")
  params.set("code_verifier", storedState.codeVerifier)

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to exchange token: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  logger?.info?.("Gmail access token obtained successfully")
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in }
}

/**
 * Handle direct Gmail OAuth flow (for UI/Workers with Google credentials)
 *
 * Phase 1 (no code): returns { url, state } for browser redirect
 * Phase 2 (code + state): exchanges code for tokens
 */
export async function gmailOAuthHandler(
  config: DirectConfig,
  context?: { code?: string; state?: string; redirectUri?: string },
  logger?: Logger,
): Promise<GmailOAuthResult> {
  try {
    const { code, state, redirectUri } = context || {}

    if (!code) {
      const { url: authUrl, state: newState } = await generateAuthorizationUrl(config, redirectUri, logger)
      return { url: authUrl, state: newState }
    }

    if (!state) throw new Error("State parameter is required for code exchange")

    const { accessToken, refreshToken, expiresIn } = await exchangeCodeForToken(config, code, state, redirectUri, logger)
    return { url: "", accessToken, refreshToken, expiresIn }
  } catch (error) {
    logger?.error?.("Gmail OAuth error:", error)
    throw error
  }
}

/**
 * Refresh Gmail token directly with Google (for UI/Workers)
 */
export async function refreshGmailToken(
  config: DirectConfig,
  refreshToken: string,
  logger?: Logger,
): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret || "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gmail token refresh failed: ${response.status} ${errorText}`)
    }

    const data = (await response.json()) as { access_token: string; expires_in: number }
    logger?.info?.("Gmail token refreshed successfully")
    return { accessToken: data.access_token, expiresIn: data.expires_in }
  } catch (error) {
    logger?.error?.("Gmail token refresh error:", error)
    return null
  }
}

// Re-export types for backward compatibility
export type { GmailOAuthConfig, GmailAuthUrlResult, GmailTokenResult, GmailOAuthResult } from "../types.js"
