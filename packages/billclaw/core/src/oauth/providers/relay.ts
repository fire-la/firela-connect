/**
 * Generic relay OAuth provider
 *
 * Framework-agnostic relay functions for any OAuth provider
 * proxied through firela-relay. The relay holds provider credentials
 * and refresh_tokens. Client only receives short-lived access_tokens.
 *
 * Adding a new relay-based OAuth provider only requires importing from
 * this module with a different provider name.
 *
 * @packageDocumentation
 */

import type { Logger } from "../../runtime/types.js"

/**
 * Create a connect session on relay server
 *
 * @param relayBaseUrl - Relay server base URL (e.g., "https://relay.firela.io")
 * @param provider - Provider name (e.g., "gmail", "discord")
 * @param codeChallenge - PKCE code challenge
 * @param logger - Optional logger
 * @returns Session ID and authorize URL
 */
export async function initiateRelayAuth(
  relayBaseUrl: string,
  provider: string,
  codeChallenge: string,
  logger?: Logger,
): Promise<{ sessionId: string; authorizeUrl: string }> {
  const response = await fetch(`${relayBaseUrl}/api/connect/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to create ${provider} connect session: ${response.status}`)
  }

  const data = (await response.json()) as {
    success: boolean
    data: { session_id: string; provider: string; expires_at: number }
  }
  if (!data.success) {
    throw new Error(`Failed to create ${provider} connect session`)
  }

  const authorizeUrl = `${relayBaseUrl}/connect/${provider}?session=${data.data.session_id}`
  logger?.info?.(`${provider} relay auth initiated`)

  return {
    sessionId: data.data.session_id,
    authorizeUrl,
  }
}

/**
 * Retrieve credential from relay after browser OAuth completes
 *
 * Returns access_token, expiry, and the user identity (e.g., email for Gmail).
 * The identity is critical for subsequent refresh calls -- it is the storage key
 * used by the relay to look up the stored refresh_token.
 *
 * @param relayBaseUrl - Relay server base URL
 * @param provider - Provider name
 * @param sessionId - Connect session ID
 * @param codeVerifier - PKCE code verifier
 * @returns Access token, expiry, and user identity
 */
export async function retrieveRelayCredential(
  relayBaseUrl: string,
  provider: string,
  sessionId: string,
  codeVerifier: string,
): Promise<{ accessToken: string; expiresIn: number; identity: string }> {
  const url = `${relayBaseUrl}/api/connect/credentials/${sessionId}?code_verifier=${codeVerifier}`
  const response = await fetch(url, { method: "GET" })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`${provider} credential not yet available`)
    }
    if (response.status === 410) {
      throw new Error(`${provider} session expired`)
    }
    throw new Error(`Failed to retrieve ${provider} credential: ${response.status}`)
  }

  const data = (await response.json()) as {
    success: boolean
    data: {
      session_id: string
      provider: string
      public_token: string
      metadata: string
    }
  }
  if (!data.success || !data.data) {
    throw new Error(`Failed to retrieve ${provider} credential`)
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
    identity: data.data.metadata, // Relay stores user identity in metadata
  }
}

/**
 * Refresh access token via relay
 *
 * The relay holds the refresh_token and proxies the refresh to the provider.
 * This function works with any registered provider on the relay.
 *
 * @param relayBaseUrl - Relay server base URL
 * @param provider - Provider name
 * @param apiKey - API key with openbanking:{provider} scope
 * @param identity - User identity (e.g., email for Gmail, user ID for Discord)
 * @returns New access token and expiry
 */
export async function refreshTokenViaRelay(
  relayBaseUrl: string,
  provider: string,
  apiKey: string,
  identity: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const response = await fetch(`${relayBaseUrl}/api/connect/${provider}/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ identity }),
  })

  if (!response.ok) {
    if (response.status === 410) {
      throw new Error("AUTH_REVOKED")
    }
    throw new Error(`${provider} token refresh failed: ${response.status}`)
  }

  const data = (await response.json()) as {
    success: boolean
    data: { access_token: string; expires_in: number; token_type: string }
  }
  if (!data.success) {
    throw new Error(`${provider} token refresh failed`)
  }

  return {
    accessToken: data.data.access_token,
    expiresIn: data.data.expires_in,
  }
}
