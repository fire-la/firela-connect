/**
 * Gmail OAuth provider - framework-agnostic implementation
 *
 * This module handles Gmail OAuth 2.0 authorization using PKCE (Proof Key for Code Exchange).
 *
 * Flow:
 * 1. Generate authorization URL (with PKCE) - Returns { url, state }
 * 2. Handle callback - Receives authorization code
 * 3. Exchange code for access token - Returns { accessToken, refreshToken }
 *
 * @packageDocumentation
 */

import type {
  Logger,
} from "../../runtime/types.js"
import type {
  GmailOAuthConfig,
  GmailAuthUrlResult,
  GmailTokenResult,
  GmailOAuthResult,
} from "../types.js"
import {
  generatePKCEPair,
} from "../pkce.js"

/**
 * State parameter storage (in-memory for security)
 * In production, this should be stored in a secure session
 */
const oauthStateStore = new Map<
  string,
  { codeVerifier: string; timestamp: number }
>()

/**
 * Clean up expired states (older than 10 minutes)
 */
export function cleanupExpiredStates(): void {
  const now = Date.now()
  const maxAge = 10 * 60 * 1000 // 10 minutes
  for (const [key, value] of oauthStateStore.entries()) {
    if (now - value.timestamp > maxAge) {
      oauthStateStore.delete(key)
    }
  }
}

/**
 * Generate Gmail OAuth authorization URL
 *
 * Uses PKCE for security without requiring client secret.
 */
export async function generateAuthorizationUrl(
  config: GmailOAuthConfig,
  redirectUri: string = "http://localhost:3000/callback",
  logger?: Logger,
): Promise<GmailAuthUrlResult> {
  cleanupExpiredStates()

  // Generate PKCE verifier and challenge using core module (async for Workers compatibility)
  const pkcePair = await generatePKCEPair("S256", 128)
  const codeVerifier = pkcePair.codeVerifier
  const codeChallenge = pkcePair.codeChallenge

  // Generate state parameter for CSRF protection
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // Store state and verifier
  oauthStateStore.set(state, {
    codeVerifier,
    timestamp: Date.now(),
  })

  // Build authorization URL
  const params = new URLSearchParams()
  params.set("client_id", config.clientId)
  params.set("redirect_uri", redirectUri)
  params.set("response_type", "code")
  params.set("scope", "https://www.googleapis.com/auth/gmail.readonly")
  params.set("state", state)
  params.set("code_challenge", codeChallenge)
  params.set("code_challenge_method", "S256")
  params.set("access_type", "offline") // Allow refresh token
  params.set("prompt", "consent") // Force consent to get refresh token

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  logger?.info?.("Gmail authorization URL generated")

  return { url, state }
}

/**
 * Exchange authorization code for access token
 *
 * Completes the OAuth flow by exchanging the authorization code
 * for an access token (and optionally refresh token).
 */
export async function exchangeCodeForToken(
  config: GmailOAuthConfig,
  code: string,
  state: string,
  redirectUri: string = "http://localhost:3000/callback",
  logger?: Logger,
): Promise<GmailTokenResult> {
  // Retrieve stored state
  const storedState = oauthStateStore.get(state)
  if (!storedState) {
    throw new Error(
      "Invalid or expired OAuth state. Please try again.",
    )
  }

  // Clean up state
  oauthStateStore.delete(state)

  // Exchange code for token
  const tokenUrl = "https://oauth2.googleapis.com/token"
  const params = new URLSearchParams()
  params.set("code", code)
  params.set("client_id", config.clientId)
  if (config.clientSecret) {
    params.set("client_secret", config.clientSecret)
  }
  params.set("redirect_uri", redirectUri)
  params.set("grant_type", "authorization_code")
  params.set("code_verifier", storedState.codeVerifier)

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
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

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

/**
 * Handle Gmail OAuth flow
 *
 * This integrates Gmail OAuth 2.0 with PKCE for secure authorization.
 *
 * Flow:
 * 1. Initialize OAuth (no params) - Returns { url, state }
 * 2. Handle callback (code + state) - Returns { accessToken, refreshToken }
 *
 * @param config - Gmail configuration
 * @param context - OAuth context with optional code, state, redirectUri
 * @param logger - Optional logger instance
 * @returns GmailOAuthResult with URL and/or token
 */
export async function gmailOAuthHandler(
  config: GmailOAuthConfig,
  context?: {
    code?: string
    state?: string
    redirectUri?: string
  },
  logger?: Logger,
): Promise<GmailOAuthResult> {
  try {
    const { code, state, redirectUri } = context || {}

    // Phase 1: Generate authorization URL
    if (!code) {
      const { url: authUrl, state: newState } =
        await generateAuthorizationUrl(
          config,
          redirectUri,
          logger,
        )
      return {
        url: authUrl,
        state: newState,
      }
    }

    // Phase 2: Exchange authorization code for access token
    if (!state) {
      throw new Error("State parameter is required for code exchange")
    }

    const { accessToken, refreshToken, expiresIn } =
      await exchangeCodeForToken(
        config,
        code,
        state,
        redirectUri,
        logger,
      )

    return {
      url: "",
      accessToken,
      refreshToken,
      expiresIn,
    }
  } catch (error) {
    logger?.error?.("Gmail OAuth error:", error)
    throw error
  }
}

/**
 * Refresh Gmail access token using refresh token
 *
 * @param config - Gmail configuration
 * @param refreshToken - Refresh token to use
 * @param logger - Optional logger instance
 * @returns New access token and expiry info, or null if refresh failed
 */
export async function refreshGmailToken(
  config: GmailOAuthConfig,
  refreshToken: string,
  logger?: Logger,
): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret || "",
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Gmail token refresh failed: ${response.status} ${errorText}`,
      )
    }

    const data = (await response.json()) as {
      access_token: string
      expires_in: number
      refresh_token?: string
    }

    logger?.info?.("Gmail token refreshed successfully")

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    }
  } catch (error) {
    logger?.error?.("Gmail token refresh error:", error)
    return null
  }
}
