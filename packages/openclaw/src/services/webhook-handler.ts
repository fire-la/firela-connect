/**
 * Webhook handlers for BillClaw OpenClaw plugin
 *
 * This module provides HTTP route handlers for receiving webhooks from
 * external services (Plaid, GoCardless, etc.) using the Core webhook layer.
 *
 * P0 Security Features:
 * - Replay attack protection (timestamp + nonce validation)
 * - Rate limiting (per-IP fixed-window)
 * - Signature verification
 *
 * P1 Error Handling:
 * - Sync failures emit sync.failed event
 * - Retry logic with exponential backoff (3 retries)
 */

import type { OpenClawPluginApi } from "../types/openclaw-plugin.js"
import {
  WebhookProcessor,
  createWebhookSecurity,
  createWebhookDeduplication,
  createSyncRateLimiter,
  PlaidWebhookHandler,
  GoCardlessWebhookHandler,
  type WebhookRequest,
} from "@firela/billclaw-core"
import { emitEvent, emitSyncFailed, type WebhookEventType } from "@firela/billclaw-core"
import { MemoryKVStore } from "@firela/runtime-adapters/node"

/**
 * Dependencies for webhook handlers
 */
interface WebhookHandlerDependencies {
  api: OpenClawPluginApi
  plaidWebhookSecret?: string
  // gocardlessWebhookSecret reserved for future use
  // gocardlessWebhookSecret?: string
}

// Global state
let api: OpenClawPluginApi | null = null
let configWebhooks: any[] = []
let plaidWebhookSecret: string | undefined
// gocardlessWebhookSecret reserved for future use
// let gocardlessWebhookSecret: string | undefined

// Core components
let processor: WebhookProcessor | null = null
let rateLimiter: ReturnType<typeof createSyncRateLimiter> | null = null

// Rate limit state (simple fixed-window per IP)
interface RateLimitEntry {
  count: number
  resetTime: number
}
const rateLimitMap = new Map<string, RateLimitEntry>()

// Rate limit configuration
const RATE_LIMITS = {
  plaid: { requests: 100, window: 60_000 }, // 100/min
  gocardless: { requests: 50, window: 60_000 }, // 50/min
  test: { requests: 30, window: 60_000 }, // 30/min
}

/**
 * Convert OpenClaw logger to BillClaw Logger interface
 */
function toLogger(
  logger: OpenClawPluginApi["logger"] | undefined,
): {
  info: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
} {
  const log = logger?.info || (() => {})
  const logError = logger?.error || (() => {})
  const logWarn = logger?.warn || (() => console.warn)
  const logDebug = logger?.debug || (() => {})

  return {
    info: log,
    error: logError,
    warn: logWarn,
    debug: logDebug,
  }
}

/**
 * Check rate limit for a source and IP
 */
function checkRateLimit(
  source: keyof typeof RATE_LIMITS,
  ip: string,
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const key = `${source}:${ip}`
  const limit = RATE_LIMITS[source]

  let entry = rateLimitMap.get(key)

  // Reset if window expired
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + limit.window }
    rateLimitMap.set(key, entry)
  }

  // Check if exceeded
  if (entry.count >= limit.requests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
    return { allowed: false, retryAfter }
  }

  // Increment counter
  entry.count++
  return { allowed: true }
}

/**
 * Register webhook handlers with OpenClaw HTTP routes
 */
