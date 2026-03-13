/**
 * Tests for SyncRateLimiter with KVStore
 */

import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  SyncRateLimiter,
  createSyncRateLimiter,
  type SyncRateLimiterConfig,
} from "./sync-rate-limiter.js"
import type { KVStore, Logger } from "../runtime/index.js"

/**
 * In-memory KVStore for testing
 */
class TestKVStore implements KVStore {
  private store = new Map<string, { value: unknown; expiresAt?: number }>()

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key)

    if (!entry) {
      return null
    }

    // Check TTL expiration
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    return entry.value as T
  }

  async set<T>(key: string, value: T, options?: { ttl?: number }): Promise<void> {
    const entry: { value: unknown; expiresAt?: number } = { value }

    if (options?.ttl !== undefined) {
      entry.expiresAt = Date.now() + options.ttl
    }

    this.store.set(key, entry)
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key)
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.store.clear()
  }

  /**
   * Get number of entries (for testing)
   */
  get size(): number {
    return this.store.size
  }
}

/**
 * Test logger
 */
const createTestLogger = (): Logger => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
})

describe("SyncRateLimiter", () => {
  let kv: TestKVStore
  let logger: Logger

  beforeEach(() => {
    kv = new TestKVStore()
    logger = createTestLogger()
  })

  describe("basic rate limiting", () => {
    it("should allow webhook sync when under limit", async () => {
      const limiter = createSyncRateLimiter(kv, logger, {
        webhook: { requests: 3, window: 60_000 },
        manual: { requests: 10, window: 60_000 },
      })

      expect(await limiter.isWebhookSyncAllowed("account1")).toBe(true)
      await limiter.recordWebhookSync("account1")
      expect(await limiter.isWebhookSyncAllowed("account1")).toBe(true)
    })

    it("should block webhook sync when limit exceeded", async () => {
      const limiter = createSyncRateLimiter(kv, logger, {
        webhook: { requests: 2, window: 60_000 },
        manual: { requests: 10, window: 60_000 },
      })

      // Record 2 webhook syncs
      await limiter.recordWebhookSync("account1")
      await limiter.recordWebhookSync("account1")

      // Third should be blocked
      expect(await limiter.isWebhookSyncAllowed("account1")).toBe(false)
      expect(logger.warn).toHaveBeenCalled()
    })

    it("should allow manual sync when under limit", async () => {
      const limiter = createSyncRateLimiter(kv, logger, {
        webhook: { requests: 3, window: 60_000 },
        manual: { requests: 5, window: 60_000 },
      })

      expect(await limiter.isManualSyncAllowed("account1")).toBe(true)
      await limiter.recordManualSync("account1")
      expect(await limiter.isManualSyncAllowed("account1")).toBe(true)
    })

    it("should block manual sync when limit exceeded", async () => {
      const limiter = createSyncRateLimiter(kv, logger, {
        webhook: { requests: 3, window: 60_000 },
        manual: { requests: 2, window: 60_000 },
      })

      // Record 2 manual syncs
      await limiter.recordManualSync("account1")
      await limiter.recordManualSync("account1")

      // Third should be blocked
      expect(await limiter.isManualSyncAllowed("account1")).toBe(false)
    })
  })

  describe("per-account rate limiting", () => {
    it("should track rate limits per account independently", async () => {
      const limiter = createSyncRateLimiter(kv, logger, {
        webhook: { requests: 2, window: 60_000 },
        manual: { requests: 10, window: 60_000 },
      })

      // Account 1 uses up its limit
      await limiter.recordWebhookSync("account1")
      await limiter.recordWebhookSync("account1")
      expect(await limiter.isWebhookSyncAllowed("account1")).toBe(false)

      // Account 2 should still be allowed
      expect(await limiter.isWebhookSyncAllowed("account2")).toBe(true)
    })
  })

  describe("circuit breaker", () => {
    it("should open circuit breaker when usage exceeds threshold", async () => {
      const limiter = createSyncRateLimiter(kv, logger, {
        webhook: { requests: 5, window: 60_000 },
        manual: { requests: 5, window: 60_000 },
        circuitThreshold: 0.5, // 50% threshold
      })

      // Record 5 manual syncs (50% of total capacity)
      for (let i = 0; i < 5; i++) {
        await limiter.recordManualSync("account1")
      }

      // Next webhook check should open circuit (total usage > 50%)
      const allowed = await limiter.isWebhookSyncAllowed("account1")
      expect(allowed).toBe(false)
      expect(await limiter.isCircuitOpen()).toBe(true)
    })

    it("should close circuit breaker after cooldown", async () => {
      const limiter = createSyncRateLimiter(kv, logger, {
        webhook: { requests: 5, window: 100 }, // 100ms window for fast test
        manual: { requests: 5, window: 100 },
        circuitThreshold: 0.5,
      })

      // Open the circuit
      await limiter.openCircuit()
      expect(await limiter.isCircuitOpen()).toBe(true)

      // Wait for cooldown (window duration)
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Circuit should be closed now
      expect(await limiter.isCircuitOpen()).toBe(false)
    })
  })

  describe("TTL expiration", () => {
    it("should reset counter after window expires", async () => {
      const limiter = createSyncRateLimiter(kv, logger, {
        webhook: { requests: 2, window: 100 }, // 100ms window for fast test
        manual: { requests: 10, window: 100 },
      })

      // Use up the limit
      await limiter.recordWebhookSync("account1")
      await limiter.recordWebhookSync("account1")
      expect(await limiter.isWebhookSyncAllowed("account1")).toBe(false)

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      // Should be allowed again
      expect(await limiter.isWebhookSyncAllowed("account1")).toBe(true)
    })

    it("should store counters with TTL", async () => {
      const limiter = createSyncRateLimiter(kv, logger, {
        webhook: { requests: 5, window: 5000 },
        manual: { requests: 10, window: 5000 },
      })

      await limiter.recordWebhookSync("account1")

      // Verify data was stored in KV
      const key = "rate-limit:sync:webhook:account1"
      const counter = await kv.get<{ count: number; windowStart: number }>(key)
      expect(counter).not.toBeNull()
      expect(counter!.count).toBe(1)
    })
  })

  describe("stats", () => {
    it("should return accurate stats", async () => {
      const limiter = createSyncRateLimiter(kv, logger, {
        webhook: { requests: 5, window: 60_000 },
        manual: { requests: 10, window: 60_000 },
      })

      await limiter.recordManualSync("account1")
      await limiter.recordManualSync("account1")
      await limiter.recordWebhookSync("account1")

      const stats = await limiter.getStats("account1")
      expect(stats.manualCount).toBe(2)
      expect(stats.webhookCount).toBe(1)
      expect(stats.circuitOpen).toBe(false)
      expect(stats.usageRatio).toBeCloseTo(3 / 15) // 3 requests out of 15 total capacity
    })
  })

  describe("reset", () => {
    it("should reset rate limiter state", async () => {
      const limiter = createSyncRateLimiter(kv, logger, {
        webhook: { requests: 2, window: 60_000 },
        manual: { requests: 10, window: 60_000 },
      })

      // Use up the limit
      await limiter.recordWebhookSync("account1")
      await limiter.recordWebhookSync("account1")
      expect(await limiter.isWebhookSyncAllowed("account1")).toBe(false)

      // Reset
      await limiter.reset("account1")

      // Should be allowed again
      expect(await limiter.isWebhookSyncAllowed("account1")).toBe(true)
    })
  })
})

describe("createSyncRateLimiter", () => {
  it("should create limiter with default config", async () => {
    const kv = new TestKVStore()
    const logger = createTestLogger()

    const limiter = createSyncRateLimiter(kv, logger)

    // Default webhook limit is 3
    await limiter.recordWebhookSync("account1")
    await limiter.recordWebhookSync("account1")
    await limiter.recordWebhookSync("account1")

    expect(await limiter.isWebhookSyncAllowed("account1")).toBe(false)
  })

  it("should merge custom config with defaults", async () => {
    const kv = new TestKVStore()
    const logger = createTestLogger()

    const limiter = createSyncRateLimiter(kv, logger, {
      webhook: { requests: 1, window: 60_000 },
    })

    await limiter.recordWebhookSync("account1")
    expect(await limiter.isWebhookSyncAllowed("account1")).toBe(false)
  })
})
