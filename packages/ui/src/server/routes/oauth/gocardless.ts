/**
 * GoCardless OAuth routes (Hono)
 *
 * Provides HTTP endpoints for GoCardless institution discovery,
 * requisition (OAuth) flow, and status polling via firela-relay.
 *
 * All requests are proxied through GoCardlessRelayClient from the core package,
 * keeping FIRELA_RELAY_API_KEY server-side.
 *
 * SECURITY:
 * - access_token is always passed in request body, never in URL parameters
 * - API key never leaves the server
 *
 * @packageDocumentation
 */

import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { GoCardlessRelayClient } from "@firela/billclaw-core/relay"

import { DEFAULT_RELAY_URL } from "../../constants.js"
import { getRelayApiKey } from "../../lib/relay-helpers.js"
import type { OAuthEnv as Env } from "./env.js"

export const gocardlessRoutes = new Hono<{ Bindings: Env }>()

/**
 * Create a GoCardlessRelayClient from environment bindings or KV-stored key.
 *
 * @throws Error if relay API key is not configured
 */
async function getGoCardlessClient(env: Env): Promise<GoCardlessRelayClient> {
  const apiKey = await getRelayApiKey(env)
  if (!apiKey) {
    throw new Error(
      "Relay API key not configured. Set it in Settings or via FIRELA_RELAY_API_KEY environment variable.",
    )
  }

  return new GoCardlessRelayClient(
    { relayUrl: env.FIRELA_RELAY_URL || DEFAULT_RELAY_URL, relayApiKey: apiKey },
    console,
  )
}

/**
 * Request validation schemas
 */
const institutionsSchema = z.object({
  country: z.string().length(2, "Country code must be ISO 3166-1 alpha-2 (2 characters)"),
})

const createRequisitionSchema = z.object({
  institution_id: z.string().min(1, "Institution ID is required"),
  redirect_url: z.string().url("Redirect URL must be a valid URL"),
})

const requisitionStatusSchema = z.object({
  access_token: z.string().optional(),
})

/**
 * POST /api/oauth/gocardless/institutions
 *
 * Search for GoCardless institutions (banks) by country code.
 *
 * Request body:
 * - country: ISO 3166-1 alpha-2 country code (e.g., "DE", "GB", "FR")
 *
 * Response:
 * - success: boolean
 * - data: Institution[] - list of available banks for the country
 */
gocardlessRoutes.post(
  "/institutions",
  zValidator("json", institutionsSchema),
  async (c) => {
    try {
      const { country } = c.req.valid("json")
      const client = await getGoCardlessClient(c.env)
      const institutions = await client.getInstitutions(country)

      return c.json({
        success: true,
        data: institutions,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch institutions"
      console.error("[gocardless_institutions]", error)

      return c.json(
        {
          success: false,
          error: message,
        },
        500,
      )
    }
  },
)

/**
 * POST /api/oauth/gocardless/requisitions
 *
 * Create a GoCardless requisition (start OAuth flow).
 * Returns a link URL that the user opens in a popup/redirect to authenticate
 * with their bank.
 *
 * Request body:
 * - institution_id: GoCardless institution ID (required)
 * - redirect_url: URL to redirect after bank authentication (required)
 *
 * Response:
 * - success: boolean
 * - data: Requisition object with `link` field for OAuth popup
 */
gocardlessRoutes.post(
  "/requisitions",
  zValidator("json", createRequisitionSchema),
  async (c) => {
    try {
      const { institution_id, redirect_url } = c.req.valid("json")
      const client = await getGoCardlessClient(c.env)

      const requisition = await client.createRequisition({
        institution_id,
        redirect: redirect_url,
        reference: crypto.randomUUID(),
      })

      return c.json({
        success: true,
        data: requisition,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create requisition"
      console.error("[gocardless_requisitions]", error)

      return c.json(
        {
          success: false,
          error: message,
        },
        500,
      )
    }
  },
)

/**
 * POST /api/oauth/gocardless/requisitions/:id/status
 *
 * Poll requisition status after OAuth completion.
 * Returns the current status and linked account IDs when done.
 *
 * SECURITY: access_token is passed in request body, never in URL parameters.
 *
 * Request body:
 * - access_token: GoCardless access token for API authentication (optional, auto-created by relay when empty)
 *
 * Response:
 * - success: boolean
 * - data: Requisition object with status and accounts array
 */
gocardlessRoutes.post(
  "/requisitions/:id/status",
  zValidator("json", requisitionStatusSchema),
  async (c) => {
    try {
      const { id } = c.req.param()
      const { access_token } = c.req.valid("json")
      const client = await getGoCardlessClient(c.env)

      // Pass access_token if provided, empty string triggers auto-creation in relay
      const requisition = await client.getRequisition(id, access_token ?? "")

      return c.json({
        success: true,
        data: requisition,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to get requisition status"
      console.error("[gocardless_requisition_status]", error)

      return c.json(
        {
          success: false,
          error: message,
        },
        500,
      )
    }
  },
)
