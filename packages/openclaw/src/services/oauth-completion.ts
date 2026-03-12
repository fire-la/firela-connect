/**
 * Background OAuth completion handler for OpenClaw
 *
 * Provides continuous polling for OAuth credential completion
 * for both Plaid and Gmail flows. Supports cancellation,
 * timeout handling, and callback triggers.
 *
 * @packageDocumentation
 */

import type { OpenClawPluginApi } from "../types/openclaw-plugin.js"
import { randomUUID } from "crypto"
import { getConfig } from "@firela/billclaw-core"
import { logError, parseOauthError } from "@firela/billclaw-core/errors"
import {
  generatePKCEPair,
  initConnectSession,
  retrieveCredential,
  confirmCredentialDeletion,
} from "@firela/billclaw-core/oauth"
import { RELAY_URL } from "@firela/billclaw-core/connection"

// Re-export types for consumers
export type { OAuthCompletionResult, OAuthCompletionCallback }

/**
 * OAuth session state
 */
interface OAuthSession {
  sessionId: string
  provider: "plaid" | "gmail"
  mode: "direct" | "relay"
  startTime: number
  timeout: number
  accountName?: string
  status: "pending" | "completed" | "failed" | "cancelled" | "timeout"
  pollInterval?: NodeJS.Timeout
  timeoutId?: NodeJS.Timeout // Timeout handler for cleanup
  deviceCode?: string // For Gmail Device Code Flow
  codeVerifier?: string // PKCE code verifier (Relay mode only)
}

/**
 * OAuth completion result
 */
interface OAuthCompletionResult {
  sessionId: string
  provider: "plaid" | "gmail"
  status: "completed" | "failed" | "timeout" | "cancelled"
  credentials?: {
    accessToken: string
    refreshToken?: string
    itemId?: string
    emailAddress?: string
    tokenExpiry?: string
  }
  error?: {
    code: string
    message: string
  }
}

/**
 * Callback for OAuth completion
 */
type OAuthCompletionCallback = (result: OAuthCompletionResult) => void | Promise<void>

/**
 * Default OAuth timeout in milliseconds (10 minutes)
 */
const DEFAULT_OAUTH_TIMEOUT = 10 * 60 * 1000

/**
 * Default polling interval in milliseconds
 */
const DEFAULT_POLL_INTERVAL = 3000

/**
 * Active OAuth sessions
 */
const activeSessions = new Map<string, OAuthSession>()

/**
 * Registered callbacks
 */
const callbacks = new Map<string, Set<OAuthCompletionCallback>>()

/**
 * Convert OpenClaw logger to BillClaw Logger interface
 */
function toLogger(
  logger: OpenClawPluginApi["logger"] | undefined,
): {
  info: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
} {
  const log = logger?.info || (() => {})
  const logError = logger?.error || (() => {})
  const logWarn = logger?.warn || (() => console.warn)
  const logDebug = logger?.debug || (() => {})

  return {
    info: log,
    error: logError,
    warn: logWarn,
    debug: logDebug,
  }
}

/**
 * Start OAuth session with continuous polling
 *
 * Creates a new session that polls for credential completion
 * and triggers registered callbacks when done.
 */
export async function startOAuthSession(
  api: OpenClawPluginApi,
  params: {
    provider: "plaid" | "gmail"
    mode?: "direct" | "relay"
    accountName?: string
    timeout?: number
    deviceCode?: string // For Gmail Device Code Flow
  },
): Promise<{ sessionId: string; connectUrl?: string; userCode?: string }> {
  const logger = toLogger(api.logger)
  const config = await getConfig()

  const mode = params.mode || "auto"
  const timeout = params.timeout || DEFAULT_OAUTH_TIMEOUT

  // Determine connection mode
  let actualMode: "direct" | "relay"
  const publicUrl = config.connect?.publicUrl

  if (mode === "direct" && publicUrl) {
    actualMode = "direct"
  } else if (mode === "relay" || !publicUrl) {
    actualMode = "relay"
  } else {
    actualMode = "direct"
  }

  let sessionId: string
  let connectUrl: string
  let userCode: string | undefined
  let codeVerifier: string | undefined

  if (params.provider === "plaid") {
    if (actualMode === "direct" && publicUrl) {
      // Direct mode: No PKCE, use local Connect service
      sessionId = randomUUID()
      connectUrl = `${publicUrl}/oauth/plaid/link?session=${sessionId}`
      logger.info?.(`OAuth session started: ${sessionId} (plaid, direct mode, local OAuth)`)
    } else {
      // Relay mode: PKCE required
      const pkcePair = await generatePKCEPair("S256", 128)
      codeVerifier = pkcePair.codeVerifier

      sessionId = await initConnectSession(RELAY_URL, pkcePair)
      connectUrl = `https://connect.firela.io/plaid?session=${sessionId}`

      logger.info?.(`OAuth session started: ${sessionId} (plaid, relay mode, PKCE enabled)`)
    }
  } else {
    // Gmail - use device code (unchanged)
    sessionId = params.deviceCode || randomUUID()
    userCode = params.deviceCode
    connectUrl = `https://oauth2.googleapis.com/device` // Activation URL

    logger.info?.(`OAuth session started: ${sessionId} (gmail, ${actualMode} mode)`)
  }

  // Create session
  const session: OAuthSession = {
    sessionId,
    provider: params.provider,
    mode: actualMode,
    startTime: Date.now(),
    timeout,
    accountName: params.accountName,
    status: "pending",
    deviceCode: params.deviceCode,
    codeVerifier, // Only set for Relay mode
  }

  activeSessions.set(sessionId, session)

  // Start polling
  session.pollInterval = setInterval(
    () => pollForCompletion(api, sessionId),
    DEFAULT_POLL_INTERVAL,
  )

  // Set timeout handler and store ID for cleanup
  session.timeoutId = setTimeout(
    () => handleTimeout(api, sessionId),
    timeout,
  )

  return { sessionId, connectUrl, userCode }
}

