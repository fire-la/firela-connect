/**
 * Unified configuration manager for BillClaw
 *
 * Provides thread-safe configuration management with:
 * - Singleton pattern
 * - File locking for concurrent access
 * - Hybrid caching (TTL + mtime validation)
 * - Environment variable overrides
 * - Schema validation
 *
 * @packageDocumentation
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import { z } from "zod"

import type { Logger } from "../errors/errors.js"
import { BillclawConfigSchema, type BillclawConfig } from "../models/config.js"
import type { ConfigProvider, StorageConfig } from "../runtime/types.js"
import { withLock } from "../storage/locking.js"
import { MemoryCache } from "../storage/cache.js"
import { loadEnvOverrides } from "./env-loader.js"

/**
 * ConfigManager options
 */
export interface ConfigManagerOptions {
  /**
   * Config file path (defaults to ~/.billclaw/config.json)
   */
  configPath?: string

  /**
   * Cache TTL in milliseconds (defaults to 5 minutes)
   */
  cacheTtl?: number

  /**
   * Logger for debug output
   */
  logger?: Logger

  /**
   * Whether to enable environment variable overrides
   */
  enableEnvOverrides?: boolean
}

/**
 * Cached config entry with mtime for invalidation
 */
interface CachedConfig {
  config: BillclawConfig
  mtime: number
  envOverrides: Record<string, unknown>
}

/**
 * Default config path
 */
function getDefaultConfigPath(): string {
  return path.join(os.homedir(), ".firela", "billclaw", "config.json")
}

/**
 * Unified configuration manager
 *
 * Implements the ConfigProvider interface with additional functionality
 * for environment variable overrides and cache management.
 */
export class ConfigManager implements ConfigProvider {
  private static instance: ConfigManager

  private configPath: string
  private cache: MemoryCache
  private cacheKey: string
  private cacheTtl: number
  private logger?: Logger
  private enableEnvOverrides: boolean

  private constructor(options: ConfigManagerOptions = {}) {
    this.configPath = options.configPath ?? getDefaultConfigPath()
    this.cacheTtl = options.cacheTtl ?? 5 * 60 * 1000 // 5 minutes
    this.logger = options.logger
    this.enableEnvOverrides = options.enableEnvOverrides ?? true

    // Create cache with configured TTL
    this.cache = new MemoryCache({
      defaultTtl: this.cacheTtl,
      maxSize: 100,
      logger: this.logger,
    })

    // Use config file path as cache key
    this.cacheKey = `config:${this.configPath}`
  }

