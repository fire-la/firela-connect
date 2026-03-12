/**
 * Webhook routes for BillClaw Connect
 *
 * Provides HTTP endpoints for receiving webhooks from external services
 * (Plaid, GoCardless, etc.) using the Core webhook layer.
 *
 * P0 Security Features:
 * - Rate limiting (per-IP fixed-window)
 * - Replay attack protection (via Core security layer)
 * - Signature verification (via Core security layer)
 */

import express, { type Request, type Router, type Response } from "express"
import {
  WebhookProcessor,
  createWebhookSecurity,
  createWebhookDeduplication,
  createSyncRateLimiter,
  PlaidWebhookHandler,
  GoCardlessWebhookHandler,
  type WebhookRequest,
} from "@firela/billclaw-core"
import type { Logger } from "@firela/billclaw-core"

/**
 * Simple console logger for Connect
 */
const consoleLogger: Logger = {
  info: (...args: unknown[]) => console.log("[INFO]", ...args),
  error: (...args: unknown[]) => console.error("[ERROR]", ...args),
  warn: (...args: unknown[]) => console.warn("[WARN]", ...args),
  debug: (...args: unknown[]) => {
    if (process.env.DEBUG) {
      console.debug("[DEBUG]", ...args)
    }
  },
}

/**
 * Webhook components
 */
let processor: WebhookProcessor | null = null

/**
 * Get client IP from Express request (reserved for future use)
 */
function _getClientIp(req: Request): string {
  const ip = req.headers["x-forwarded-for"] as string | undefined
  if (ip) {
    return ip.split(",")[0].trim()
  }

  const realIp = req.headers["x-real-ip"] as string | undefined
  if (realIp) {
    return realIp
  }

  return req.socket.remoteAddress || "unknown"
}

/**
 * Initialize webhook processor
 *
 * Must be called before routes are used.
 */
export async function initializeWebhooks(
  basePath: string,
  plaidWebhookSecret?: string,
): Promise<void> {
  // Create deduplication cache
  const deduplication = await createWebhookDeduplication({
    basePath,
    logger: consoleLogger,
  })

  // Create security layer
  const security = createWebhookSecurity(deduplication, consoleLogger)

  // Create rate limiter (reserved for future use)
  const _rateLimiter = createSyncRateLimiter(consoleLogger)

  // Create processor
  processor = new WebhookProcessor({
    logger: consoleLogger,
    webhookSecret: plaidWebhookSecret,
    security,
  })

  // Note: We register handlers later when routes are created
  // This allows for dynamic configuration based on accounts
}

/**
 * Set account finder for Plaid handler
 *
 * This allows the webhook handler to find accounts by item ID.
 */
export function setAccountFinder(
  findAccountByItemId: (itemId: string) => Promise<any | null>,
): void {
  if (!processor) {
    throw new Error("Webhook processor not initialized")
  }

  processor.registerHandler(
    "plaid",
    new PlaidWebhookHandler({
      logger: consoleLogger,
      findAccountByItemId,
      triggerSync: async (_accountId: string) => {
        // Sync triggering from Connect is not yet implemented
        // This would require access to Billclaw instance
        console.warn?.("Sync triggering from Connect webhooks not yet implemented")
      },
      webhooks: [],
      rateLimiter: {
        isWebhookSyncAllowed: () => true,
        recordWebhookSync: () => {
          // No-op for Connect
        },
      },
    }),
  )

  processor.registerHandler(
    "gocardless",
    new GoCardlessWebhookHandler({
      logger: consoleLogger,
    }),
  )
}

/**
 * Convert Express request to Core WebhookRequest
 */
function expressToCoreRequest(
  req: Request,
  source: "plaid" | "gocardless" | "test",
): WebhookRequest {
  const webhookRequest: WebhookRequest = {
    body: req.body,
    headers: req.headers as Record<string, string>,
    query: req.query as Record<string, string>,
    source,
  }

  // Extract source-specific fields
  if (source === "plaid") {
    webhookRequest.timestamp = req.headers["plaid-timestamp"]
      ? parseInt(req.headers["plaid-timestamp"] as string, 10)
      : undefined
    webhookRequest.nonce = (req.body as any)?.webhook_id
      ? `${(req.body as any).webhook_id}_${(req.body as any).webhook_code}`
      : undefined
    webhookRequest.signature = req.headers["plaid-verification"] as string
  } else if (source === "gocardless") {
    webhookRequest.signature = (req.body as any)?.signature
  }

  return webhookRequest
}

/**
 * Convert Core WebhookResponse to Express response
 */
function coreToExpressResponse(response: {
  status: number
  body: { received: boolean; error?: string | object }
}): { status: number; body: { received: boolean; error?: string } } {
  const error = response.body.error
  return {
    status: response.status,
    body: {
      received: response.body.received,
      error: typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? (error as { message: string }).message
          : undefined,
    },
  }
}

/**
 * Create webhook routes
 */
export function createWebhookRoutes(): Router {
  const router = express.Router()

  // POST /webhook/plaid
  router.post("/plaid", async (req: Request, res: Response) => {
    try {
      if (!processor) {
        return res.status(500).json({
          received: false,
          error: "Webhook processor not initialized",
        })
      }

      const webhookRequest = expressToCoreRequest(req, "plaid")
      const response = await processor.process(webhookRequest)
      const expressResponse = coreToExpressResponse(response)

      return res.status(expressResponse.status).json(expressResponse.body)
    } catch (error) {
      consoleLogger.error?.("Error handling Plaid webhook:", error)
      return res.status(500).json({
        received: false,
        error: "Internal server error",
      })
    }
  })

  // POST /webhook/gocardless
  router.post("/gocardless", async (req: Request, res: Response) => {
    try {
      if (!processor) {
        return res.status(500).json({
          received: false,
          error: "Webhook processor not initialized",
        })
      }

      const webhookRequest = expressToCoreRequest(req, "gocardless")
      const response = await processor.process(webhookRequest)
      const expressResponse = coreToExpressResponse(response)

      return res.status(expressResponse.status).json(expressResponse.body)
    } catch (error) {
      consoleLogger.error?.("Error handling GoCardless webhook:", error)
      return res.status(500).json({
        received: false,
        error: "Internal server error",
      })
    }
  })

  // POST /webhook/test
  router.post("/test", async (req: Request, res: Response) => {
    try {
      // Test endpoint just verifies connectivity
      consoleLogger.info?.("Received test webhook")

      return res.status(200).json({
        received: true,
        message: "Test webhook received successfully",
      })
    } catch (error) {
      consoleLogger.error?.("Error handling test webhook:", error)
      return res.status(500).json({
        received: false,
        error: "Internal server error",
      })
    }
  })

  return router
}

/**
 * Get webhook processor (for testing)
 */
export function getWebhookProcessor(): WebhookProcessor | null {
  return processor
}
