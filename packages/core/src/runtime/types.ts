/**
 * Runtime abstractions for BillClaw
 *
 * These interfaces define the contracts that adapters (OpenClaw, CLI, etc.)
 * must implement to provide framework-specific functionality to the core.
 */

import type { Logger } from "../errors/errors.js"
export type { Logger } from "../errors/errors.js"

/**
 * KVStore - Key-value storage for rate limiting, session, and caching
 *
 * This interface is compatible with @firela/runtime-adapters KVStore.
 * Implementations:
 * - Cloudflare: KVNamespace binding (via CloudflareKVStore)
 * - Node.js: MemoryKVStore / SQLite
 *
 * @example
 * ```typescript
 * // Store rate limit counter with TTL
 * await kv.set('rate-limit:account1', { count: 5 }, { ttl: 60000 }) // 1 minute
 *
 * // Retrieve counter
 * const counter = await kv.get<{ count: number }>('rate-limit:account1')
 * ```
 */
export interface KVStore {
  /**
   * Get a value by key
   * @param key - The key to retrieve
   * @returns The value or null if not found or expired
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
import type { BillclawConfig, StorageConfig } from "../models/config.js"
export type { BillclawConfig, StorageConfig } from "../models/config.js"
import type { StorageAdapter } from "../storage/types.js"
export type { StorageAdapter } from "../storage/types.js"

/**
 * Configuration provider - loads and provides configuration
 */
export interface ConfigProvider {
  /**
   * Get the full BillClaw configuration
   */
  getConfig(): Promise<BillclawConfig>

  /**
   * Get the storage configuration
   */
  getStorageConfig(): Promise<StorageConfig>

  /**
   * Update a specific account configuration
   */
  updateAccount(accountId: string, updates: Partial<any>): Promise<void>

  /**
   * Get account configuration by ID
   */
  getAccount(accountId: string): Promise<any | null>

  /**
   * Update configuration
   *
   * Merges updates with existing config and saves atomically.
   * This is needed for updating nested configuration like connect.receiver.relay credentials.
   */
  updateConfig(updates: Partial<BillclawConfig>): Promise<void>
}

/**
 * Event emitter - emits events for synchronization and monitoring
 */
export interface EventEmitter {
  /**
   * Emit an event
   */
  emit(event: string, data?: unknown): void

  /**
   * Register an event listener
   */
  on(event: string, handler: (data?: unknown) => void): void

  /**
   * Remove an event listener
   */
  off(event: string, handler: (data?: unknown) => void): void
}

/**
 * Runtime context - provides all framework-specific functionality
 */
export interface RuntimeContext {
  /**
   * Logger for output
   */
  logger: Logger

  /**
   * Configuration provider
   */
  config: ConfigProvider

  /**
   * Event emitter
   */
  events?: EventEmitter

  /**
   * Storage adapter for data persistence
   *
   * If not provided, core throws a clear error for storage-dependent operations.
   * Adapters (CLI, OpenClaw) choose appropriate implementation:
   * - CLI: Uses FileStorageAdapter by default
   * - Workers: Uses D1StorageAdapter explicitly
   */
  storage?: StorageAdapter

  /**
   * Platform-specific utilities
   */
  platform?: {
    /**
     * Get the home directory
     */
    getHomeDir(): string

    /**
     * Get the data directory
     */
    getDataDir(): string

    /**
     * Open a URL in the browser
     */
    openUrl(url: string): Promise<void>
  }
}

/**
 * Default console logger implementation
 */
export class ConsoleLogger implements Logger {
  info(...args: unknown[]): void {
    console.log("[INFO]", ...args)
  }

  error(...args: unknown[]): void {
    console.error("[ERROR]", ...args)
  }

  warn(...args: unknown[]): void {
    console.warn("[WARN]", ...args)
  }

  debug(...args: unknown[]): void {
    if (process.env.DEBUG) {
      console.debug("[DEBUG]", ...args)
    }
  }
}

/**
 * In-memory event emitter implementation
 */
export class MemoryEventEmitter implements EventEmitter {
  private listeners = new Map<string, Set<(data?: unknown) => void>>()

  emit(event: string, data?: unknown): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data)
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error)
        }
      }
    }
  }

  on(event: string, handler: (data?: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: (data?: unknown) => void): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }
}

/**
 * Simple in-memory config provider
 */
export class MemoryConfigProvider implements ConfigProvider {
  constructor(private config: BillclawConfig) {}

  async getConfig(): Promise<BillclawConfig> {
    return this.config
  }

  async getStorageConfig(): Promise<StorageConfig> {
    return (
      this.config.storage || {
        path: "~/.billclaw",
        format: "json",
        encryption: { enabled: false },
      }
    )
  }

  async updateAccount(accountId: string, updates: Partial<any>): Promise<void> {
    const account = this.config.accounts.find((a) => a.id === accountId)
    if (account) {
      Object.assign(account, updates)
    }
  }

  async getAccount(accountId: string): Promise<any | null> {
    return this.config.accounts.find((a) => a.id === accountId) || null
  }

  async updateConfig(updates: Partial<BillclawConfig>): Promise<void> {
    // Deep merge for nested objects
    this.config = this.deepMerge(this.config, updates)
  }

  private deepMerge(base: any, source: any): any {
    const result = { ...base }
    for (const key of Object.keys(source)) {
      if (
        source[key] !== null &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key]) &&
        key in result &&
        result[key] !== null &&
        typeof result[key] === "object" &&
        !Array.isArray(result[key])
      ) {
        result[key] = this.deepMerge(result[key], source[key])
      } else {
        result[key] = source[key]
      }
    }
    return result
  }
}
