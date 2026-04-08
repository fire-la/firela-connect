/**
 * Shared Server Cache
 *
 * Module-level MemoryCache instance for Workers environment.
 * Used by API routes to cache KV reads and by cache management endpoints
 * for statistics and clearing.
 *
 * Workers isolate model: cache persists within a single isolate but not
 * across isolates. Effective for repeated requests hitting the same isolate.
 */

import { MemoryCache } from "@firela/billclaw-core/storage"

/**
 * Shared cache instance for all UI server routes.
 *
 * TTL of 30 seconds balances freshness with KV read reduction.
 * Max 200 entries covers accounts, config, and sync states.
 */
export const serverCache = new MemoryCache({
  defaultTtl: 30_000, // 30 seconds
  maxSize: 200,
})

/**
 * Cache key generators for UI server KV data
 */
export const CacheKeys = {
  config: "kv:billclaw:config",
  accounts: "kv:billclaw:accounts",
  syncStatus: (id: string) => `kv:sync:${id}`,
} as const
