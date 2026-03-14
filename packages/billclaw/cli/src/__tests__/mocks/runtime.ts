/**
 * Mock runtime classes for CLI tests
 *
 * Provides mock implementations of Logger and ConfigProvider
 * following the patterns from TESTING.md.
 */

import { vi } from "vitest"
import type { Logger, ConfigProvider, BillclawConfig, StorageConfig } from "@firela/billclaw-core"
import { deepMerge } from "@firela/billclaw-core/utils"

/**
 * Mock Logger implementation
 *
 * Tracks all log calls for assertions in tests.
 */
export class MockLogger implements Logger {
  info = vi.fn()
  error = vi.fn()
  warn = vi.fn()
  debug = vi.fn()

  /**
   * Get all info calls
   */
  getInfoCalls(): unknown[][] {
    return vi.mocked(this.info).mock.calls
  }

  /**
   * Get all error calls
   */
  getErrorCalls(): unknown[][] {
    return vi.mocked(this.error).mock.calls
  }

  /**
   * Get all warn calls
   */
  getWarnCalls(): unknown[][] {
    return vi.mocked(this.warn).mock.calls
  }

  /**
   * Get all debug calls
   */
  getDebugCalls(): unknown[][] {
    return vi.mocked(this.debug).mock.calls
  }

  /**
   * Clear all mock call history
   */
  clearAll(): void {
    vi.mocked(this.info).mockClear()
    vi.mocked(this.error).mockClear()
    vi.mocked(this.warn).mockClear()
    vi.mocked(this.debug).mockClear()
  }
}

/**
 * Mock ConfigProvider implementation
 *
 * Stores config in memory and allows updates during tests.
 */
export class MockConfigProvider implements ConfigProvider {
  private config: BillclawConfig
  private storageConfig: StorageConfig

  constructor(
    initialConfig?: Partial<BillclawConfig>,
    initialStorageConfig?: Partial<StorageConfig>,
  ) {
    this.config = this.createDefaultConfig(initialConfig)
    this.storageConfig = this.createDefaultStorageConfig(initialStorageConfig)
  }

  private createDefaultConfig(overrides?: Partial<BillclawConfig>): BillclawConfig {
    return {
      version: 1,
      accounts: [],
      webhooks: [],
      storage: {
        path: "~/.firela/billclaw",
        format: "json",
        encryption: { enabled: false },
      },
      sync: {
        defaultFrequency: "daily",
        retryOnFailure: true,
        maxRetries: 3,
      },
      plaid: {
        environment: "sandbox",
      },
      connect: {
        port: 4456,
        host: "localhost",
      },
      export: {
        format: "beancount",
        outputPath: "~/.firela/billclaw/exports",
        filePrefix: "transactions",
        includePending: false,
        currencyColumn: true,
      },
      ...overrides,
    }
  }

  private createDefaultStorageConfig(overrides?: Partial<StorageConfig>): StorageConfig {
    return {
      path: "~/.firela/billclaw",
      format: "json",
      encryption: { enabled: false },
      ...overrides,
    }
  }

  async getConfig(): Promise<BillclawConfig> {
    return this.config
  }

  async getStorageConfig(): Promise<StorageConfig> {
    return this.storageConfig
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
    this.config = deepMerge(this.config, updates)
  }

  /**
   * Set the entire config (for test setup)
   */
  setConfig(config: BillclawConfig): void {
    this.config = config
  }

  /**
   * Set the storage config (for test setup)
   */
  setStorageConfig(storageConfig: StorageConfig): void {
    this.storageConfig = storageConfig
  }

  /**
   * Add an account to the config
   */
  addAccount(account: any): void {
    this.config.accounts.push(account)
  }

  /**
   * Remove an account from the config
   */
  removeAccount(accountId: string): void {
    this.config.accounts = this.config.accounts.filter((a) => a.id !== accountId)
  }
}
