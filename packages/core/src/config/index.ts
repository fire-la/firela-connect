/**
 * Configuration management module
 *
 * Provides unified configuration management for BillClaw with:
 * - Singleton ConfigManager
 * - Environment variable overrides
 * - File locking for concurrent access
 * - Hybrid caching (TTL + mtime validation)
 *
 * @packageDocumentation
 */

import type { BillclawConfig } from "../models/config.js"
import { ConfigManager } from "./config-manager.js"

export {
  ConfigManager,
  type ConfigManagerOptions,
} from "./config-manager.js"

export {
  loadEnvOverrides,
  getEnvValue,
  hasEnvOverrides,
  getEnvMappings,
} from "./env-loader.js"

// Lazy-initialized default manager
// Workers-compatible: Only create when actually needed, not at module load time
let defaultManager: ConfigManager | null = null

/**
 * Get the default ConfigManager instance (lazy initialization)
 *
 * Creates the singleton on first call instead of at module load time.
 * This avoids Workers global scope violations.
 */
function getDefaultManager(): ConfigManager {
  if (!defaultManager) {
    defaultManager = ConfigManager.getInstance()
  }
  return defaultManager
}

/**
 * Get configuration using the default ConfigManager instance
 *
 * This is a convenience function for quick access to configuration.
 * For advanced use cases, create your own ConfigManager instance.
 */
export async function getConfig(): Promise<BillclawConfig> {
  return getDefaultManager().getConfig()
}

/**
 * Update configuration using the default ConfigManager instance
 *
 * This is a convenience function for quick config updates.
 * For advanced use cases, create your own ConfigManager instance.
 */
export async function updateConfig(updates: Partial<BillclawConfig>): Promise<void> {
  return getDefaultManager().updateConfig(updates)
}
