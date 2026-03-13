/**
 * CLI config provider implementation
 *
 * Refactored to use ConfigManager internally while maintaining
 * backward compatibility with existing CLI code.
 *
 * @packageDocumentation
 */

import * as path from "node:path"
import * as os from "node:os"
import type { ConfigProvider, BillclawConfig } from "@firela/billclaw-core"
import { ConfigManager } from "@firela/billclaw-core"

/**
 * CLI config provider options
 */
export interface CliConfigOptions {
  configDir?: string
  configPath?: string
}

/**
 * Default config directory path
 */
function getDefaultConfigDir(): string {
  const home = os.homedir()
  return path.join(home, ".firela", "billclaw")
}

/**
 * CLI config provider implementation
 *
 * This is now a thin wrapper around ConfigManager that:
 * - Maintains backward compatibility with CLI code
 * - Provides CLI-specific options interface
 * - Delegates all config operations to ConfigManager
 *
 * @deprecated Use ConfigManager directly when possible
 */
export class CliConfigProvider implements ConfigProvider {
  private configManager: ConfigManager

  constructor(options: CliConfigOptions = {}) {
    // Use getSharedConfigManager to handle singleton properly
    // This ensures ConfigManager is initialized with correct path
    this.configManager = getSharedConfigManager(options)
  }

  async getConfig(): Promise<BillclawConfig> {
    return this.configManager.getConfig()
  }

  async getStorageConfig(): Promise<any> {
    const config = await this.getConfig()
    return (
      config.storage || {
        path: "~/.firela/billclaw",
        format: "json",
        encryption: { enabled: false },
      }
    )
  }

  async updateAccount(accountId: string, updates: Partial<any>): Promise<void> {
    return this.configManager.updateAccount(accountId, updates)
  }

  async getAccount(accountId: string): Promise<any | null> {
    return this.configManager.getAccount(accountId)
  }

  /**
   * Save config (legacy method for backward compatibility)
   *
   * @deprecated Use updateConfig() instead
   */
  async saveConfig(config: BillclawConfig): Promise<void> {
    return this.configManager.updateConfig(config)
  }

  /**
   * Update full configuration
   *
   * @param updates - Partial config to merge with existing config
   */
  async updateConfig(updates: Partial<BillclawConfig>): Promise<void> {
    return this.configManager.updateConfig(updates)
  }

  /**
   * Get the underlying ConfigManager instance
   *
   * This provides access to extended ConfigManager functionality
   * like getEffectiveConfig() and reloadConfig().
   */
  getConfigManager(): ConfigManager {
    return this.configManager
  }
}

/**
 * Create a default CLI config provider
 *
 * @param options - CLI-specific config options
 * @returns CliConfigProvider instance
 */
export function createConfigProvider(
  options?: CliConfigOptions,
): CliConfigProvider {
  return new CliConfigProvider(options)
}

/**
 * Get the default ConfigManager instance with CLI defaults
 *
 * This is a convenience function for CLI code that needs direct
 * access to ConfigManager features.
 *
 * @param options - CLI-specific config options
 * @returns ConfigManager singleton instance
 */
export function getSharedConfigManager(
  options?: CliConfigOptions,
): ConfigManager {
  const configDir = options?.configDir ?? getDefaultConfigDir()
  const configPath = options?.configPath ?? path.join(configDir, "config.json")

  // Get or create singleton with the specified path
  // Note: this requires resetting if a different path was used before
  const existing = ConfigManager.getInstance() as any
  if (existing["configPath"] !== configPath) {
    // Reset singleton if path differs
    ConfigManager.resetInstance()
    return ConfigManager.getInstance({
      configPath,
      enableEnvOverrides: true,
    })
  }

  return ConfigManager.getInstance({
    configPath,
    enableEnvOverrides: true,
  })
}
