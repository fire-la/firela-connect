/**
 * Plaid webhook handler
 *
 * Processes webhooks from Plaid:
 * - TRANSACTIONS.SYNC_UPDATES_AVAILABLE: Trigger sync for the item
 * - ITEM.ERROR: Emit account error event
 * - ITEM.LOGIN_REQUIRED: Notify user to re-authenticate
 */

import type {
  WebhookHandler,
  WebhookRequest,
  WebhookResponse,
} from "../types.js"
import type { Logger } from "../../errors/errors.js"
import { emitSyncStarted, emitAccountError } from "../../services/event-emitter.js"

/**
 * Plaid webhook body structure
 */
interface PlaidWebhookBody {
  webhook_type: string
  webhook_code: string
  item_id: string
  error?: {
    error_code: string
    error_message: string
  }
}

/**
 * Rate limiter interface for Plaid webhook handler
 *
 * Supports both synchronous and asynchronous implementations.
 * For multi-instance support (Cloudflare Workers), use async methods.
 */
export interface PlaidRateLimiter {
  /**
   * Check if webhook sync is allowed
   * @returns true if sync is allowed, false if rate limited
   */
  isWebhookSyncAllowed(accountId: string): boolean | Promise<boolean>

  /**
   * Record a webhook-triggered sync
   */
  recordWebhookSync(accountId: string): void | Promise<void>
}

/**
 * Plaid webhook handler configuration
 */
export interface PlaidWebhookHandlerConfig {
  /**
   * Logger instance
   */
  logger: Logger

  /**
   * Find account by Plaid item ID
   */
  findAccountByItemId: (itemId: string) => Promise<any | null>

  /**
   * Trigger sync for an account
   */
  triggerSync?: (accountId: string) => Promise<void>

  /**
   * Emit events to configured webhook endpoints
   */
  emitEvent?: (eventType: string, data: unknown) => Promise<void>

  /**
   * Webhook configurations for event emission
   */
  webhooks?: any[]

  /**
   * Rate limiter for sync operations
   *
   * Supports both sync and async implementations for backward compatibility.
   */
  rateLimiter?: PlaidRateLimiter
}

/**
 * Plaid webhook handler
 *
 * Handles inbound webhooks from Plaid.
 */
export class PlaidWebhookHandler implements WebhookHandler {
  readonly source = "plaid" as const
  private readonly logger: Logger
  private readonly findAccountByItemId: (itemId: string) => Promise<any | null>
  private readonly triggerSync?: (accountId: string) => Promise<void>
  private readonly emitEvent?: (eventType: string, data: unknown) => Promise<void>
  private readonly webhooks?: any[]
  private readonly rateLimiter?: PlaidRateLimiter

  constructor(config: PlaidWebhookHandlerConfig) {
    this.logger = config.logger
    this.findAccountByItemId = config.findAccountByItemId
    this.triggerSync = config.triggerSync
    this.emitEvent = config.emitEvent
    this.webhooks = config.webhooks
    this.rateLimiter = config.rateLimiter
  }

  async handle(request: WebhookRequest): Promise<WebhookResponse> {
    try {
      const body = request.body as PlaidWebhookBody
      const webhookType = body.webhook_type
      const webhookCode = body.webhook_code
      const itemId = body.item_id

      this.logger.info?.(
        `Received Plaid webhook: ${webhookType}.${webhookCode} for item ${itemId}`,
      )

      switch (webhookType) {
        case "TRANSACTIONS":
          if (webhookCode === "SYNC_UPDATES_AVAILABLE") {
            return this.handleSyncUpdatesAvailable(itemId)
          }
          break

        case "ITEM":
          if (webhookCode === "ERROR" || webhookCode === "LOGIN_REQUIRED") {
            return this.handleItemError(body)
          }
          break

        default:
          this.logger.debug?.(`Unhandled Plaid webhook: ${webhookType}.${webhookCode}`)
      }

      return { status: 200, body: { received: true } }
    } catch (error) {
      this.logger.error?.(`Error handling Plaid webhook:`, error)
      return {
        status: 500,
        body: {
          received: false,
          error: error instanceof Error ? error.message : "Internal server error",
        },
      }
    }
  }

