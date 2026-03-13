/**
 * Gmail webhook handler (stub)
 *
 * Processes webhooks from Gmail via Cloud Pub/Sub.
 *
 * NOTE: This is a placeholder implementation for future use.
 * Gmail uses Cloud Pub/Sub for push notifications, which requires
 * additional infrastructure not yet implemented.
 */

import type {
  WebhookHandler,
  WebhookRequest,
  WebhookResponse,
} from "../types.js"
import type { Logger } from "../../errors/errors.js"

/**
 * Gmail webhook handler configuration
 */
export interface GmailWebhookHandlerConfig {
  /**
   * Logger instance
   */
  logger: Logger
}

/**
 * Gmail webhook handler (stub)
 *
 * Handles inbound webhooks from Gmail via Cloud Pub/Sub.
 * This is a placeholder implementation for future use.
 */
export class GmailWebhookHandler implements WebhookHandler {
  readonly source = "gmail" as const
  private readonly logger: Logger

  constructor(config: GmailWebhookHandlerConfig) {
    this.logger = config.logger
  }

  async handle(_request: WebhookRequest): Promise<WebhookResponse> {
    try {
      this.logger.info?.(`Received Gmail webhook`)

      // Stub implementation
      // Gmail uses Cloud Pub/Sub for notifications
      // This would require Pub/Sub subscription handling

      this.logger.debug?.(`Gmail webhook handler is not yet implemented`)

      return { status: 200, body: { received: true } }
    } catch (error) {
      this.logger.error?.(`Error handling Gmail webhook:`, error)
      return {
        status: 500,
        body: {
          received: false,
          error: error instanceof Error ? error.message : "Internal server error",
        },
      }
    }
  }

  verify(): boolean {
    // Gmail uses Pub/Sub authentication
    return true
  }

  getSupportedEvents(): string[] {
    return []
  }
}

/**
 * Create a Gmail webhook handler
 */
export function createGmailWebhookHandler(
  config: GmailWebhookHandlerConfig,
): GmailWebhookHandler {
  return new GmailWebhookHandler(config)
}
