/**
 * Gmail OAuth routes (Hono)
 *
 * Provides HTTP endpoints for Gmail OAuth 2.0 flow.
 * Migrated from Express (packages/connect/src/routes/gmail.ts)
 *
 * @packageDocumentation
 */

import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import {
  parseOauthError,
} from "@firela/billclaw-core/errors"
import {
  gmailOAuthHandler,
  refreshGmailToken,
  type GmailOAuthConfig
} from "@firela/billclaw-core/oauth"
import { storeCredential } from "./credentials.js"

import type { OAuthEnv as Env } from "./env.js"

export const gmailRoutes = new Hono<{ Bindings: Env }>()

/**
 * Get Gmail configuration from environment bindings
 *
 * Workers-compatible: Uses env bindings instead of file-based ConfigManager
 */
function getGmailConfig(env: Env): GmailOAuthConfig {
  return {
    clientId: env.GMAIL_CLIENT_ID || "",
    clientSecret: env.GMAIL_CLIENT_SECRET || "",
  }
}

/**
 * Request validation schemas
 */
const exchangeTokenSchema = z.object({
  code: z.string().min(1, "code is required"),
  state: z.string().min(1, "state is required"),
  redirectUri: z.string().optional(),
  sessionId: z.string().optional(),
})

const refreshRequestSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
})

/**
 * GET /api/oauth/gmail/authorize
 *
 * Generate a Gmail OAuth authorization URL.
 *
 * Query params:
 * - redirectUri: Optional redirect URI override
 *
 * Response:
 * - success: boolean
 * - authUrl: string - Gmail OAuth authorization URL
 * - state: string - OAuth state parameter
 */
gmailRoutes.get("/authorize", async (c) => {
  try {
    const config = getGmailConfig(c.env)
    const redirectUri = c.req.query("redirectUri")

    const result = await gmailOAuthHandler(config, { redirectUri })

    return c.json({
      success: true,
      authUrl: result.url,
      state: result.state,
    })
  } catch (error) {
    const authError = parseOauthError(
      error as Error | { code?: string; message?: string; status?: number },
      {
        provider: "gmail",
        operation: "auth_url",
      },
    )
    console.error("[gmail_authorize]", authError)

    return c.json(
      {
        success: false,
        error: authError.humanReadable.message,
        errorCode: authError.errorCode,
      },
      500,
    )
  }
})

/**
 * POST /api/oauth/gmail/exchange
 *
 * Exchange a Gmail authorization code for access token.
 * Optionally stores credential for Direct mode polling.
 *
 * Request body:
 * - code: Authorization code (required)
 * - state: OAuth state parameter (required)
 * - redirectUri: Redirect URI (optional)
 * - sessionId: Session ID for credential polling (optional, for Direct mode)
 *
 * Response:
 * - success: boolean
 * - accessToken: string - Gmail access token
 * - refreshToken: string - Gmail refresh token
 * - expiresIn: number - Token expiration time in seconds
 */
gmailRoutes.post(
  "/exchange",
  zValidator("json", exchangeTokenSchema),
  async (c) => {
    try {
      const { code, state, redirectUri, sessionId } = c.req.valid("json")

      const config = getGmailConfig(c.env)
      const result = await gmailOAuthHandler(config, { code, state, redirectUri })

      // Store credential for Direct mode polling if sessionId is provided
      if (sessionId) {
        storeCredential(sessionId, {
          provider: "gmail",
          publicToken: result.accessToken ?? "",
          metadata: result.refreshToken ?? "",
        })
      }

      return c.json({
        success: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      })
    } catch (error) {
      const exchangeError = parseOauthError(
        error as Error | { code?: string; message?: string; status?: number },
        {
          provider: "gmail",
          operation: "code_exchange",
        },
      )
      console.error("[gmail_exchange]", exchangeError)

      return c.json(
        {
          success: false,
          error: exchangeError.humanReadable.message,
          errorCode: exchangeError.errorCode,
        },
        500,
      )
    }
  },
)

/**
 * POST /api/oauth/gmail/refresh
 *
 * Refresh a Gmail OAuth access token using a stored refresh token.
 *
 * Request body:
 * - accountId: Account ID to refresh token for (required)
 *
 * Response:
 * - success: boolean
 * - accessToken: string - New Gmail access token
 * - refreshToken: string - Gmail refresh token (may be unchanged)
 * - expiresIn: number - Token expiration time in seconds
 */
gmailRoutes.post(
  "/refresh",
  zValidator("json", refreshRequestSchema),
  async (c) => {
    try {
      const { accountId } = c.req.valid("json")

      // Get stored credential from KV
      const credentialKey = `credential:${accountId}`
      const storedCredential = await c.env.CONFIG.get(credentialKey, { type: "json" })

      if (!storedCredential) {
        return c.json(
          {
            success: false,
            error: "Credential not found for account",
            errorCode: "CREDENTIAL_NOT_FOUND",
          },
          404,
        )
      }

      const credential = storedCredential as {
        provider: string
        refreshToken?: string
        metadata?: string
      }

      // Validate this is a Gmail credential
      if (credential.provider !== "gmail") {
        return c.json(
          {
            success: false,
            error: "Account is not a Gmail account",
            errorCode: "INVALID_PROVIDER",
          },
          400,
        )
      }

      // Get refresh token from stored credential
      const refreshToken = credential.refreshToken || credential.metadata
      if (!refreshToken) {
        return c.json(
          {
            success: false,
            error: "No refresh token available for this account",
            errorCode: "NO_REFRESH_TOKEN",
          },
          400,
        )
      }

      // Refresh the token using core OAuth module
      const config = getGmailConfig(c.env)
      const result = await refreshGmailToken(config, refreshToken)

      if (!result) {
        return c.json(
          {
            success: false,
            error: "Failed to refresh token",
            errorCode: "REFRESH_FAILED",
          },
          500,
        )
      }

      // Update stored credential with new tokens
      const updatedCredential = {
        ...credential,
        accessToken: result.accessToken,
        expiresAt: Date.now() + result.expiresIn * 1000,
      }
      await c.env.CONFIG.put(credentialKey, JSON.stringify(updatedCredential))

      return c.json({
        success: true,
        accessToken: result.accessToken,
        refreshToken: refreshToken, // Return original refresh token (unchanged)
        expiresIn: result.expiresIn,
      })
    } catch (error) {
      const refreshError = parseOauthError(
        error as Error | { code?: string; message?: string; status?: number },
        {
          provider: "gmail",
          operation: "code_exchange" as const,
        },
      )
      console.error("[gmail_refresh]", refreshError)

      return c.json(
        {
          success: false,
          error: refreshError.humanReadable.message,
          errorCode: refreshError.errorCode,
        },
        500,
      )
    }
  },
)

export default gmailRoutes
