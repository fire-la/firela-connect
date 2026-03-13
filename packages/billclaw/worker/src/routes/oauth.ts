/**
 * OAuth Routes
 *
 * Provides endpoints for Plaid OAuth flow.
 *
 * @packageDocumentation
 */

import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import {
  createLinkToken,
  exchangePublicToken,
  getInstitution,
  getItem,
} from "../services/plaid.js"
import {
  D1StorageAdapter,
  type D1Database,
} from "@firela/billclaw-core/storage/d1"
import type { Env } from "../types/env.js"

export const oauthRoutes = new Hono<{ Bindings: Env }>()

// Request schemas
const exchangeTokenSchema = z.object({
  publicToken: z.string().min(1, "Public token is required"),
  accountId: z.string().min(1, "Account ID is required"),
  accountName: z.string().optional(),
})

/**
 * GET /oauth/plaid/link-token
 *
 * Create a Plaid Link token for initializing the Plaid Link frontend.
 *
 * Query params:
 * - userId: Optional user ID to associate with the token
 *
 * Response:
 * - success: true
 * - linkToken: Link token for Plaid Link initialization
 * - plaidUrl: URL to load Plaid Link
 */
oauthRoutes.get("/plaid/link-token", async (c) => {
  try {
    const userId = c.req.query("userId") || "default-user"
    const result = await createLinkToken(c.env, userId)

    return c.json({
      success: true,
      linkToken: result.linkToken,
      plaidUrl: "https://cdn.plaid.com/link/v2/stable/link.html",
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "PLAID_LINK_TOKEN_ERROR",
      },
      500,
    )
  }
})

/**
 * POST /oauth/plaid/exchange
 *
 * Exchange a Plaid public token for an access token and save to D1.
 *
 * Request body:
 * - publicToken: The public token from Plaid Link
 * - accountId: The account ID to associate with this connection
 * - accountName: Optional name for the account
 *
 * Response:
 * - success: true
 * - accessToken: The Plaid access token
 * - itemId: The Plaid item ID
 * - account: The saved account details
 */
oauthRoutes.post(
  "/plaid/exchange",
  zValidator("json", exchangeTokenSchema),
  async (c) => {
    try {
      const { publicToken, accountId, accountName } = c.req.valid("json")

      // Exchange public token for access token
      const { accessToken, itemId } = await exchangePublicToken(
        c.env,
        publicToken,
      )

      // Get item info to get institution ID
      const itemInfo = await getItem(c.env, accessToken)

      // Get institution name
      let name = accountName || "Bank Account"
      try {
        const institution = await getInstitution(
          c.env,
          itemInfo.institutionId,
        )
        name = accountName || institution.name
      } catch {
        // If we can't get institution name, use the provided name or default
      }

      // Save to D1 using D1StorageAdapter
      // Cast through unknown to bridge the type definitions
      // The Cloudflare Workers D1Database is compatible with our minimal interface
      const storage = new D1StorageAdapter({
        db: c.env.DB as unknown as D1Database,
      })
      await storage.saveAccount({
        id: accountId,
        type: "plaid",
        name,
        createdAt: new Date().toISOString(),
      })

      // Note: In a real implementation, we'd also store the access token
      // For now, this is a placeholder - the access token should be encrypted
      // and stored in a secure way (e.g., in a dedicated credentials table)
      // This will be implemented as part of the full OAuth flow in 06-03

      return c.json({
        success: true,
        accessToken,
        itemId,
        account: {
          id: accountId,
          type: "plaid",
          name,
        },
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          errorCode: "PLAID_EXCHANGE_ERROR",
        },
        500,
      )
    }
  },
)
