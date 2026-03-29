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
import * as jose from "jose"
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

/**
 * Cached JWK entry for Plaid webhook verification
 */
interface CachedJWK {
  key: jose.JWK
  expiresAt: number | null
  fetchedAt: number
}

/** JWK cache TTL: 1 hour */
const JWK_CACHE_TTL = 60 * 60 * 1000

/**
 * Plaid webhook verifier using ES256 JWT with JWK
 *
 * Verifies Plaid webhook signatures using:
 * 1. ES256 JWT from Plaid-Verification header
 * 2. JWK fetched from Plaid's verification key endpoint
 * 3. SHA-256 body hash comparison (request_body_sha256 claim)
 * 4. Timing-safe comparison to prevent timing attacks
 *
 * JWK caching:
 * - Caches fetched keys with 1-hour TTL
 * - Respects expired_at from key response
 * - Re-fetches when kid changes or cache expires
 */
export class PlaidWebhookVerifier {
  private cachedKey: CachedJWK | null = null
  private readonly logger: Logger
  private readonly fetchVerificationKey: (
    kid: string,
  ) => Promise<{ key: jose.JWK }>

  constructor(
    logger: Logger,
    fetchVerificationKey: (kid: string) => Promise<{ key: jose.JWK }>,
  ) {
    this.logger = logger
    this.fetchVerificationKey = fetchVerificationKey
  }

  /**
   * Verify a Plaid webhook JWT against raw body
   *
   * @param rawBody - Raw request body string
   * @param verificationHeader - Plaid-Verification header value (JWT)
   * @returns True if verification passes, false otherwise
   */
  async verify(rawBody: string, verificationHeader: string): Promise<boolean> {
    try {
      // Decode JWT header to extract kid and alg
      const protectedHeader = jose.decodeProtectedHeader(verificationHeader)
      const kid = (protectedHeader as Record<string, unknown>)?.kid as
        | string
        | undefined
      const alg = (protectedHeader as Record<string, unknown>)?.alg as
        | string
        | undefined

      if (alg !== "ES256" || !kid) {
        this.logger.warn?.(
          `Invalid Plaid JWT: alg=${alg}, kid=${kid ?? "missing"}`,
        )
        return false
      }

      // Fetch and cache JWK
      const jwk = await this.getOrFetchKey(kid)
      const publicKey = await jose.importJWK(jwk, "ES256")

      // Verify JWT signature and claims (maxTokenAge rejects stale JWTs)
      const { payload } = await jose.jwtVerify(
        verificationHeader,
        publicKey,
        { maxTokenAge: "5m" },
      )

      // Extract claimed body hash
      const claimedHash = (payload as Record<string, unknown>)
        .request_body_sha256 as string | undefined

      if (!claimedHash) {
        this.logger.warn?.("Plaid JWT missing request_body_sha256 claim")
        return false
      }

      // Compute actual body hash
      const bodyHash = crypto
        .createHash("sha256")
        .update(rawBody)
        .digest("hex")

      // Timing-safe comparison of hex hashes
      return crypto.timingSafeEqual(
        Buffer.from(bodyHash, "hex"),
        Buffer.from(claimedHash, "hex"),
      )
    } catch (error) {
      this.logger.error?.("Plaid webhook verification failed:", error)
      return false
    }
  }

  /**
   * Get cached JWK or fetch a new one
   *
   * Cache invalidation:
   * - kid changes: re-fetch
   * - expired_at from key response exceeded: re-fetch
   * - fetchedAt + JWK_CACHE_TTL exceeded: re-fetch
   */
  private async getOrFetchKey(kid: string): Promise<jose.JWK> {
    // Check cache validity
    if (this.cachedKey) {
      const now = Date.now()
      const isExpired =
        this.cachedKey.expiresAt !== null &&
        now > this.cachedKey.expiresAt * 1000
      const isStale = now - this.cachedKey.fetchedAt > JWK_CACHE_TTL

      if (!isExpired && !isStale) {
        const cachedKid = (this.cachedKey.key as Record<string, unknown>)
          .kid as string | undefined
        if (cachedKid === kid) {
          return this.cachedKey.key
        }
      }
    }

    // Fetch fresh key
    const response = await this.fetchVerificationKey(kid)
    const key = response.key
    const expiredAt = (key as Record<string, unknown>).expired_at as
      | number
      | undefined

    this.cachedKey = {
      key,
      expiresAt: expiredAt ?? null,
      fetchedAt: Date.now(),
    }
    return key
  }
}

