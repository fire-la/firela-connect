/**
 * Webhook security layer (P0)
 *
 * Provides replay attack protection, signature verification, and
 * rate limiting coordination for inbound webhooks.
 *
 * Security features:
 * - Replay attack protection using timestamp + nonce validation
 * - HMAC-SHA256 signature verification with timing-safe comparison
 * - Rate limiting coordination
 */

import * as crypto from "node:crypto"
import type { Logger } from "../errors/errors.js"
import type { WebhookDeduplication } from "./deduplication.js"

/**
 * Configuration for webhook security
 */
export interface WebhookSecurityConfig {
  /**
   * Maximum allowed timestamp age in milliseconds
   * Default: 15 minutes
   */
  maxTimestampAge?: number

  /**
   * Future timestamp tolerance in milliseconds
   * Default: 5 minutes (to handle clock skew)
   */
  futureTimestampTolerance?: number

  /**
   * Deduplication cache for nonce tracking
   */
  deduplication: WebhookDeduplication

  /**
   * Logger instance
   */
  logger: Logger
}

/**
 * Default configuration values
 */
const DEFAULT_MAX_TIMESTAMP_AGE = 15 * 60 * 1000 // 15 minutes
const DEFAULT_FUTURE_TOLERANCE = 5 * 60 * 1000 // 5 minutes

/**
 * Webhook security layer
 *
 * Provides P0 security features for webhook processing.
 */
export class WebhookSecurity {
  private readonly maxTimestampAge: number
  private readonly futureTolerance: number
  private readonly deduplication: WebhookDeduplication
  private readonly logger: Logger

  constructor(config: WebhookSecurityConfig) {
    this.maxTimestampAge = config.maxTimestampAge ?? DEFAULT_MAX_TIMESTAMP_AGE
    this.futureTolerance = config.futureTimestampTolerance ?? DEFAULT_FUTURE_TOLERANCE
    this.deduplication = config.deduplication
    this.logger = config.logger
  }

  /**
   * Validate replay protection (timestamp + nonce)
   *
   * Checks that:
   * 1. Timestamp is within valid range (not too old, not too far in future)
   * 2. Nonce has not been used before
   *
   * @param timestamp - Webhook timestamp (Unix milliseconds)
   * @param nonce - Unique webhook identifier
   * @returns True if valid, false if replay detected
   */
  async validateReplayProtection(
    timestamp: number | undefined,
    nonce: string | undefined,
  ): Promise<boolean> {
    const now = Date.now()

    // Check if timestamp is provided
    if (timestamp === undefined) {
      this.logger.debug?.("Webhook missing timestamp")
      return false
    }

    // Check if nonce is provided
    if (nonce === undefined) {
      this.logger.debug?.("Webhook missing nonce")
      return false
    }

    // Check timestamp is not too old
    if (now - timestamp > this.maxTimestampAge) {
      this.logger.warn?.(
        `Webhook rejected: timestamp too old (${now - timestamp}ms ago)`,
      )
      return false
    }

    // Check timestamp is not too far in future (allow clock skew)
    if (timestamp - now > this.futureTolerance) {
      this.logger.warn?.(
        `Webhook rejected: timestamp too far in future (${timestamp - now}ms)`,
      )
      return false
    }

    // Check nonce has not been used before
    const isProcessed = await this.deduplication.isProcessed(nonce)
    if (isProcessed) {
      this.logger.warn?.(`Webhook rejected: nonce already used (${nonce})`)
      return false
    }

    // Mark nonce as processed
    await this.deduplication.markProcessed(nonce, 60_000) // 60 second TTL

    return true
  }

  /**
   * Verify webhook signature
   *
   * Uses timing-safe comparison to prevent timing attacks.
   *
   * @param payload - Request payload (stringified JSON)
   * @param signature - Signature to verify (format: "sha256=<hex>")
   * @param secret - Webhook secret key
   * @returns True if signature is valid
   */
  verifySignature(
    payload: string,
    signature: string | undefined,
    secret: string,
  ): boolean {
    if (!signature) {
      this.logger.debug?.("Webhook missing signature")
      return false
    }

    try {
      // Compute expected signature
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex")

      // Extract provided signature (remove "sha256=" prefix if present)
      const providedSignature = signature.replace(/^sha256=/i, "")

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(providedSignature),
      )
    } catch (error) {
      this.logger.error?.("Signature verification failed:", error)
      return false
    }
  }

  /**
   * Generate HMAC-SHA256 signature for testing
   *
   * @param payload - Payload to sign
   * @param secret - Secret key for HMAC
   * @returns Signature in format "sha256=<hex>"
   */
  generateSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac("sha256", secret)
    hmac.update(payload)
    return `sha256=${hmac.digest("hex")}`
  }

  /**
   * Create a nonce for testing
   *
   * @returns Unique nonce string
   */
  generateNonce(): string {
    return `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }
}

/**
 * Create a webhook security instance with default configuration
 */
export function createWebhookSecurity(
  deduplication: WebhookDeduplication,
  logger: Logger,
): WebhookSecurity {
  return new WebhookSecurity({
    deduplication,
    logger,
  })
}