export async function registerWebhookHandlers(
  dependencies: WebhookHandlerDependencies,
): Promise<void> {
  api = dependencies.api
  plaidWebhookSecret = dependencies.plaidWebhookSecret
  // gocardlessWebhookSecret reserved for future use
  // gocardlessWebhookSecret = dependencies.gocardlessWebhookSecret

  // Get webhooks from config
  const pluginConfig = api.pluginConfig as any
  configWebhooks = pluginConfig?.webhooks || []

  const logger = toLogger(api.logger)

  // Initialize Core components
  const storageBase = pluginConfig?.storage?.path || "~/.firela/billclaw"
  const basePath = storageBase.startsWith("~")
    ? storageBase.replace("~", process.env.HOME || "")
    : storageBase

  // Create deduplication cache
  const deduplication = await createWebhookDeduplication({
    basePath,
    logger,
  })

  // Create security layer
  const security = createWebhookSecurity(deduplication, logger)

  // Create rate limiter with KVStore for multi-instance support
  const kv = new MemoryKVStore()
  rateLimiter = createSyncRateLimiter(kv, logger)

  // Create processor
  processor = new WebhookProcessor({
    logger,
    webhookSecret: plaidWebhookSecret,
    security,
  })

  // Register handlers
  processor.registerHandler(
    "plaid",
    new PlaidWebhookHandler({
      logger,
      findAccountByItemId: async (itemId: string) => {
        const accounts = pluginConfig?.accounts || []
        return accounts.find(
          (acc: any) =>
            acc.type === "plaid" && acc.plaidItemId === itemId && acc.enabled,
        )
      },
      triggerSync: async (accountId: string) => {
        const { plaidSyncTool } = await import("../tools/index.js")

        // P1: Retry logic with exponential backoff
        let lastError: Error | null = null
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await plaidSyncTool.execute(api!, { accountId })
            return
          } catch (error) {
            lastError = error as Error
            if (attempt < 2) {
              // Exponential backoff: 1s, 2s, 4s
              const delay = 2 ** attempt * 1000
              await new Promise((resolve) => setTimeout(resolve, delay))
            }
          }
        }

        // All retries failed - emit sync.failed event (P1)
        logger.error?.(`Webhook-triggered sync failed for ${accountId}:`, lastError)
        await emitSyncFailed(
          logger,
          configWebhooks,
          accountId,
          `webhook_${Date.now()}`,
          lastError?.message || "Unknown error",
        ).catch((err) => logger.debug?.(`Event emission failed:`, err))
        throw lastError
      },
      emitEvent: async (eventType: string, data: unknown) => {
        await emitEvent(logger, configWebhooks, eventType as WebhookEventType, data)
      },
      webhooks: configWebhooks,
      rateLimiter: {
        isWebhookSyncAllowed: async (accountId: string) => {
          if (!rateLimiter) return true
          return rateLimiter.isWebhookSyncAllowed(accountId)
        },
        recordWebhookSync: async (accountId: string) => {
          if (!rateLimiter) return
          await rateLimiter.recordWebhookSync(accountId)
        },
      },
    }),
  )

  processor.registerHandler(
    "gocardless",
    new GoCardlessWebhookHandler({
      logger,
    }),
  )

  // Register HTTP routes
  api.logger.info?.("billclaw webhook handler registered with Core layer")

  api.http?.register({
    path: "/webhook/plaid",
    method: "POST",
    description: "Plaid webhook handler",
    handler: handlePlaidWebhook,
  })

  api.http?.register({
    path: "/webhook/gocardless",
    method: "POST",
    description: "GoCardless webhook handler",
    handler: handleGoCardlessWebhook,
  })

  api.http?.register({
    path: "/webhook/test",
    method: "POST",
    description: "Test webhook endpoint",
    handler: handleTestWebhook,
  })
}

/**
 * Get client IP from request
 */
function getClientIp(request: {
  headers: Record<string, string>
  query: Record<string, string>
}): string {
  // Check for forwarded IP (proxy/load balancer)
  const forwarded = request.headers["x-forwarded-for"]
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }

  // Check for real IP header
  const realIp = request.headers["x-real-ip"]
  if (realIp) {
    return realIp
  }

  // Fallback to query param or default
  return request.query.ip || "unknown"
}

/**
 * Handle Plaid webhook
 *
 * Applies rate limiting and delegates to Core processor.
 */
