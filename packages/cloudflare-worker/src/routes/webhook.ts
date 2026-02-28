/**
 * Webhook Routes
 *
 * Provides endpoints for receiving webhooks from Plaid.
 * Uses JWT-based verification via verifyPlaidWebhookJWT.
 *
 * @packageDocumentation
 */

import { Hono } from "hono"
import { processPlaidWebhook } from "../services/webhook.js"
import type { Env } from "../types/env.js"

export const webhookRoutes = new Hono<{ Bindings: Env }>()

/**
 * POST /webhook/plaid
 *
 * Receive and process a Plaid webhook.
 *
 * This endpoint:
 * 1. Verifies the webhook signature using JWT (Plaid-Verification header)
 * 2. Parses the webhook payload
 * 3. Returns 200 immediately (Plaid expects a fast response)
 * 4. Triggers async sync via waitUntil for SYNC_UPDATES_AVAILABLE
 *
 * Request body: Plaid webhook JSON payload
 * Headers:
 * - Plaid-Verification: JWT signature
 *
 * Response:
 * - 200: Webhook received and will be processed
 * - 401: Invalid signature
 * - 400: Invalid payload
 */
webhookRoutes.post("/plaid", async (c) => {
  // Get the raw body
  const body = await c.req.text()
  const verificationHeader = c.req.header("Plaid-Verification") || null

  // Process the webhook (pass execution context for waitUntil)
  const result = await processPlaidWebhook(
    c.env,
    body,
    verificationHeader,
    c.executionCtx, // Pass execution context for async sync
  )

  // For debugging - log webhook details
  console.log("[webhook]", {
    type: result.type,
    itemId: result.itemId,
    action: result.action,
    success: result.success,
    error: result.error,
  })

  // Return 200 for any valid webhook
  // Plaid expects a fast response - 200 is enough
  // The actual processing happens in the background
  return c.json({
    received: result.success,
    type: result.type,
    itemId: result.itemId,
    error: result.error,
  })
})

/**
 * GET /webhook/health
 *
 * Health check for webhook endpoint.
 */
webhookRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "billclaw-webhook",
  })
})
