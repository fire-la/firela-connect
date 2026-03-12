/**
 * Plaid OAuth routes (Hono)
 *
 * Provides HTTP endpoints for Plaid Link OAuth flow.
 * Migrated from Express (packages/connect/src/routes/plaid.ts)
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
  plaidOAuthHandler,
  type PlaidConfig,
} from "@firela/billclaw-core/oauth"
import { storeCredential } from "./credentials.js"

import type { OAuthEnv as Env } from "./env.js"

export const plaidRoutes = new Hono<{ Bindings: Env }>()

/**
 * Get Plaid configuration from environment bindings
 *
 * Workers-compatible: Uses env bindings instead of file-based ConfigManager
 */
function getPlaidConfig(env: Env): PlaidConfig {
  return {
    clientId: env.PLAID_CLIENT_ID,
    secret: env.PLAID_SECRET,
    environment: (env.PLAID_ENV as PlaidConfig["environment"]) || "sandbox",
  }
}

/**
 * Request validation schemas
 */
const exchangeTokenSchema = z.object({
  publicToken: z.string().min(1, "publicToken is required"),
  accountId: z.string().optional(),
  sessionId: z.string().optional(),
})

/**
 * GET /api/oauth/plaid/link-token
 *
 * Create a Plaid Link token for initializing the Plaid Link frontend.
 *
 * Response:
 * - success: boolean
 * - linkToken: string - Link token for Plaid Link initialization
 * - plaidUrl: string - URL to load Plaid Link
 */
plaidRoutes.get("/link-token", async (c) => {
  try {
    const config = getPlaidConfig(c.env)
    const result = await plaidOAuthHandler(config)

    // Return the Link token and the Plaid Link URL
    return c.json({
      success: true,
      linkToken: result.token,
      plaidUrl: result.url,
    })
  } catch (error) {
    const linkError = parseOauthError(
      error as Error | { code?: string; message?: string; status?: number },
      {
        provider: "plaid",
        operation: "link_token",
      },
    )
    console.error("[plaid_link_token]", linkError)

    return c.json(
      {
        success: false,
        error: linkError.humanReadable.message,
        errorCode: linkError.errorCode,
      },
      500,
    )
  }
})

/**
 * POST /api/oauth/plaid/exchange
 *
 * Exchange a Plaid public token for an access token.
 * Optionally stores credential for Direct mode polling.
 *
 * Request body:
 * - publicToken: Plaid public token (required)
 * - accountId: Account identifier (optional)
 * - sessionId: Session ID for credential polling (optional, for Direct mode)
 *
 * Response:
 * - success: boolean
 * - accessToken: string - Plaid access token
 * - itemId: string - Plaid item ID
 */
plaidRoutes.post(
  "/exchange",
  zValidator("json", exchangeTokenSchema),
  async (c) => {
    try {
      const { publicToken, accountId, sessionId } = c.req.valid("json")

      const config = getPlaidConfig(c.env)
      const result = await plaidOAuthHandler(config, publicToken, accountId)

      // Store credential for Direct mode polling if sessionId is provided
      if (sessionId) {
        storeCredential(sessionId, {
          provider: "plaid",
          publicToken: publicToken,
          metadata: result.itemId,
        })
      }

      return c.json({
        success: true,
        accessToken: result.accessToken,
        itemId: result.itemId,
      })
    } catch (error) {
      const exchangeError = parseOauthError(
        error as Error | { code?: string; message?: string; status?: number },
        {
          provider: "plaid",
          operation: "public_token_exchange",
        },
      )
      console.error("[plaid_token_exchange]", exchangeError)

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

export default plaidRoutes
