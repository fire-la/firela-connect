/**
 * Node.js Runtime Adapter
 *
 * Provides RuntimeAdapter implementation for Node.js environment:
 * - In-memory Map for KVStore (MemoryKVStore)
 * - Node.js crypto module for CryptoAdapter
 * - Console for Logger
 */

import crypto from 'node:crypto'
import type { KVStore, CryptoAdapter, Logger, RuntimeAdapter } from './types.js'

/**
 * MemoryKVStore - In-memory KVStore implementation
 *
 * Stores values in a Map with optional TTL support.
 * Note: Data is not persisted and is lost on process restart.
 */
export class MemoryKVStore implements KVStore {
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
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this.store.clear()
  }

  /**
   * Get number of entries (useful for testing)
   */
  get size(): number {
    return this.store.size
  }
}

/**
 * NodeCryptoAdapter - Node.js crypto module implementation
 *
 * Uses the built-in node:crypto module for cryptographic operations.
 */
export class NodeCryptoAdapter implements CryptoAdapter {
  async hmacSha256(data: string, secret: string): Promise<string> {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(data)
    return hmac.digest('base64')
  }

  randomBytes(length: number): Uint8Array {
    return crypto.randomBytes(length)
  }
}

/**
 * ConsoleLogger - Console-based logger for Node.js
 */
export class ConsoleLogger implements Logger {
  debug(...args: unknown[]): void {
    console.debug(...args)
  }

  info(...args: unknown[]): void {
    console.info(...args)
  }

  warn(...args: unknown[]): void {
    console.warn(...args)
  }

  error(...args: unknown[]): void {
    console.error(...args)
  }
}

/**
 * Create a RuntimeAdapter for Node.js
 *
 * @param kv - Optional KVStore instance (defaults to MemoryKVStore)
 * @param logger - Optional Logger instance (defaults to ConsoleLogger)
 * @returns RuntimeAdapter instance configured for Node.js
 *
 * @example
 * ```typescript
 * import { createNodeAdapter, MemoryKVStore } from '@firela/runtime-adapters/node'
 *
 * // Create adapter with default in-memory KV store
 * const adapter = createNodeAdapter()
 *
 * // Or with custom KV store
 * const customKV = new MemoryKVStore()
 * const adapter = createNodeAdapter({ kv: customKV })
 *
 * // Use KV store
 * await adapter.kv.set('session:abc', { userId: 'user1' }, { ttl: 3600000 })
 *
 * // Use crypto
 * const signature = await adapter.crypto.hmacSha256('payload', 'secret')
 * ```
 */
export function createNodeAdapter(options?: {
  kv?: KVStore
  logger?: Logger
}): RuntimeAdapter {
  return {
    kv: options?.kv ?? new MemoryKVStore(),
    logger: options?.logger ?? new ConsoleLogger(),
    platform: 'node',
    crypto: new NodeCryptoAdapter(),
  }
}

// Re-export types for convenience
export type { KVStore, CryptoAdapter, Logger, RuntimeAdapter } from './types.js'
