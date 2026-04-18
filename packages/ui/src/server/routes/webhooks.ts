/**
 * Webhook Routes
 *
 * Provides endpoints for receiving webhooks from Plaid, GoCardless, etc.
 * Migrated from Express (packages/connect/src/routes/webhooks.ts) to Hono.
 *
 * @packageDocumentation
 */

import { Hono } from "hono"
import { PlaidWebhookVerifier } from "@firela/billclaw-core"
import { RelayClient } from "@firela/billclaw-core/relay"
import type { RelayJwkProxyResponse } from "@firela/billclaw-core/relay"
import { DEFAULT_RELAY_URL, DEFAULT_PLAID_ENV } from "../constants.js"
import type { Env } from "../index.js"

export const webhookRoutes = new Hono<{ Bindings: Env }>()

/**
 * Create a PlaidWebhookVerifier with RelayClient-backed JWK fetch.
 *
 * Creates a RelayClient from environment bindings and uses it to fetch
 * verification keys from the relay JWK proxy endpoint. This enables
 * production Plaid webhook verification through the relay service.
 *
 * @param env - Server environment bindings with FIRELA_RELAY_URL and FIRELA_RELAY_API_KEY
 * @returns PlaidWebhookVerifier instance with real JWK fetch
 */
export function createPlaidVerifier(env: Env): PlaidWebhookVerifier {
  const client = new RelayClient({
    url: env.FIRELA_RELAY_URL || DEFAULT_RELAY_URL,
    apiKey: env.FIRELA_RELAY_API_KEY!,
  })

  return new PlaidWebhookVerifier(
    {
      debug: (...args: unknown[]) => console.debug("[webhook:plaid]", ...args),
      info: (...args: unknown[]) => console.info("[webhook:plaid]", ...args),
      warn: (...args: unknown[]) => console.warn("[webhook:plaid]", ...args),
      error: (...args: unknown[]) => console.error("[webhook:plaid]", ...args),
    },
    async (kid: string) => {
      const response = await client.request<RelayJwkProxyResponse>(
        `/api/open-banking/plaid/webhook-key/${kid}`,
      )
      return { key: response.key }
    },
  )
}

/**
 * POST /webhook/plaid
 *
 * Receive and process a Plaid webhook.
 *
 * Verification flow:
 * 1. Read raw body via c.req.raw.text() (preserves bytes for SHA-256 hash)
 * 2. Parse JSON manually (graceful 400 on invalid JSON)
 * 3. When Plaid-Verification header present: verify JWT signature via PlaidWebhookVerifier
 * 4. When Plaid-Verification header absent: reject in production, warn in sandbox
 *
 * Request body: Plaid webhook JSON payload
 * Headers:
 * - Plaid-Verification: JWT signature for webhook authenticity
 * - Plaid-Timestamp: Timestamp for replay protection
 *
 * Response:
 * - 200: Webhook received and will be processed
 * - 400: Invalid payload (malformed JSON)
 * - 401: Invalid signature or missing verification header in production
 * - 500: Server error
 */
webhookRoutes.post("/plaid", async (c) => {
  try {
    // Read raw body FIRST — required for SHA-256 body hash verification
    const rawBody = await c.req.raw.text()
    const verificationHeader = c.req.header("Plaid-Verification")
    const timestampHeader = c.req.header("Plaid-Timestamp")

    // Parse JSON manually after raw body access
    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawBody)
    } catch {
      return c.json({ received: false, error: "Invalid JSON" }, 400)
    }

    // Log webhook receipt for debugging
    console.log("[webhook] Received Plaid webhook:", {
      webhookType: body.webhook_type,
      webhookCode: body.webhook_code,
      itemId: body.item_id,
      hasVerification: !!verificationHeader,
      timestamp: timestampHeader,
    })

    // Plaid JWT verification
    if (verificationHeader) {
      const verifier = createPlaidVerifier(c.env)
      const isValid = await verifier.verify(rawBody, verificationHeader)

      if (!isValid) {
        console.warn("[webhook] Plaid webhook rejected: invalid signature")
        return c.json(
          { received: false, error: "Invalid signature" },
          401,
        )
      }
    } else {
      // No verification header — reject in production, allow in sandbox with warning
      console.warn(
        "[webhook] Plaid webhook received without verification header",
      )

      if ((c.env.PLAID_ENV || DEFAULT_PLAID_ENV) !== "sandbox") {
        return c.json(
          { received: false, error: "Missing verification header" },
          401,
        )
      }

      // Sandbox mode: allow through with warning
      console.warn(
        "[webhook] Plaid webhook accepted without verification (sandbox mode)",
      )
    }

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
 * Note: GoCardless Bank Account Data is a poll-only API — webhooks are not
 * expected for transaction data. This endpoint remains as a placeholder for
 * future-proofing (e.g., GoCardless Direct Debit is a separate product).
 *
 * Request body: GoCardless webhook JSON payload
 * Headers:
 * - Webhook-Signature: HMAC signature (for future Direct Debit verification)
 *
 * Response:
 * - 200: Webhook received
 * - 400: Invalid payload (malformed JSON)
 * - 500: Server error
 */
webhookRoutes.post("/gocardless", async (c) => {
  try {
    // Read raw body FIRST — required for future HMAC signature verification
    const rawBody = await c.req.raw.text()
    const signatureHeader = c.req.header("Webhook-Signature")

    // Parse JSON manually after raw body access
    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawBody)
    } catch {
      return c.json({ received: false, error: "Invalid JSON" }, 400)
    }

    // Log webhook receipt for debugging
    console.log("[webhook] Received GoCardless webhook:", {
      hasSignature: !!signatureHeader,
      events: Array.isArray(body.events)
        ? (body.events as unknown[]).length
        : 0,
    })

    // GoCardless Bank Account Data is poll-only — webhooks not expected.
    // This endpoint acknowledges receipt for future compatibility.
    // See: billclaw/core/src/webhooks/handlers/gocardless.ts for details.
    // GoCardless Bank Account Data is poll-only — webhooks not expected
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
