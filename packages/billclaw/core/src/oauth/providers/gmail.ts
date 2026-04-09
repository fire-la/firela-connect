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
  const tokenData = JSON.parse(data.data.public_token) as {
    access_token: string
    expires_in: number
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

// Re-export types for backward compatibility (type-only exports, no runtime impact)
export type { GmailOAuthConfig, GmailAuthUrlResult, GmailTokenResult, GmailOAuthResult } from "../types.js"
