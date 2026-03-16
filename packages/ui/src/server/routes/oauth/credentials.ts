/**
 * Credential storage and polling API for Direct Mode (Hono)
 *
 * Provides in-memory session storage for OAuth credentials,
 * enabling CLI to poll for credentials after OAuth completion.
 *
 * Migrated from Express (packages/connect/src/routes/credentials.ts)
 *
 * IMPORTANT: In Workers, this in-memory store won't persist across invocations.
 * This will be replaced with KV in Phase 13.2-04.
 *
 * @module routes/oauth/credentials
 */

import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import type { OAuthEnv } from "./env.js"

/**
 * Generate a UUID using Web Crypto API (Workers-compatible)
 */
function generateUUID(): string {
  return crypto.randomUUID()
}

 /**
 * Session TTL in milliseconds (10 minutes)
 */

/**
 * Session TTL in milliseconds (10 minutes)
 */
const SESSION_TTL = 10 * 60 * 1000

/**
 * Maximum long-polling timeout in seconds
 */
const MAX_POLL_TIMEOUT = 60

/**
 * Polling interval in milliseconds
 */
const POLL_INTERVAL = 500

/**
 * Credential session stored in memory
 */
interface CredentialSession {
  /** Unique session identifier */
  sessionId: string
  /** Optional PKCE code challenge */
  codeChallenge?: string
  /** PKCE method: "S256" or "plain" */
  codeChallengeMethod?: string
  /** OAuth provider: "plaid" or "gmail" */
  provider?: "plaid" | "gmail"
  /** OAuth token (public_token or access_token) */
  publicToken?: string
  /** Additional metadata (itemId, email, etc.) */
  metadata?: string
  /** Session creation timestamp */
  createdAt: number
  /** Session expiration timestamp */
  expiresAt: number
}

/**
 * In-memory session store
 *
 * Sessions are short-lived (10 minutes), so memory storage is sufficient.
 * For multi-instance deployments (Workers), consider using KV.
 * Note: In Workers, this in-memory store won't persist across invocations.
 * This will be replaced with KV in Phase 13.2-04.
 */
const sessionStore = new Map<string, CredentialSession>()

/**
 * Clean up expired sessions
 *
 * Workers-compatible: Called lazily during request handling instead of
 * using setInterval at module load time (which violates Workers global scope).
 */
function cleanupExpiredSessions(): void {
  const now = Date.now()
  for (const [sessionId, session] of sessionStore.entries()) {
    if (session.expiresAt < now) {
      sessionStore.delete(sessionId)
    }
  }
}

/**
 * Track last cleanup time to avoid excessive cleanup calls
 */
let lastCleanupTime = 0
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute

/**
 * Run cleanup if enough time has passed (lazy cleanup strategy)
 */
function maybeCleanup(): void {
  const now = Date.now()
  if (now - lastCleanupTime > CLEANUP_INTERVAL) {
    lastCleanupTime = now
    cleanupExpiredSessions()
  }
}

export const credentialsRoutes = new Hono<{ Bindings: OAuthEnv }>()

/**
 * Request validation schemas
 */
const createSessionSchema = z.object({
  code_challenge: z.string().optional(),
  code_challenge_method: z.enum(["S256", "plain"]).optional(),
})

const storeCredentialSchema = z.object({
  provider: z.enum(["plaid", "gmail"]),
  public_token: z.string().min(1, "public_token is required"),
  metadata: z.string().optional(),
})

/**
 * POST /api/connect/session
 *
 * Initialize a new credential session.
 * Optional PKCE parameters for secure credential transfer.
 *
 * Request body:
 * - code_challenge: Optional PKCE challenge
 * - code_challenge_method: "S256" or "plain"
 *
 * Response:
 * - success: boolean
 * - message: string
 * - data.session_id: string
 * - data.expires_in: number (seconds)
 */
credentialsRoutes.post(
  "/session",
  zValidator("json", createSessionSchema),
  (c) => {
    maybeCleanup() // Lazy cleanup on each request

    const { code_challenge, code_challenge_method } = c.req.valid("json")

    const sessionId = generateUUID()
    const now = Date.now()

    const session: CredentialSession = {
      sessionId,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method || "S256",
      createdAt: now,
      expiresAt: now + SESSION_TTL,
    }

    sessionStore.set(sessionId, session)

    return c.json({
      success: true,
      message: "Session initialized",
      data: {
        session_id: sessionId,
        expires_in: Math.floor(SESSION_TTL / 1000),
      },
    })
  },
)

/**
 * GET /api/connect/credentials/:sessionId
 *
 * Poll for credential completion.
 * Supports long-polling for efficient waiting.
 *
 * Query parameters:
 * - wait: "true" to enable long-polling
 * - timeout: Polling timeout in seconds (default: 30, max: 60)
 *
 * Response (pending):
 * - success: true
 * - data: null
 *
 * Response (ready):
 * - success: true
 * - data.session_id: string
 * - data.provider: string
 * - data.public_token: string
 * - data.metadata?: string
 *
 * Note: For Direct mode (no PKCE), returns pending status even for non-existent
 * sessions, allowing CLI to poll before OAuth completion creates the session.
 */
