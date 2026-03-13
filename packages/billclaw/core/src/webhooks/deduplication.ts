/**
 * Webhook deduplication cache (P0)
 *
 * File-based deduplication cache for webhook nonce tracking.
 * Uses proper-lockfile for concurrent access safety.
 *
 * Design decisions:
 * - File-based (NOT in-memory) for multi-process safety
 * - TTL-based cleanup to prevent unbounded growth
 * - Uses existing locking infrastructure
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { Logger } from "../errors/errors.js"
import { withLock } from "../storage/locking.js"

/**
 * Deduplication cache data structure
 */
interface DeduplicationCache {
  nonces: Record<string, { expiresAt: number }>
  lastCleanup: number
}

/**
 * Default cache file name
 */
const CACHE_FILE = "webhook-nonces.json"

/**
 * Cleanup interval in milliseconds (5 minutes)
 */
const CLEANUP_INTERVAL = 5 * 60 * 1000

/**
 * Configuration for webhook deduplication
 */
export interface WebhookDeduplicationConfig {
  /**
   * Base directory for cache storage
   */
  basePath: string

  /**
   * Cache file name
   */
  cacheFile?: string

  /**
   * Logger instance
   */
  logger: Logger
}

/**
 * Webhook deduplication cache
 *
 * Tracks processed webhook nonces to prevent duplicate processing.
 * Uses file-based storage with locking for multi-process safety.
 */
export class WebhookDeduplication {
  private readonly cachePath: string
  private readonly lockPath: string
  private readonly logger: Logger
  private cache: DeduplicationCache | null = null

  constructor(config: WebhookDeduplicationConfig) {
    this.cachePath = path.join(
      config.basePath,
      "cache",
      config.cacheFile || CACHE_FILE,
    )
    this.lockPath = `${this.cachePath}.lock`
    this.logger = config.logger
  }

  /**
   * Initialize the deduplication cache
   *
   * Loads existing cache or creates new one.
   */
  async initialize(): Promise<void> {
    await this.ensureCacheDirectory()
    await this.loadCache()
    await this.maybeCleanup()
  }

  /**
   * Check if webhook has been processed
   *
   * @param nonce - Webhook nonce
   * @returns True if already processed
   */
  async isProcessed(nonce: string): Promise<boolean> {
    await this.loadCacheIfNeeded()

    if (!this.cache) {
      return false
    }

    const entry = this.cache.nonces[nonce]
    if (!entry) {
      return false
    }

    // Check if nonce has expired
    if (Date.now() > entry.expiresAt) {
      await this.removeNonce(nonce)
      return false
    }

    return true
  }

  /**
   * Mark webhook as processed
   *
   * @param nonce - Webhook nonce
   * @param ttl - Time-to-live in milliseconds
   */
  async markProcessed(nonce: string, ttl: number): Promise<void> {
    await withLock(this.lockPath, async () => {
      await this.loadCacheIfNeeded()

      if (!this.cache) {
        this.cache = { nonces: {}, lastCleanup: Date.now() }
      }

      this.cache.nonces[nonce] = {
        expiresAt: Date.now() + ttl,
      }

      await this.saveCache()
    }, { logger: this.logger })
  }

