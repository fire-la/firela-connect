/**
 * Sync rate limiter (P0)
 *
 * Prevents Plaid API bans from webhook-triggered sync floods.
 * Implements separate rate limit buckets for manual vs webhook-triggered syncs.
 *
 * Design:
 * - Separate rate limit buckets: manual vs webhook-triggered
 * - Circuit breaker to disable webhook syncs when rate limit near
 * - Uses KVStore for multi-instance support (Cloudflare Workers, etc.)
 */

import type { Logger } from "../errors/errors.js"
import type { KVStore } from "../runtime/index.js"

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  requests: number

  /**
   * Time window in milliseconds
   */
  window: number
}

/**
 * Sync rate limiter configuration
 */
export interface SyncRateLimiterConfig {
  /**
   * Rate limit for manual syncs
   */
  manual: RateLimitConfig

  /**
   * Rate limit for webhook-triggered syncs
   */
  webhook: RateLimitConfig

  /**
   * Circuit breaker threshold (0-1)
   * Disable webhook syncs when usage exceeds this ratio
   */
  circuitThreshold?: number

  /**
   * Logger instance
   */
  logger: Logger

  /**
   * KVStore for rate limit state (required for multi-instance support)
   */
  kv: KVStore
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<SyncRateLimiterConfig, "logger" | "kv">> = {
  manual: {
    requests: 10,
    window: 60_000, // 1 minute
  },
  webhook: {
    requests: 3,
    window: 60_000, // 1 minute
  },
  circuitThreshold: 0.8, // 80%
}

/**
 * Rate limit counter stored in KV
 */
interface RateLimitCounter {
  count: number
  windowStart: number
}

/**
 * Circuit breaker state stored in KV
 */
interface CircuitBreakerState {
  open: boolean
  openUntil: number
}

/**
 * Sync rate limiter
 *
 * Tracks sync requests and enforces rate limits separately for
 * manual and webhook-triggered syncs. Uses KVStore for multi-instance
 * support in Cloudflare Workers and other distributed environments.
 */
export class SyncRateLimiter {
  private readonly config: Required<Omit<SyncRateLimiterConfig, "logger" | "kv">>
  private readonly logger: Logger
  private readonly kv: KVStore

  constructor(config: SyncRateLimiterConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.logger = config.logger
    this.kv = config.kv
  }

  /**
   * Record a manual sync request
   *
   * @param accountId - Account ID for the sync
   */
  async recordManualSync(accountId: string): Promise<void> {
    await this.recordRequest("manual", accountId)
  }

  /**
   * Record a webhook-triggered sync request
   *
   * @param accountId - Account ID for the sync
   */
  async recordWebhookSync(accountId: string): Promise<void> {
    await this.recordRequest("webhook", accountId)
  }

  /**
   * Check if webhook sync is allowed
   *
   * @param accountId - Account ID for the sync
   * @returns True if sync is allowed
   */
  async isWebhookSyncAllowed(accountId: string): Promise<boolean> {
    // Check circuit breaker
    if (await this.isCircuitOpen()) {
      this.logger.warn?.(
        `Webhook sync blocked for ${accountId}: circuit breaker open`,
      )
      return false
    }

    // Check rate limit
    const now = Date.now()
    const windowStart = now - this.config.webhook.window

    // Get webhook count from KV
    const key = this.getCounterKey("webhook", accountId)
    const counter = await this.kv.get<RateLimitCounter>(key)

    let webhookCount = 0
    if (counter && counter.windowStart >= windowStart) {
      webhookCount = counter.count
    }

    if (webhookCount >= this.config.webhook.requests) {
      this.logger.warn?.(
        `Webhook sync blocked for ${accountId}: rate limit exceeded (${webhookCount}/${this.config.webhook.requests})`,
      )
      return false
    }

    // Check if we should open circuit breaker (based on combined usage)
    const manualKey = this.getCounterKey("manual", accountId)
    const manualCounter = await this.kv.get<RateLimitCounter>(manualKey)
    let manualCount = 0
    if (manualCounter && manualCounter.windowStart >= windowStart) {
      manualCount = manualCounter.count
    }

    const totalCount = webhookCount + manualCount
    const totalLimit = this.config.manual.requests + this.config.webhook.requests
    const usageRatio = totalCount / totalLimit

    if (usageRatio >= this.config.circuitThreshold) {
      await this.openCircuit()
      this.logger.warn?.(
        `Circuit breaker opened: usage at ${Math.round(usageRatio * 100)}%`,
      )
      return false
    }

    return true
  }

  /**
   * Check if manual sync is allowed
   *
   * @param accountId - Account ID for the sync
   * @returns True if sync is allowed
   */
  async isManualSyncAllowed(accountId: string): Promise<boolean> {
    const now = Date.now()
    const windowStart = now - this.config.manual.window

    // Get manual count from KV
    const key = this.getCounterKey("manual", accountId)
    const counter = await this.kv.get<RateLimitCounter>(key)

    let manualCount = 0
    if (counter && counter.windowStart >= windowStart) {
      manualCount = counter.count
    }

    if (manualCount >= this.config.manual.requests) {
      this.logger.warn?.(
        `Manual sync blocked for ${accountId}: rate limit exceeded (${manualCount}/${this.config.manual.requests})`,
      )
      return false
    }

    return true
  }

  /**
   * Check if circuit breaker is open
   */
  async isCircuitOpen(): Promise<boolean> {
    const key = this.getCircuitBreakerKey()
    const state = await this.kv.get<CircuitBreakerState>(key)

    if (!state || !state.open) {
      return false
    }

    // Check if circuit should close
    if (Date.now() > state.openUntil) {
      await this.closeCircuit()
      return false
    }

    return true
  }

