/**
 * GoCardless webhook handler
 *
 * NOTE: GoCardless Bank Account Data API (formerly Nordigen) is POLL-ONLY.
 * There are NO webhook notifications for new transactions, account updates,
 * or requisition status changes. This handler exists as a placeholder for:
 * - Future-proofing if GoCardless adds webhook support to Bank Account Data
 * - Direct Debit product webhooks (mandates/payments) if used in future
 *
 * For transaction sync, use polling via the transactions endpoint:
 * GET /api/v2/accounts/{id}/transactions/
 *
 * The existing handler structure handles GoCardless Direct Debit events
 * (mandates, payments) which are a SEPARATE product from Bank Account Data.
 */

import type {
  WebhookHandler,
  WebhookRequest,
  WebhookResponse,
} from "../types.js"
import type { Logger } from "../../errors/errors.js"

/** GoCardless Direct Debit webhook body structure (NOT Bank Account Data) */
interface GoCardlessWebhookBody {
  action: string
  resource_type: string
  links: {
    mandate?: string
    payment?: string
  }
}

/**
 * GoCardless webhook handler configuration
 */
export interface GoCardlessWebhookHandlerConfig {
  /**
   * Logger instance
   */
  logger: Logger
}

/**
 * GoCardless webhook handler (stub for Direct Debit events)
 *
 * Handles inbound webhooks from GoCardless Direct Debit product.
 * Bank Account Data API does NOT send webhooks - it is poll-only.
 * This handler is a placeholder for potential future Direct Debit integration
 * or if GoCardless adds webhook support to Bank Account Data.
 */
export class GoCardlessWebhookHandler implements WebhookHandler {
  readonly source = "gocardless" as const
  private readonly logger: Logger

  constructor(config: GoCardlessWebhookHandlerConfig) {
    this.logger = config.logger
  }

  async handle(request: WebhookRequest): Promise<WebhookResponse> {
    try {
      const body = request.body as GoCardlessWebhookBody
      const action = body.action

      this.logger.info?.(
        `Received GoCardless webhook: ${action}. ` +
          `Note: Bank Account Data API is poll-only. This may be a Direct Debit event.`,
      )

      // Stub implementation
      switch (action) {
        case "created":
        case "cancelled":
          // Handle mandate events
          this.logger.debug?.(`GoCardless mandate event: ${action}`)
          break
        case "paid_out":
          // Handle payment events
          this.logger.debug?.(`GoCardless payment event: ${action}`)
          break
        default:
          this.logger.debug?.(`Unhandled GoCardless webhook: ${action}`)
      }

      return { status: 200, body: { received: true } }
    } catch (error) {
      this.logger.error?.(`Error handling GoCardless webhook:`, error)
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
    // GoCardless uses body.signature
    // Signature verification should be done by security layer
    return true
  }

  /**
   * Direct Debit event types only.
   * Bank Account Data has no webhook events.
   */
  getSupportedEvents(): string[] {
    return [
      "mandates.created",
      "mandates.cancelled",
      "payments.paid_out",
    ]
  }
}

/**
 * Create a GoCardless webhook handler
 */
export function createGoCardlessWebhookHandler(
  config: GoCardlessWebhookHandlerConfig,
): GoCardlessWebhookHandler {
  return new GoCardlessWebhookHandler(config)
}