async function handlePlaidWebhook(request: {
  body: unknown
  headers: Record<string, string>
  query: Record<string, string>
}): Promise<{ status: number; body: { received: boolean; error?: string } }> {
  try {
    const ip = getClientIp(request)

    // P0: Rate limiting check
    const rateLimit = checkRateLimit("plaid", ip)
    if (!rateLimit.allowed) {
      api?.logger.warn?.(`Rate limit exceeded for Plaid webhook from ${ip}`)
      return {
        status: 429,
        body: {
          received: false,
          error: `Rate limit exceeded. Retry after ${rateLimit.retryAfter} seconds`,
        },
      }
    }

    if (!processor) {
      return {
        status: 500,
        body: { received: false, error: "Webhook processor not initialized" },
      }
    }

    // Normalize request to Core format
    const webhookRequest: WebhookRequest = {
      body: request.body,
      headers: request.headers,
      query: request.query,
      source: "plaid",
      timestamp: request.headers["plaid-timestamp"]
        ? parseInt(request.headers["plaid-timestamp"], 10)
        : undefined,
      nonce: (request.body as any).webhook_id
        ? `${(request.body as any).webhook_id}_${(request.body as any).webhook_code}`
        : undefined,
      signature: request.headers["plaid-verification"],
    }

    // Process with Core
    const response = await processor.process(webhookRequest)

    // Convert Core response to OpenClaw format
    return {
      status: response.status,
      body: {
        received: response.body.received,
        error: typeof response.body.error === "string"
          ? response.body.error
          : response.body.error?.message || response.body.error?.code,
      },
    }
  } catch (error) {
    api?.logger.error?.(`Error handling Plaid webhook:`, error)
    return {
      status: 500,
      body: { received: false, error: "Internal server error" },
    }
  }
}

/**
 * Handle GoCardless webhook
 *
 * Applies rate limiting and delegates to Core processor.
 */
async function handleGoCardlessWebhook(request: {
  body: unknown
  headers: Record<string, string>
  query: Record<string, string>
}): Promise<{ status: number; body: { received: boolean; error?: string } }> {
  try {
    const ip = getClientIp(request)

    // P0: Rate limiting check
    const rateLimit = checkRateLimit("gocardless", ip)
    if (!rateLimit.allowed) {
      api?.logger.warn?.(`Rate limit exceeded for GoCardless webhook from ${ip}`)
      return {
        status: 429,
        body: {
          received: false,
          error: `Rate limit exceeded. Retry after ${rateLimit.retryAfter} seconds`,
        },
      }
    }

    if (!processor) {
      return {
        status: 500,
        body: { received: false, error: "Webhook processor not initialized" },
      }
    }

    // Normalize request to Core format
    const webhookRequest: WebhookRequest = {
      body: request.body,
      headers: request.headers,
      query: request.query,
      source: "gocardless",
      // GoCardless doesn't provide timestamp/nonce in standard format
      // Signature is in body.signature
      signature: (request.body as any)?.signature,
    }

    // Process with Core
    const response = await processor.process(webhookRequest)

    // Convert Core response to OpenClaw format
    return {
      status: response.status,
      body: {
        received: response.body.received,
        error: typeof response.body.error === "string"
          ? response.body.error
          : response.body.error?.message || response.body.error?.code,
      },
    }
  } catch (error) {
    api?.logger.error?.(`Error handling GoCardless webhook:`, error)
    return {
      status: 500,
      body: { received: false, error: "Internal server error" },
    }
  }
}

/**
 * Handle test webhook
 *
 * Sends a test event to all configured webhooks.
 */
async function handleTestWebhook(_request: {
  body: unknown
  headers: Record<string, string>
  query: Record<string, string>
}): Promise<{ status: number; body: { sent: boolean; error?: string } }> {
  try {
    const ip = getClientIp(_request)

    // P0: Rate limiting check
    const rateLimit = checkRateLimit("test", ip)
    if (!rateLimit.allowed) {
      api?.logger.warn?.(`Rate limit exceeded for test webhook from ${ip}`)
      return {
        status: 429,
        body: {
          sent: false,
          error: `Rate limit exceeded. Retry after ${rateLimit.retryAfter} seconds`,
        },
      }
    }

    api?.logger.info?.("Received test webhook request")

    // Emit test event to all configured webhooks
    await emitEvent(
      toLogger(api!.logger),
      configWebhooks,
      "webhook.test" as WebhookEventType,
      {
        message: "Test webhook from BillClaw",
        triggeredBy: "user",
      },
    )

    return { status: 200, body: { sent: true } }
  } catch (error) {
    api?.logger.error?.(`Error handling test webhook:`, error)
    return {
      status: 500,
      body: { sent: false, error: "Internal server error" },
    }
  }
}

/**
 * Cleanup rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}
