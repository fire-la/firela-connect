/**
 * Webhook processor interface
 *
 * Main interface for processing inbound webhooks from various sources.
 */

import type { Logger } from "../errors/errors.js"
import type {
  WebhookRequest,
  WebhookResponse,
  WebhookHandler,
  WebhookErrorResponse,
} from "./types.js"
import type { WebhookSecurity } from "./security.js"

/**
 * Webhook processor options
 */
export interface WebhookProcessorOptions {
  /**
   * Logger instance
   */
  logger: Logger

  /**
   * Webhook secret for signature verification
   */
  webhookSecret?: string

  /**
   * Security layer for replay protection and signature verification
   */
  security?: WebhookSecurity
}

/**
 * Webhook processor
 *
 * Main entry point for processing inbound webhooks.
 * Routes requests to appropriate handlers and applies security checks.
 */
export class WebhookProcessor {
  private readonly handlers = new Map<string, WebhookHandler>()
  private readonly logger: Logger
  private readonly webhookSecret?: string
  private readonly security?: WebhookSecurity

  constructor(options: WebhookProcessorOptions) {
    this.logger = options.logger
    this.webhookSecret = options.webhookSecret
    this.security = options.security
  }

  /**
   * Register a webhook handler for a specific source
   *
   * @param source - Webhook source identifier
   * @param handler - Handler implementation
   */
  registerHandler(source: string, handler: WebhookHandler): void {
    this.handlers.set(source, handler)
    this.logger.info?.(`Registered webhook handler for source: ${source}`)
  }

  /**
   * Process incoming webhook request
   *
   * Applies security checks and routes to appropriate handler.
   *
   * @param request - Normalized webhook request
   * @returns Processing response
   */
  async process(request: WebhookRequest): Promise<WebhookResponse> {
    try {
      // Security: Replay protection
      if (this.security && request.timestamp && request.nonce) {
        const isValid = await this.security.validateReplayProtection(
          request.timestamp,
          request.nonce,
        )
        if (!isValid) {
          return this.createErrorResponse("REPLAY_DETECTED", 401, "Replay detected", false)
        }
      }

      // Security: Signature verification
      if (this.security && request.signature && this.webhookSecret) {
        const payload = JSON.stringify(request.body)
        const isValid = this.security.verifySignature(
          payload,
          request.signature,
          this.webhookSecret,
        )
        if (!isValid) {
          return this.createErrorResponse("INVALID_SIGNATURE", 401, "Invalid signature", false)
        }
      }

      // Get handler for source
      const handler = this.handlers.get(request.source)
      if (!handler) {
        this.logger.warn?.(`No handler registered for source: ${request.source}`)
        return this.createErrorResponse(
          "INTERNAL_ERROR",
          400,
          `No handler for source: ${request.source}`,
          false,
        )
      }

      // Process with handler
      this.logger.debug?.(`Processing webhook from ${request.source}`)
      const response = await handler.handle(request)

      return response
    } catch (error) {
      this.logger.error?.(`Error processing webhook from ${request.source}:`, error)
      return this.createErrorResponse(
        "INTERNAL_ERROR",
        500,
        error instanceof Error ? error.message : "Unknown error",
        true,
      )
    }
  }

  /**
   * Get registered handler by source
   *
   * @param source - Webhook source identifier
   * @returns Handler or undefined if not found
   */
  getHandler(source: string): WebhookHandler | undefined {
    return this.handlers.get(source)
  }

  /**
   * Get all registered handlers
   *
   * @returns Map of source to handler
   */
  getAllHandlers(): Map<string, WebhookHandler> {
    return new Map(this.handlers)
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    code: string,
    status: number,
    message: string,
    retryable: boolean,
  ): WebhookErrorResponse {
    return {
      status,
      body: {
        received: false,
        error: {
          code,
          message,
          retryable,
        },
      },
    }
  }
}

/**
 * Create a webhook processor with default configuration
 */
export function createWebhookProcessor(
  logger: Logger,
  options?: Partial<WebhookProcessorOptions>,
): WebhookProcessor {
  return new WebhookProcessor({
    logger,
    ...options,
  })
}