/**
 * Poll for credential completion
 */
async function pollForCompletion(
  api: OpenClawPluginApi,
  sessionId: string,
): Promise<void> {
  const logger = toLogger(api.logger)
  const session = activeSessions.get(sessionId)

  if (!session || session.status !== "pending") {
    return
  }

  // Check timeout
  if (Date.now() - session.startTime > session.timeout) {
    await handleTimeout(api, sessionId)
    return
  }

  try {
    const config = await getConfig()
    const publicUrl = config.connect?.publicUrl

    let credential: OAuthCompletionResult["credentials"] | null = null

    if (session.provider === "plaid") {
      if (session.mode === "direct" && publicUrl && !session.codeVerifier) {
        // Direct mode does not support automatic credential polling
        // The local Connect service does not have /api/connect/* endpoints
        // See ADR-007: Direct Mode Manual Completion for OAuth
        logger.warn?.(
          `Direct mode session ${sessionId} does not support automatic polling. ` +
            "User must manually complete OAuth and configure the account."
        )
        await completeSession(
          api,
          sessionId,
          "failed",
          undefined,
          {
            code: "DIRECT_MODE_UNSUPPORTED",
            message:
              "Direct mode does not support automatic credential polling. " +
              "Please complete the OAuth flow in your browser and manually configure the account.",
          },
        )
        return
      } else {
        // Relay mode: Use PKCE-enabled retrieval
        if (!session.codeVerifier) {
          throw new Error("No code_verifier for Relay mode Plaid session")
        }

        const relayUrl = RELAY_URL

        try {
          const credData = await retrieveCredential(relayUrl, {
            sessionId,
            codeVerifier: session.codeVerifier,
            wait: true,
            timeout: 30,
          })

          if (credData?.public_token) {
            await confirmCredentialDeletion(RELAY_URL, sessionId).catch(() => {
              // Ignore deletion errors
            })

            credential = {
              accessToken: credData.public_token,
              itemId: credData.metadata,
            }
          }
        } catch (error) {
          const errorMessage = String(error)

          // Check for terminal errors
          if (
            errorMessage.includes("expired") ||
            errorMessage.includes("invalid code_verifier") ||
            errorMessage.includes("maximum retrieval")
          ) {
            throw error
          }

          // Transient error, continue polling
          logger.debug?.(`Transient error polling for ${sessionId}: ${errorMessage}`)
          return
        }
      }
    } else {
      // Gmail - poll for token using device code
      const gmailConfig = config.gmail
      if (!gmailConfig?.clientId || !gmailConfig?.clientSecret) {
        throw new Error("Gmail OAuth credentials not configured")
      }

      if (!session.deviceCode) {
        throw new Error("No device code for Gmail session")
      }

      const response = await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: gmailConfig.clientId,
            client_secret: gmailConfig.clientSecret,
            device_code: session.deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          }).toString(),
          signal: AbortSignal.timeout(10000),
        },
      )

      if (response.ok) {
        const tokenData = (await response.json()) as {
          access_token: string
          refresh_token: string
          expires_in: number
        }
        const tokenExpiry = new Date(
          Date.now() + tokenData.expires_in * 1000,
        ).toISOString()

        // Get email address
        let emailAddress: string | undefined
        try {
          const profileResponse = await fetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/profile",
            {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
              },
              signal: AbortSignal.timeout(10000),
            },
          )
          if (profileResponse.ok) {
            const profile = (await profileResponse.json()) as {
              emailAddress: string
            }
            emailAddress = profile.emailAddress
          }
        } catch {
          // Ignore profile fetch errors
        }

        credential = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiry,
          emailAddress,
        }
      } else {
        const errorData = (await response.json()) as { error: string }
        if (errorData.error === "authorization_pending") {
          // User hasn't authorized yet, continue polling
          return
        } else if (errorData.error === "slow_down") {
          // Poll too fast, skip next poll
          return
        } else if (errorData.error === "expired_token") {
          throw new Error("Device code expired")
        } else if (errorData.error === "access_denied") {
          throw new Error("Access denied by user")
        }
      }
    }

    if (credential) {
      await completeSession(api, sessionId, "completed", credential)
    }
  } catch (error) {
    const userError = parseOauthError(
      error as Error | { code?: string; message?: string },
      { provider: session.provider, operation: "polling" },
    )
    logError(logger, userError, { sessionId })

    // Don't fail on transient errors, keep polling
    logger.debug?.(`Transient error polling for ${sessionId}:`, error)
  }
}

