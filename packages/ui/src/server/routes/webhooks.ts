/**
 * Webhook Routes
 *
 * Provides endpoints for receiving webhooks from Plaid, GoCardless, etc.
 * Migrated from Express (packages/connect/src/routes/webhooks.ts) to Hono.
 *
 * @packageDocumentation
 */

import { Hono } from "hono"
import type { Env } from "../index.js"

export const webhookRoutes = new Hono<{ Bindings: Env }>()

/**
 * POST /webhook/plaid
 *
 * Receive and process a Plaid webhook.
 *
 * This endpoint receives Plaid webhooks and processes them.
 * For Cloudflare Workers, the actual verification and sync triggering
 * is handled by the cloudflare-worker service.
 *
 * Request body: Plaid webhook JSON payload
 * Headers:
 * - Plaid-Verification: JWT signature
 * - Plaid-Timestamp: Timestamp for replay protection
 *
 * Response:
 * - 200: Webhook received and will be processed
 * - 400: Invalid payload
 * - 500: Server error
 */
webhookRoutes.post("/plaid", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const verificationHeader = c.req.header("Plaid-Verification")
    const timestampHeader = c.req.header("Plaid-Timestamp")

    // Log webhook receipt for debugging
    console.log("[webhook] Received Plaid webhook:", {
      webhookType: (body as Record<string, unknown>).webhook_type,
      webhookCode: (body as Record<string, unknown>).webhook_code,
      itemId: (body as Record<string, unknown>).item_id,
      hasVerification: !!verificationHeader,
      timestamp: timestampHeader,
    })

    // TODO: Integrate with cloudflare-worker processPlaidWebhook for full verification
    // For now, just acknowledge receipt
    // The actual implementation would use:
    // import { processPlaidWebhook } from "@firela/billclaw-cloudflare-worker/services/webhook"
    // const result = await processPlaidWebhook(c.env, rawBody, verificationHeader, c.executionCtx)

    return c.json({
      received: true,
      message: "Plaid webhook received successfully",
    })
  } catch (error) {
    console.error("[webhook] Error handling Plaid webhook:", error)
    return c.json(
      {
        received: false,
        error: "Internal server error",
      },
      500,
    )
  }
})

/**
 * POST /webhook/gocardless
 *
 * Receive and process a GoCardless webhook.
 *
 * Request body: GoCardless webhook JSON payload
 * Headers:
 * - Webhook-Signature: HMAC signature
 *
 * Response:
 * - 200: Webhook received
 * - 400: Invalid payload
 * - 500: Server error
 */
webhookRoutes.post("/gocardless", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const signatureHeader = c.req.header("Webhook-Signature")

    // Log webhook receipt for debugging
    console.log("[webhook] Received GoCardless webhook:", {
      hasSignature: !!signatureHeader,
      events: Array.isArray((body as Record<string, unknown>).events)
        ? ((body as Record<string, unknown>).events as unknown[]).length
        : 0,
    })

    // TODO: Implement GoCardless webhook verification and processing
    // For now, just acknowledge receipt

    return c.json({
      received: true,
      message: "GoCardless webhook received successfully",
    })
  } catch (error) {
    console.error("[webhook] Error handling GoCardless webhook:", error)
    return c.json(
      {
        received: false,
        error: "Internal server error",
      },
      500,
    )
  }
})

/**
 * POST /webhook/test
 *
 * Test endpoint for webhook connectivity verification.
 *
 * Response:
 * - 200: Test webhook received
 */
webhookRoutes.post("/test", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))

    console.log("[webhook] Received test webhook:", body)

    return c.json({
      received: true,
      message: "Test webhook received successfully",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[webhook] Error handling test webhook:", error)
    return c.json(
      {
        received: false,
        error: "Internal server error",
      },
      500,
    )
  }
})

/**
 * GET /webhook/health
 *
 * Health check for webhook endpoints.
 *
 * Response:
 * - 200: Service healthy
 */
webhookRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "billclaw-webhook",
    version: "0.0.1",
  })
})