  verify(_request: WebhookRequest, _secret: string): boolean {
    // Plaid uses headers: plaid-verification, plaid-timestamp
    // Signature verification should be done by security layer
    return true
  }

  getSupportedEvents(): string[] {
    return [
      "TRANSACTIONS.SYNC_UPDATES_AVAILABLE",
      "ITEM.ERROR",
      "ITEM.LOGIN_REQUIRED",
    ]
  }

  /**
   * Handle SYNC_UPDATES_AVAILABLE webhook
   */
  private async handleSyncUpdatesAvailable(itemId: string): Promise<WebhookResponse> {
    try {
      // Find account associated with this item
      const account = await this.findAccountByItemId(itemId)

      if (!account) {
        this.logger.warn?.(`No account found for Plaid item: ${itemId}`)
        return { status: 200, body: { received: true, processed: false } }
      }

      if (!account.enabled) {
        this.logger.debug?.(`Account ${account.id} is disabled, skipping sync`)
        return { status: 200, body: { received: true, processed: false } }
      }

      // Check rate limiter
      if (this.rateLimiter) {
        const allowed = await this.rateLimiter.isWebhookSyncAllowed(account.id)
        if (!allowed) {
          this.logger.warn?.(
            `Webhook-triggered sync blocked for ${account.id}: rate limit exceeded`,
          )
          return {
            status: 429,
            body: {
              received: true,
              processed: false,
              error: "Rate limit exceeded",
            },
          }
        }
        await this.rateLimiter.recordWebhookSync(account.id)
      }

      // Emit sync started event
      const syncId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      if (this.emitEvent) {
        await emitSyncStarted(this.logger, this.webhooks || [], account.id, syncId)
      }

      // Trigger async sync (don't wait for completion)
      if (this.triggerSync) {
        this.triggerSync(account.id).catch((error) => {
          this.logger.error?.(`Webhook-triggered sync failed for ${account.id}:`, error)
          // P1: Emit sync.failed event
          if (this.emitEvent) {
            emitAccountError(
              this.logger,
              this.webhooks || [],
              account.id,
              "plaid",
              error instanceof Error ? error.message : String(error),
            ).catch((err) => this.logger.debug?.(`Event emission failed:`, err))
          }
        })
      }

      return { status: 200, body: { received: true, processed: true } }
    } catch (error) {
      this.logger.error?.(`Error handling SYNC_UPDATES_AVAILABLE:`, error)
      return {
        status: 500,
        body: {
          received: false,
          error: error instanceof Error ? error.message : "Internal server error",
        },
      }
    }
  }

  /**
   * Handle ITEM.ERROR or ITEM.LOGIN_REQUIRED webhook
   */
  private async handleItemError(body: PlaidWebhookBody): Promise<WebhookResponse> {
    try {
      const error = body.error ?? {
        error_code: body.webhook_code,
        error_message: "Item login required",
      }

      this.logger.warn?.(
        `Plaid item error for ${body.item_id}: ${error.error_code} - ${error.error_message}`,
      )

      // Emit account error event
      if (this.emitEvent) {
        await emitAccountError(
          this.logger,
          this.webhooks || [],
          body.item_id,
          "plaid",
          JSON.stringify(error),
        )
      }

      return { status: 200, body: { received: true } }
    } catch (error) {
      this.logger.error?.(`Error handling item error:`, error)
      return {
        status: 500,
        body: {
          received: false,
          error: error instanceof Error ? error.message : "Internal server error",
        },
      }
    }
  }
}

/**
 * Create a Plaid webhook handler
 */
export function createPlaidWebhookHandler(
  config: PlaidWebhookHandlerConfig,
): PlaidWebhookHandler {
  return new PlaidWebhookHandler(config)
}