/**
 * Complete OAuth session with result
 */
async function completeSession(
  api: OpenClawPluginApi,
  sessionId: string,
  status: "completed" | "failed" | "timeout" | "cancelled",
  credentials?: OAuthCompletionResult["credentials"],
  error?: { code: string; message: string },
): Promise<void> {
  const logger = toLogger(api.logger)
  const session = activeSessions.get(sessionId)

  if (!session) {
    logger.warn?.(`Session not found: ${sessionId}`)
    return
  }

  // Clear polling interval
  if (session.pollInterval) {
    clearInterval(session.pollInterval)
    session.pollInterval = undefined
  }

  // Clear timeout handler
  if (session.timeoutId) {
    clearTimeout(session.timeoutId)
    session.timeoutId = undefined
  }

  // Update session status
  session.status = status

  // Build result
  const result: OAuthCompletionResult = {
    sessionId,
    provider: session.provider,
    status,
    credentials,
    error,
  }

  logger.info?.(`OAuth session ${status}: ${sessionId}`)

  // Trigger callbacks
  const sessionCallbacks = callbacks.get(sessionId)
  if (sessionCallbacks) {
    for (const callback of sessionCallbacks) {
      try {
        await callback(result)
      } catch (err) {
        logger.error?.(`OAuth callback error for ${sessionId}:`, err)
      }
    }
  }

  // Clean up session after delay
  setTimeout(() => {
    activeSessions.delete(sessionId)
    callbacks.delete(sessionId)
  }, 5000)
}

/**
 * Handle session timeout
 */
async function handleTimeout(
  api: OpenClawPluginApi,
  sessionId: string,
): Promise<void> {
  const logger = toLogger(api.logger)
  const session = activeSessions.get(sessionId)

  if (!session || session.status !== "pending") {
    return
  }

  logger.info?.(`OAuth session timeout: ${sessionId}`)

  await completeSession(
    api,
    sessionId,
    "timeout",
    undefined,
    { code: "TIMEOUT", message: "OAuth session timed out" },
  )
}

/**
 * Cancel OAuth session
 */
export async function cancelOAuthSession(
  api: OpenClawPluginApi,
  sessionId: string,
): Promise<void> {
  const logger = toLogger(api.logger)
  const session = activeSessions.get(sessionId)

  if (!session) {
    logger.warn?.(`Cannot cancel non-existent session: ${sessionId}`)
    return
  }

  logger.info?.(`OAuth session cancelled: ${sessionId}`)

  await completeSession(
    api,
    sessionId,
    "cancelled",
    undefined,
    { code: "CANCELLED", message: "OAuth session cancelled by user" },
  )
}

/**
 * Register callback for OAuth completion
 */
export function onOAuthComplete(
  sessionId: string,
  callback: OAuthCompletionCallback,
): void {
  if (!callbacks.has(sessionId)) {
    callbacks.set(sessionId, new Set())
  }
  callbacks.get(sessionId)!.add(callback)
}

/**
 * Unregister callback for OAuth completion
 */
export function offOAuthComplete(
  sessionId: string,
  callback: OAuthCompletionCallback,
): void {
  const sessionCallbacks = callbacks.get(sessionId)
  if (sessionCallbacks) {
    sessionCallbacks.delete(callback)
    if (sessionCallbacks.size === 0) {
      callbacks.delete(sessionId)
    }
  }
}

/**
 * Get session status
 */
export function getOAuthSessionStatus(
  sessionId: string,
): OAuthSession | undefined {
  return activeSessions.get(sessionId)
}

/**
 * Get all active sessions
 */
export function getActiveOAuthSessions(): OAuthSession[] {
  return Array.from(activeSessions.values())
}

/**
 * Cleanup completed sessions (call periodically)
 */
export function cleanupCompletedSessions(): void {
  const now = Date.now()
  for (const [sessionId, session] of activeSessions.entries()) {
    // Remove completed/failed/cancelled sessions older than 1 minute
    if (
      session.status !== "pending" &&
      now - session.startTime > session.timeout + 60000
    ) {
      activeSessions.delete(sessionId)
      callbacks.delete(sessionId)
    }
  }
}