credentialsRoutes.get("/credentials/:sessionId", async (c) => {
  maybeCleanup() // Lazy cleanup on each request

  const sessionId = c.req.param("sessionId")
  const wait = c.req.query("wait") === "true"
  const timeout = Math.min(
    parseInt(c.req.query("timeout") as string, 10) || 30,
    MAX_POLL_TIMEOUT,
  )

  // Check if session exists
  let session = sessionStore.get(sessionId)

  if (!session) {
    // For Direct mode: session may not exist yet (created by storeCredential)
    // Return pending status instead of 404 to allow CLI to keep polling
    if (!wait) {
      return c.json({
        success: true,
        data: null,
      })
    }

    // For long-polling with non-existent session, wait for it to be created
    const startTime = Date.now()
    const timeoutMs = timeout * 1000

    while (Date.now() - startTime < timeoutMs) {
      session = sessionStore.get(sessionId)

      if (session?.publicToken) {
        // Session created and credential ready
        sessionStore.delete(sessionId)

        return c.json({
          success: true,
          data: {
            session_id: session.sessionId,
            provider: session.provider,
            public_token: session.publicToken,
            metadata: session.metadata,
          },
        })
      }

      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
    }

    // Timeout: return pending status
    return c.json({
      success: true,
      data: null,
    })
  }

  // Check if session is expired
  if (session.expiresAt < Date.now()) {
    sessionStore.delete(sessionId)
    return c.json(
      {
        success: false,
        message: "Session expired",
      },
      410,
    )
  }

  // If credential is ready, return immediately
  if (session.publicToken) {
    // Remove session after successful retrieval (one-time read)
    sessionStore.delete(sessionId)

    return c.json({
      success: true,
      data: {
        session_id: session.sessionId,
        provider: session.provider,
        public_token: session.publicToken,
        metadata: session.metadata,
      },
    })
  }

  // If not waiting, return pending status
  if (!wait) {
    return c.json({
      success: true,
      data: null,
    })
  }

  // Long-polling: wait for credential to be stored
  const startTime = Date.now()
  const timeoutMs = timeout * 1000

  while (Date.now() - startTime < timeoutMs) {
    // Re-fetch session (may have been updated)
    session = sessionStore.get(sessionId)

    if (!session) {
      return c.json(
        {
          success: false,
          message: "Session not found",
        },
        404,
      )
    }

    if (session.publicToken) {
      // Remove session after successful retrieval
      sessionStore.delete(sessionId)

      return c.json({
        success: true,
        data: {
          session_id: session.sessionId,
          provider: session.provider,
          public_token: session.publicToken,
          metadata: session.metadata,
        },
      })
    }

    // Wait before next check
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
  }

  // Timeout: return pending status
  return c.json({
    success: true,
    data: null,
  })
})

/**
 * POST /api/connect/credentials/:sessionId
 *
 * Store credential after OAuth completion.
 * Called internally by OAuth exchange endpoints.
 *
 * Request body:
 * - provider: "plaid" | "gmail"
 * - public_token: OAuth token
 * - metadata?: Additional data (itemId, email, etc.)
 */
credentialsRoutes.post(
  "/credentials/:sessionId",
  zValidator("json", storeCredentialSchema),
  (c) => {
    const sessionId = c.req.param("sessionId")
    const { provider, public_token, metadata } = c.req.valid("json")

    // Check if session exists
    const session = sessionStore.get(sessionId)

    if (!session) {
      return c.json(
        {
          success: false,
          message: "Session not found",
        },
        404,
      )
    }

    // Update session with credential
    session.provider = provider
    session.publicToken = public_token
    session.metadata = metadata

    // Store updated session
    sessionStore.set(sessionId, session)

    return c.json({
      success: true,
      message: "Credential stored",
    })
  },
)

/**
 * DELETE /api/connect/credentials/:sessionId
 *
 * Confirm credential deletion (cleanup).
 * Optional cleanup after successful retrieval.
 */
credentialsRoutes.delete("/credentials/:sessionId", (c) => {
  const sessionId = c.req.param("sessionId")

  if (sessionStore.has(sessionId)) {
    sessionStore.delete(sessionId)
  }

  return c.json({
    success: true,
    message: "Session deleted",
  })
})

/**
 * Store credential in session (for use by other routes)
 *
 * This function is called by OAuth exchange endpoints to store
 * credentials after successful token exchange.
 *
 * @param sessionId - Session identifier
 * @param credential - Credential data to store
 */
export function storeCredential(
  sessionId: string,
  credential: {
    provider: "plaid" | "gmail"
    publicToken: string
    metadata?: string
  },
): boolean {
  const session = sessionStore.get(sessionId)

  if (!session) {
    // Session doesn't exist, create it (for Direct mode without explicit session init)
    const now = Date.now()
    const newSession: CredentialSession = {
      sessionId,
      provider: credential.provider,
      publicToken: credential.publicToken,
      metadata: credential.metadata,
      createdAt: now,
      expiresAt: now + SESSION_TTL,
    }
    sessionStore.set(sessionId, newSession)
    return true
  }

  // Update existing session
  session.provider = credential.provider
  session.publicToken = credential.publicToken
  session.metadata = credential.metadata
  sessionStore.set(sessionId, session)

  return true
}

/**
 * Get session store stats (for debugging)
 */
export function getSessionStats(): {
  total: number
  withCredentials: number
  expired: number
} {
  const now = Date.now()
  let withCredentials = 0
  let expired = 0

  for (const session of sessionStore.values()) {
    if (session.publicToken) withCredentials++
    if (session.expiresAt < now) expired++
  }

  return {
    total: sessionStore.size,
    withCredentials,
    expired,
  }
}

export default credentialsRoutes
