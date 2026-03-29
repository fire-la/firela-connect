/**
 * Cloudflare Workers Runtime Adapter
 *
 * Provides RuntimeAdapter implementation for Cloudflare Workers environment:
 * - KVNamespace for KVStore
 * - Web Crypto API for CryptoAdapter
 * - Console for Logger
 */

import type { KVStore, CryptoAdapter, Logger, RuntimeAdapter } from './types.js'

/**
 * CloudflareKVStore - KVNamespace wrapper implementing KVStore interface
 *
 * Uses Cloudflare KV for persistent storage with TTL support.
 */
export class CloudflareKVStore implements KVStore {
  constructor(private kv: KVNamespace) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.kv.get(key, 'json')
    return value as T | null
  }

  async set<T>(key: string, value: T, options?: { ttl?: number }): Promise<void> {
    if (options?.ttl !== undefined) {
      // Convert ms to seconds for Cloudflare KV expirationTtl
      const expirationTtl = Math.floor(options.ttl / 1000)
      await this.kv.put(key, JSON.stringify(value), { expirationTtl })
    } else {
      await this.kv.put(key, JSON.stringify(value))
    }
  }

  async delete(key: string): Promise<boolean> {
    // Cloudflare KV delete doesn't return whether key existed
    // We check first to provide consistent interface
    const exists = await this.kv.get(key) !== null
    await this.kv.delete(key)
    return exists
  }
}

/**
 * CloudflareCryptoAdapter - Web Crypto API implementation
 *
 * Uses the Web Crypto API available in Cloudflare Workers.
 */
export class CloudflareCryptoAdapter implements CryptoAdapter {
  async hmacSha256(data: string, secret: string): Promise<string> {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)

    // Import the secret key
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    // Sign the data
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(data)
    )

    // Convert to base64
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
  }

  randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    return bytes
  }
}

/**
 * ConsoleLogger - Console-based logger for Cloudflare Workers
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
 * Cloudflare environment bindings type
 *
 * Extend this interface to include your specific bindings.
 */
export interface CloudflareEnv {
  /** Cloudflare KV namespace binding */
  KV?: KVNamespace
}

/**
 * Create a RuntimeAdapter for Cloudflare Workers
 *
 * @param env - Cloudflare environment bindings (includes KV namespace)
 * @param kvNamespace - Optional KV namespace name (defaults to 'KV')
 * @returns RuntimeAdapter instance configured for Cloudflare Workers
 *
 * @example
 * ```typescript
 * import { createCloudflareAdapter } from '@firela/runtime-adapters/cloudflare'
 *
 * export default {
 *   async fetch(request, env, ctx) {
 *     const adapter = createCloudflareAdapter(env)
 *
 *     // Use KV store
 *     await adapter.kv.set('session:abc', { userId: 'user1' }, { ttl: 3600000 })
 *
 *     // Use crypto
 *     const signature = await adapter.crypto.hmacSha256('payload', 'secret')
 *
 *     return new Response('OK')
 *   }
 * }
 * ```
 */
export function createCloudflareAdapter(
  env: CloudflareEnv,
  kvNamespace: string = 'KV'
): RuntimeAdapter {
  // Get KV namespace from env
  const kv = env[kvNamespace as keyof CloudflareEnv]

  if (!kv) {
    throw new Error(`KV namespace '${kvNamespace}' not found in environment bindings`)
  }

  return {
    kv: new CloudflareKVStore(kv as KVNamespace),
    logger: new ConsoleLogger(),
    platform: 'cloudflare',
    crypto: new CloudflareCryptoAdapter(),
  }
}

// Re-export types for convenience
export type { KVStore, CryptoAdapter, Logger, RuntimeAdapter } from './types.js'
