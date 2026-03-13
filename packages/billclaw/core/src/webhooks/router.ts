/**
 * Webhook router registry
 *
 * Registry pattern for managing webhook handlers.
 * Provides handler registration and lookup functionality.
 */

import type {
  WebhookRequest,
  WebhookResponse,
  WebhookHandler,
  WebhookSource,
} from "./types.js"
import type { Logger } from "../errors/errors.js"

/**
 * Webhook router options
 */
export interface WebhookRouterOptions {
  /**
   * Logger instance
   */
  logger: Logger
}

/**
 * Webhook router
 *
 * Registry for webhook handlers with routing functionality.
 */
export class WebhookRouter {
  private readonly handlers = new Map<WebhookSource, WebhookHandler>()
  private readonly logger: Logger

  constructor(options: WebhookRouterOptions) {
    this.logger = options.logger
  }

  /**
   * Register a webhook handler for a specific source
   *
   * @param source - Webhook source identifier
   * @param handler - Handler implementation
   */
  register(source: WebhookSource, handler: WebhookHandler): void {
    if (this.handlers.has(source)) {
      this.logger.warn?.(`Handler already registered for ${source}, replacing`)
    }

    this.handlers.set(source, handler)
    this.logger.info?.(`Registered webhook handler for ${source}`)
  }

  /**
   * Unregister a handler for a specific source
   *
   * @param source - Webhook source identifier
   */
  unregister(source: WebhookSource): void {
    if (this.handlers.delete(source)) {
      this.logger.info?.(`Unregistered webhook handler for ${source}`)
    }
  }

  /**
   * Get handler by source
   *
   * @param source - Webhook source identifier
   * @returns Handler or undefined if not found
   */
  getHandler(source: WebhookSource): WebhookHandler | undefined {
    return this.handlers.get(source)
  }

  /**
   * Check if handler is registered for source
   *
   * @param source - Webhook source identifier
   * @returns True if handler exists
   */
  hasHandler(source: WebhookSource): boolean {
    return this.handlers.has(source)
  }

  /**
   * Get all registered sources
   *
   * @returns Array of registered source identifiers
   */
  getSources(): WebhookSource[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Route request to appropriate handler
   *
   * @param request - Webhook request
   * @returns Response from handler or error if not found
   */
  async route(request: WebhookRequest): Promise<WebhookResponse> {
    const handler = this.handlers.get(request.source)

    if (!handler) {
      this.logger.warn?.(`No handler registered for source: ${request.source}`)
      return {
        status: 400,
        body: {
          received: false,
          error: `No handler registered for source: ${request.source}`,
        },
      }
    }

    return handler.handle(request)
  }

  /**
   * Clear all registered handlers
   */
  clear(): void {
    this.handlers.clear()
    this.logger.info?.("Cleared all webhook handlers")
  }

  /**
   * Get number of registered handlers
   */
  get size(): number {
    return this.handlers.size
  }
}

/**
 * Create a webhook router with default configuration
 */
export function createWebhookRouter(logger: Logger): WebhookRouter {
  return new WebhookRouter({ logger })
}
