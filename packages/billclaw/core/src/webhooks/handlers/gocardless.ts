/**
 * GoCardless webhook handler
 *
 * Processes webhooks from GoCardless:
 * - mandate events (created, cancelled)
 * - payment events (paid_out)
 *
 * NOTE: This is a stub implementation for future use.
 */

import type {
  WebhookHandler,
  WebhookRequest,
  WebhookResponse,
} from "../types.js"
import type { Logger } from "../../errors/errors.js"

/**
 * GoCardless webhook body structure
 */
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
 * GoCardless webhook handler (stub)
 *
 * Handles inbound webhooks from GoCardless.
 * This is a placeholder implementation for future use.
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

      this.logger.info?.(`Received GoCardless webhook: ${action}`)

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
