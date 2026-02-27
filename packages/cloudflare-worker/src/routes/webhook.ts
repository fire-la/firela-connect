/**
 * Webhook Routes
 *
 * Provides endpoints for receiving webhooks from Plaid.
 * Does NOT require JWT authentication - uses HMAC signature verification instead.
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
 * 1. Verifies the webhook signature using HMAC-SHA256
 * 2. Parses the webhook payload
 * 3. Returns 200 immediately (Plaid expects a fast response)
 * 4. Queues the sync operation for background processing (future)
 *
 * Request body: Plaid webhook JSON payload
 * Headers:
 * - Plaid-Signature: HMAC-SHA256 signature (hex-encoded)
 *
 * Response:
 * - 200: Webhook received and will be processed
 * - 401: Invalid signature
 * - 400: Invalid payload
 */
webhookRoutes.post("/plaid", async (c) => {
  // Get the raw body
  const body = await c.req.text()
  const signature = c.req.header("Plaid-Signature") || null

  // Process the webhook
  const result = await processPlaidWebhook(c.env, body, signature)

  // For debugging - you might want to log the webhook details
  // In production, this would use the logger middleware
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
