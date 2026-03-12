/**
 * RuntimeAdapter Types - Platform-agnostic runtime abstraction
 *
 * This module defines interfaces for abstracting platform-specific capabilities
 * across different runtime environments (Cloudflare Workers, Node.js, Vercel, etc.)
 *
 * ## Design Decisions (Expert Review 2026-03-12)
 *
 * 1. **RuntimeAdapter vs RuntimeContext** - These are independent interfaces:
 *    - RuntimeAdapter: Platform capabilities (kv, crypto) - for Workers
 *    - RuntimeContext: Application context (config, storage, events) - for CLI/OpenClaw
 *
 * 2. **No SQLDatabase interface** - Existing StorageAdapter satisfies business needs
 *
 * 3. **KVStore usage** - For session, rate limit counter, cache
 */

/**
 * Logger interface - Platform-agnostic logging
 *
 * Implementations:
 * - Cloudflare: console (native)
 * - Node.js: console or pino/winston
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

/**
 * KVStore - Key-value storage for session, rate limiting, and caching
 *
 * Implementations:
 * - Cloudflare: KVNamespace binding
 * - Node.js: MemoryKVStore / SQLite
 * - Vercel/Netlify: Upstash Redis
 *
 * @example
 * ```typescript
 * // Store session with TTL
 * await kv.set('session:abc123', { userId: 'user1' }, { ttl: 3600000 }) // 1 hour
 *
 * // Retrieve session
 * const session = await kv.get<{ userId: string }>('session:abc123')
 *
 * // Delete session
 * await kv.delete('session:abc123')
 * ```
 */
export interface KVStore {
  /**
   * Get a value by key
   * @param key - The key to retrieve
   * @returns The value or null if not found
   */
  get<T = unknown>(key: string): Promise<T | null>

  /**
   * Set a value with optional TTL
   * @param key - The key to set
   * @param value - The value to store
   * @param options - Optional settings including TTL in milliseconds
   */
  set<T>(key: string, value: T, options?: { ttl?: number }): Promise<void>

  /**
   * Delete a key
   * @param key - The key to delete
   * @returns true if the key existed and was deleted
   */
  delete(key: string): Promise<boolean>
}

/**
 * CryptoAdapter - Platform-agnostic cryptographic capabilities
 *
 * Implementations:
 * - Cloudflare: Web Crypto API
 * - Node.js: node:crypto module
 *
 * @example
 * ```typescript
 * // HMAC for webhook signature verification
 * const signature = await crypto.hmacSha256(payload, secret)
 *
 * // Generate random bytes for session IDs
 * const sessionId = crypto.randomBytes(16)
 * ```
 */
export interface CryptoAdapter {
  /**
   * Compute HMAC-SHA256
   * @param data - The data to sign
   * @param secret - The secret key
   * @returns Base64-encoded signature
   */
  hmacSha256(data: string, secret: string): Promise<string>

  /**
   * Generate cryptographically secure random bytes
   * @param length - Number of bytes to generate
   * @returns Uint8Array of random bytes
   */
  randomBytes(length: number): Uint8Array
}

/**
 * RuntimeAdapter - Platform abstraction for Worker environments
 *
 * This interface abstracts platform-specific capabilities for Cloudflare Workers,
 * Vercel Edge Functions, Netlify Edge Functions, and similar edge runtimes.
 *
 * Note: CLI/OpenClaw continue using RuntimeContext (includes config, platform.openUrl).
 * The two interfaces are independent and serve different purposes:
 * - RuntimeAdapter: Platform capabilities (kv, crypto)
 * - RuntimeContext: Application context (config, storage, events)
 *
 * @example
 * ```typescript
 * // In Cloudflare Worker
 * import { createCloudflareAdapter } from '@firela/runtime-adapters/cloudflare'
 *
 * export default {
 *   async fetch(request, env) {
 *     const adapter = createCloudflareAdapter(env)
 *     await adapter.kv.set('key', 'value')
 *     return new Response('OK')
 *   }
 * }
 * ```
 */
export interface RuntimeAdapter {
  /** Key-value store for session, rate limiting, and cache */
  readonly kv: KVStore

  /** Logger instance */
  readonly logger: Logger

  /** Platform identifier */
  readonly platform: 'cloudflare' | 'node' | 'vercel' | 'netlify'

  /** Cryptographic utilities */
  readonly crypto: CryptoAdapter
}
