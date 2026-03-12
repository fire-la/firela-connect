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
  ConfigManager,
} from "@firela/billclaw-core"
import { storeCredential } from "./credentials.js"

/**
 * Environment bindings type
 */
type Env = {
  GMAIL_CLIENT_ID: string
  GMAIL_CLIENT_SECRET: string
  GMAIL_REDIRECT_URI: string
  CONFIG: KVNamespace
}

export const gmailRoutes = new Hono<{ Bindings: Env }>()

/**
 * Request validation schemas
 */
const exchangeTokenSchema = z.object({
  code: z.string().min(1, "code is required"),
  state: z.string().min(1, "state is required"),
  redirectUri: z.string().optional(),
  sessionId: z.string().optional(),
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
    const configManager = ConfigManager.getInstance()
    const config = await configManager.getServiceConfig("gmail")
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

      const configManager = ConfigManager.getInstance()
      const config = await configManager.getServiceConfig("gmail")
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

export default gmailRoutes