  /**
   * Get the singleton ConfigManager instance
   *
   * @param options - Options (only applied on first call)
   * @returns The singleton instance
   */
  static getInstance(options?: ConfigManagerOptions): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager(options)
    }
    return ConfigManager.instance
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  static resetInstance(): void {
    if (ConfigManager.instance) {
      ConfigManager.instance["cache"]?.destroy()
      ConfigManager.instance = undefined as unknown as ConfigManager
    }
  }

  /**
   * Get the full configuration
   *
   * Implements ConfigProvider interface with caching and mtime validation.
   */
  async getConfig(): Promise<BillclawConfig> {
    const cached = this.cache.get<CachedConfig>(this.cacheKey)

    // Get current file mtime
    let currentMtime = 0
    try {
      const stats = await fs.stat(this.configPath)
      currentMtime = stats.mtimeMs
    } catch {
      // File doesn't exist yet, will use default config
    }

    // Check if cache is valid (mtime matches)
    if (cached && cached.mtime === currentMtime) {
      this.logger?.debug("ConfigManager: using cached config")
      return cached.config
    }

    // Cache miss or invalidated, reload from file
    this.logger?.debug("ConfigManager: reloading config from file")
    const config = await this.loadConfigFromFile()
    const envOverrides = this.enableEnvOverrides ? loadEnvOverrides() : {}

    // Update cache with mtime
    this.cache.set(this.cacheKey, { config, mtime: currentMtime, envOverrides }, this.cacheTtl)

    return config
  }

  /**
   * Get effective configuration with environment variable overrides
   *
   * Returns config with env vars merged in (env vars take precedence).
   */
  async getEffectiveConfig(): Promise<BillclawConfig> {
    const cached = this.cache.get<CachedConfig>(this.cacheKey)

    // Get current file mtime
    let currentMtime = 0
    try {
      const stats = await fs.stat(this.configPath)
      currentMtime = stats.mtimeMs
    } catch {
      // File doesn't exist yet
    }

    // Check if cache is valid
    if (cached && cached.mtime === currentMtime) {
      // Merge env overrides
      if (this.enableEnvOverrides && Object.keys(cached.envOverrides).length > 0) {
        return this.deepMerge(cached.config, cached.envOverrides)
      }
      return cached.config
    }

    // Reload
    const config = await this.loadConfigFromFile()
    const envOverrides = this.enableEnvOverrides ? loadEnvOverrides() : {}

    this.cache.set(this.cacheKey, { config, mtime: currentMtime, envOverrides }, this.cacheTtl)

    // Return merged config
    if (Object.keys(envOverrides).length > 0) {
      return this.deepMerge(config, envOverrides)
    }
    return config
  }

  /**
   * Get storage configuration
   */
  async getStorageConfig(): Promise<StorageConfig> {
    const config = await this.getConfig()
    return config.storage
  }

  /**
   * Update an account configuration
   */
  async updateAccount(accountId: string, updates: Partial<any>): Promise<void> {
    const config = await this.getConfig()

    const accountIndex = config.accounts.findIndex((a) => a.id === accountId)
    if (accountIndex === -1) {
      throw new Error(`Account ${accountId} not found`)
    }

    config.accounts[accountIndex] = {
      ...config.accounts[accountIndex],
      ...updates,
    }

    await this.saveConfig(config)
  }

  /**
   * Get an account by ID
   */
  async getAccount(accountId: string): Promise<any | null> {
    const config = await this.getConfig()
    return config.accounts.find((a) => a.id === accountId) || null
  }

  /**
   * Update configuration
   *
   * Merges updates with existing config and saves atomically with file locking.
   */
  async updateConfig(updates: Partial<BillclawConfig>): Promise<void> {
    const config = await this.getConfig()
    const merged = this.deepMerge(config, updates)
    await this.saveConfig(merged)
  }

  /**
   * Get service-specific configuration
   *
   * @param service - Service name ('plaid' | 'gmail' | 'connect')
   * @returns Service configuration with env overrides applied
   */
  async getServiceConfig(
    service: "plaid" | "gmail" | "connect",
  ): Promise<any> {
    const effectiveConfig = await this.getEffectiveConfig()
    const serviceConfig = effectiveConfig[service]

    // For optional services, provide empty object if not configured
    if (serviceConfig === undefined) {
      return {}
    }

    return serviceConfig
  }

  /**
   * Force reload configuration from disk
   *
   * Invalidates cache and reloads from file.
   */
  async reloadConfig(): Promise<void> {
    this.cache.delete(this.cacheKey)
    await this.getConfig()
  }

  /**
   * Load configuration from file with validation
   *
   * Creates default config if file doesn't exist.
   */
  private async loadConfigFromFile(): Promise<BillclawConfig> {
    try {
      const content = await fs.readFile(this.configPath, "utf-8")
      const parsed = JSON.parse(content)

      // Validate with Zod schema
      const validated = BillclawConfigSchema.parse(parsed)
      return validated
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // File doesn't exist, return default config
        this.logger?.info("Config file not found, using defaults")
        return this.getDefaultConfig()
      }

      if (error instanceof z.ZodError) {
        this.logger?.error("Config validation failed:", error.errors)
        throw new Error(`Invalid configuration: ${error.errors.map((e) => e.message).join(", ")}`)
      }

      throw error
    }
  }

  /**
   * Save configuration to file atomically with file locking
   */
  private async saveConfig(config: BillclawConfig): Promise<void> {
    const configDir = path.dirname(this.configPath)

    // Ensure config directory exists
    await fs.mkdir(configDir, { recursive: true })

    // Ensure config file exists (required by proper-lockfile)
    try {
      await fs.access(this.configPath)
    } catch {
      // File doesn't exist, create empty file
      await fs.writeFile(this.configPath, JSON.stringify({}, null, 2), "utf-8")
    }

    await withLock(
      this.configPath,
      async () => {
        // Atomic write: temp file + rename
        const tmpPath = `${this.configPath}.tmp`
        await fs.writeFile(tmpPath, JSON.stringify(config, null, 2), "utf-8")
        await fs.rename(tmpPath, this.configPath)

        // Invalidate cache
        this.cache.delete(this.cacheKey)

        this.logger?.info(`Configuration saved to ${this.configPath}`)
      },
      { logger: this.logger },
    )
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): BillclawConfig {
    return BillclawConfigSchema.parse({
      version: 1,
      connect: {
        port: 4456,
        host: "localhost",
      },
      plaid: {
        environment: "sandbox",
      },
      storage: {
        path: path.join(os.homedir(), ".firela", "billclaw"),
        format: "json",
        encryption: { enabled: false },
      },
      sync: {
        defaultFrequency: "daily",
        retryOnFailure: true,
        maxRetries: 3,
      },
      accounts: [],
      webhooks: [],
    })
  }

  /**
   * Deep merge two objects
   *
   * Source values override base values.
   */
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
