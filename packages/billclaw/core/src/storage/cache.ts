/**
 * Memory cache for BillClaw
 *
 * Provides TTL-based caching for frequently accessed data:
 * - Account configurations
 * - Transaction summaries
 * - Sync states
 * - User preferences
 *
 * This improves performance by reducing disk I/O for commonly accessed data.
 */

import type { Logger } from "../errors/errors.js"

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
  value: T
  expiresAt: number
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  defaultTtl: number // Default TTL in milliseconds
  maxSize: number // Maximum number of entries
  logger?: Logger
}

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  defaultTtl: 5 * 60 * 1000, // 5 minutes
  maxSize: 1000,
}

/**
 * In-memory cache with TTL support
 *
 * Workers-compatible: Timer is lazily initialized on first cache operation,
 * not in constructor. This avoids global scope violations in Cloudflare Workers.
 */
export class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private config: CacheConfig
  private cleanupTimer?: ReturnType<typeof setInterval>
  private timerStarted = false

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config }
    // Timer is NOT started here - it's started lazily on first use
    // This makes the class safe to instantiate in Workers global scope
  }

  /**
   * Start the cleanup timer (lazy initialization)
   *
   * Only called on first cache operation to avoid Workers global scope violations.
   * In Workers, setInterval is not allowed in global scope but is allowed
   * within request handlers. By deferring timer start until first use,
   * we ensure the timer is only started when the cache is actually used
   * during request handling.
   */
  private startCleanupTimer(): void {
    if (this.timerStarted) {
      return
    }
    this.timerStarted = true

    // Periodically clean up expired entries
    // Only start timer if setInterval is available (not in all Workers environments)
    if (typeof setInterval !== "undefined") {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpired()
      }, 60 * 1000) // Every minute
    }
  }

  /**
   * Set a value in the cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds (uses default if not specified)
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // Lazy initialize timer on first use
    this.startCleanupTimer()

    const expiresAt = Date.now() + (ttl ?? this.config.defaultTtl)

    // Enforce max size by removing oldest entries if needed
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictOldest()
    }

    this.cache.set(key, { value, expiresAt })
    this.config.logger?.debug?.(
      `Cache set: ${key} (TTL: ${ttl ?? this.config.defaultTtl}ms)`,
    )
  }

  /**
   * Get a value from the cache
   *
   * @param key - Cache key
   * @returns The cached value, or null if not found or expired
   */
  get<T,>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired (use >= to handle TTL of 0)
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key)
      this.config.logger?.debug?.(`Cache miss (expired): ${key}`)
      return null
    }

    this.config.logger?.debug?.(`Cache hit: ${key}`)
    return entry.value as T
  }

  /**
   * Check if a key exists and is not expired
   *
   * @param key - Cache key
   * @returns true if the key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)

    if (!entry) {
      return false
    }

    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete a value from the cache
   *
   * @param key - Cache key
   * @returns true if the key was deleted
   */
  delete(key: string): boolean {
    this.config.logger?.debug?.(`Cache delete: ${key}`)
    return this.cache.delete(key)
  }

  /**
   * Clear all values from the cache
   */
  clear(): void {
    this.cache.clear()
    this.config.logger?.info?.("Cache cleared")
  }

  /**
   * Get the number of entries in the cache
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.config.logger?.debug?.(
        `Cache cleanup: removed ${cleaned} expired entries`,
      )
    }
  }

  /**
   * Evict the oldest entry (LRU-style eviction)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < oldestTime) {
        oldestTime = entry.expiresAt
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.config.logger?.debug?.(`Cache evicted (oldest): ${oldestKey}`)
    }
  }

  /**
   * Destroy the cache and cleanup timers
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
    this.clear()
  }
}

/**
 * Cache key generators for common data types
 */
export const CacheKeys = {
  /**
   * Account configuration cache key
   */
  account(accountId: string): string {
    return `account:${accountId}`
  },

  /**
   * Transaction list cache key
   */
  transactions(accountId: string, year: number, month: number): string {
    return `transactions:${accountId}:${year}:${month}`
  },

  /**
   * Sync state cache key
   */
  syncState(accountId: string): string {
    return `sync_state:${accountId}`
  },

  /**
   * Plaid balance cache key
   */
  plaidBalance(accountId: string): string {
    return `plaid_balance:${accountId}`
  },

  /**
   * Gmail history cache key
   */
  gmailHistory(accountId: string): string {
    return `gmail_history:${accountId}`
  },
}

/**
 * Create a memory cache with the given configuration
 */
export function createMemoryCache(config?: Partial<CacheConfig>): MemoryCache {
  return new MemoryCache(config)
}

/**
 * Cached data wrapper - provides memoization for expensive operations
 */
export class CachedData<T> {
  private cache: MemoryCache
  private key: string
  private ttl: number
  private fetchFn: () => Promise<T>

  constructor(
    cache: MemoryCache,
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number,
  ) {
    this.cache = cache
    this.key = key
    this.ttl = ttl ?? cache["config"].defaultTtl
    this.fetchFn = fetchFn
  }

  /**
   * Get the cached value, or fetch if not cached
   */
  async get(): Promise<T> {
    const cached = this.cache.get<T>(this.key)

    if (cached !== null) {
      return cached
    }

    const value = await this.fetchFn()
    this.cache.set(this.key, value, this.ttl)
    return value
  }

  /**
   * Invalidate the cache
   */
  invalidate(): void {
    this.cache.delete(this.key)
  }

  /**
   * Set a specific value in the cache
   */
  set(value: T): void {
    this.cache.set(this.key, value, this.ttl)
  }
}