  /**
   * Remove a nonce from the cache
   *
   * @param nonce - Nonce to remove
   */
  async removeNonce(nonce: string): Promise<void> {
    await withLock(this.lockPath, async () => {
      await this.loadCacheIfNeeded()

      if (this.cache && this.cache.nonces[nonce]) {
        delete this.cache.nonces[nonce]
        await this.saveCache()
      }
    }, { logger: this.logger })
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<void> {
    await withLock(this.lockPath, async () => {
      await this.loadCacheIfNeeded()

      if (!this.cache) {
        return
      }

      const now = Date.now()
      let removedCount = 0

      for (const nonce in this.cache.nonces) {
        if (now > this.cache.nonces[nonce].expiresAt) {
          delete this.cache.nonces[nonce]
          removedCount++
        }
      }

      if (removedCount > 0) {
        this.logger.debug?.(`Cleaned up ${removedCount} expired nonces`)
      }

      this.cache.lastCleanup = now
      await this.saveCache()
    }, { logger: this.logger })
  }

  /**
   * Ensure cache directory exists
   */
  private async ensureCacheDirectory(): Promise<void> {
    const cacheDir = path.dirname(this.cachePath)
    try {
      await fs.mkdir(cacheDir, { recursive: true })
    } catch (error) {
      this.logger.error?.(`Failed to create cache directory: ${cacheDir}`, error)
      throw error
    }
  }

  /**
   * Load cache from disk
   */
  private async loadCache(): Promise<void> {
    try {
      const data = await fs.readFile(this.cachePath, "utf-8")
      this.cache = JSON.parse(data) as DeduplicationCache
      this.logger.debug?.(`Loaded deduplication cache from ${this.cachePath}`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Cache file doesn't exist, create new cache
        this.cache = { nonces: {}, lastCleanup: Date.now() }
        await this.saveCache()
      } else {
        this.logger.error?.(`Failed to load cache from ${this.cachePath}`, error)
        this.cache = { nonces: {}, lastCleanup: Date.now() }
      }
    }
  }

  /**
   * Save cache to disk
   */
  private async saveCache(): Promise<void> {
    if (!this.cache) {
      return
    }

    try {
      const data = JSON.stringify(this.cache, null, 2)
      await fs.writeFile(this.cachePath, data, "utf-8")
    } catch (error) {
      this.logger.error?.(`Failed to save cache to ${this.cachePath}`, error)
      throw error
    }
  }

  /**
   * Load cache if not already loaded
   */
  private async loadCacheIfNeeded(): Promise<void> {
    if (!this.cache) {
      await this.loadCache()
    }
  }

  /**
   * Run cleanup if needed
   */
  private async maybeCleanup(): Promise<void> {
    if (!this.cache) {
      return
    }

    const now = Date.now()
    if (now - this.cache.lastCleanup > CLEANUP_INTERVAL) {
      await this.cleanup()
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ totalNonces: number; lastCleanup: number }> {
    await this.loadCacheIfNeeded()

    if (!this.cache) {
      return { totalNonces: 0, lastCleanup: 0 }
    }

    return {
      totalNonces: Object.keys(this.cache.nonces).length,
      lastCleanup: this.cache.lastCleanup,
    }
  }
}

/**
 * Create a webhook deduplication instance
 */
export async function createWebhookDeduplication(
  config: WebhookDeduplicationConfig,
): Promise<WebhookDeduplication> {
  const dedup = new WebhookDeduplication(config)
  await dedup.initialize()
  return dedup
}

/**
 * In-memory deduplication cache for testing
 *
 * WARNING: Do not use in production - not multi-process safe.
 */
export class InMemoryWebhookDeduplication {
  private readonly nonces = new Map<string, number>()
  private readonly logger: Logger

  constructor(logger: Logger) {
    this.logger = logger
  }

  async isProcessed(nonce: string): Promise<boolean> {
    const expiresAt = this.nonces.get(nonce)
    if (!expiresAt) {
      return false
    }

    if (Date.now() > expiresAt) {
      this.nonces.delete(nonce)
      return false
    }

    return true
  }

  async markProcessed(nonce: string, ttl: number): Promise<void> {
    this.nonces.set(nonce, Date.now() + ttl)
  }

  async cleanup(): Promise<void> {
    const now = Date.now()
    let removedCount = 0

    for (const [nonce, expiresAt] of this.nonces.entries()) {
      if (now > expiresAt) {
        this.nonces.delete(nonce)
        removedCount++
      }
    }

    if (removedCount > 0) {
      this.logger.debug?.(`Cleaned up ${removedCount} expired nonces`)
    }
  }
}