  /**
   * Open circuit breaker
   *
   * Disables webhook syncs for a cooldown period.
   */
  async openCircuit(): Promise<void> {
    const key = this.getCircuitBreakerKey()
    const state: CircuitBreakerState = {
      open: true,
      openUntil: Date.now() + this.config.manual.window, // Open for 1 window period
    }
    await this.kv.set(key, state, { ttl: this.config.manual.window })
  }

  /**
   * Close circuit breaker
   */
  async closeCircuit(): Promise<void> {
    const key = this.getCircuitBreakerKey()
    await this.kv.delete(key)
    this.logger.info?.("Circuit breaker closed")
  }

  /**
   * Get rate limiter statistics
   */
  async getStats(accountId: string): Promise<{
    manualCount: number
    webhookCount: number
    circuitOpen: boolean
    usageRatio: number
  }> {
    const now = Date.now()
    const windowStart = now - this.config.manual.window

    // Get counts from KV
    const manualKey = this.getCounterKey("manual", accountId)
    const webhookKey = this.getCounterKey("webhook", accountId)

    const manualCounter = await this.kv.get<RateLimitCounter>(manualKey)
    const webhookCounter = await this.kv.get<RateLimitCounter>(webhookKey)

    let manualCount = 0
    let webhookCount = 0

    if (manualCounter && manualCounter.windowStart >= windowStart) {
      manualCount = manualCounter.count
    }
    if (webhookCounter && webhookCounter.windowStart >= windowStart) {
      webhookCount = webhookCounter.count
    }

    const totalLimit = this.config.manual.requests + this.config.webhook.requests
    const usageRatio = (manualCount + webhookCount) / totalLimit

    return {
      manualCount,
      webhookCount,
      circuitOpen: await this.isCircuitOpen(),
      usageRatio,
    }
  }

  /**
   * Reset rate limiter for an account (for testing)
   */
  async reset(accountId?: string): Promise<void> {
    if (accountId) {
      // Reset specific account
      await this.kv.delete(this.getCounterKey("manual", accountId))
      await this.kv.delete(this.getCounterKey("webhook", accountId))
    }
    // Reset circuit breaker
    await this.closeCircuit()
  }

  /**
   * Get counter key for KV storage
   */
  private getCounterKey(type: "manual" | "webhook", accountId: string): string {
    return `rate-limit:sync:${type}:${accountId}`
  }

  /**
   * Get circuit breaker key for KV storage
   */
  private getCircuitBreakerKey(): string {
    return "rate-limit:circuit-breaker:global"
  }

  /**
   * Record a request
   */
  private async recordRequest(
    type: "manual" | "webhook",
    accountId: string,
  ): Promise<void> {
    const key = this.getCounterKey(type, accountId)
    const now = Date.now()
    const windowMs =
      type === "manual" ? this.config.manual.window : this.config.webhook.window
    const windowStart = now - windowMs

    // Get current counter
    const existing = await this.kv.get<RateLimitCounter>(key)

    let counter: RateLimitCounter
    if (existing && existing.windowStart >= windowStart) {
      // Within current window, increment
      counter = {
        count: existing.count + 1,
        windowStart: existing.windowStart,
      }
    } else {
      // New window, reset counter
      counter = {
        count: 1,
        windowStart: now,
      }
    }

    // Store with TTL
    await this.kv.set(key, counter, { ttl: windowMs })
  }
}

/**
 * Create a sync rate limiter with configuration
 *
 * @param kv - KVStore instance for rate limit state
 * @param logger - Logger instance
 * @param config - Optional partial configuration
 * @returns SyncRateLimiter instance
 */
export function createSyncRateLimiter(
  kv: KVStore,
  logger: Logger,
  config?: Partial<Omit<SyncRateLimiterConfig, "kv" | "logger">>,
): SyncRateLimiter {
  return new SyncRateLimiter({
    manual: { requests: 10, window: 60_000 },
    webhook: { requests: 3, window: 60_000 },
    circuitThreshold: 0.8,
    kv,
    logger,
    ...config,
  })
}

/**
 * Legacy sync API for backward compatibility
 *
 * @deprecated Use createSyncRateLimiter(kv, logger, config) instead
 */
export interface LegacyRateLimiter {
  isWebhookSyncAllowed(accountId: string): boolean
  recordWebhookSync(accountId: string): void
}

/**
 * Create a legacy-style rate limiter that wraps the async API
 *
 * This is provided for backward compatibility with existing code that
 * expects synchronous rate limiter methods.
 *
 * @deprecated Prefer using SyncRateLimiter directly with async methods
 */
export function createLegacyRateLimiter(
  kv: KVStore,
  logger: Logger,
  config?: Partial<Omit<SyncRateLimiterConfig, "kv" | "logger">>,
): LegacyRateLimiter {
  const limiter = createSyncRateLimiter(kv, logger, config)

  return {
    isWebhookSyncAllowed(_accountId: string): boolean {
      // Synchronous check - use cached/default result
      // Note: This is not ideal but maintains backward compatibility
      logger.warn?.(
        "Legacy synchronous rate limiter used - consider upgrading to async API",
      )
      return true // Allow by default in legacy mode
    },
    recordWebhookSync(accountId: string): void {
      // Fire and forget
      limiter.recordWebhookSync(accountId).catch((err) => {
        logger.error?.(`Failed to record webhook sync:`, err)
      })
    },
  }
}
