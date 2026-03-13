/**
 * CLI runtime context
 *
 * Combines logger, config provider, and event emitter for CLI usage.
 */

import type { RuntimeContext } from "@firela/billclaw-core"
import { CliLogger, LogLevel, createLogger } from "./logger.js"
import { CliConfigProvider, createConfigProvider } from "./config.js"
import { CliEventEmitter } from "./events.js"

/**
 * CLI runtime context options
 */
export interface CliRuntimeOptions {
  logLevel?: LogLevel
  colors?: boolean
  timestamps?: boolean
  configDir?: string
  configPath?: string
}

/**
 * CLI runtime context
 */
export class CliRuntimeContext implements RuntimeContext {
  readonly logger: CliLogger
  readonly config: CliConfigProvider
  readonly events: CliEventEmitter

  constructor(options: CliRuntimeOptions = {}) {
    this.logger = createLogger({
      level: options.logLevel,
      colors: options.colors,
      timestamps: options.timestamps,
    })
    this.config = createConfigProvider({
      configDir: options.configDir,
      configPath: options.configPath,
    })
    this.events = new CliEventEmitter()
  }
}

/**
 * Create a default CLI runtime context
 */
export function createRuntimeContext(
  options?: CliRuntimeOptions,
): CliRuntimeContext {
  return new CliRuntimeContext(options)
}
