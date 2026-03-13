/**
 * CLI logger implementation
 *
 * Console-based logger with colored output and severity levels.
 */

import type { Logger } from "@firela/billclaw-core"

/**
 * Log level enum
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * CLI logger configuration
 */
export interface CliLoggerConfig {
  level: LogLevel
  colors: boolean
  timestamps: boolean
}

/**
 * Default logger configuration
 */
const defaultConfig: CliLoggerConfig = {
  level: process.env.DEBUG ? LogLevel.DEBUG : LogLevel.INFO,
  colors: process.stdout.isTTY ?? false,
  timestamps: true,
}

/**
 * ANSI color codes
 */
const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
}

/**
 * CLI logger implementation
 */
export class CliLogger implements Logger {
  private config: CliLoggerConfig

  constructor(config: Partial<CliLoggerConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  setLevel(level: LogLevel): void {
    this.config.level = level
  }

  debug(...args: unknown[]): void {
    if (this.config.level <= LogLevel.DEBUG) {
      this.log("DEBUG", args, colors.dim)
    }
  }

  info(...args: unknown[]): void {
    if (this.config.level <= LogLevel.INFO) {
      this.log("INFO", args, colors.blue)
    }
  }

  warn(...args: unknown[]): void {
    if (this.config.level <= LogLevel.WARN) {
      this.log("WARN", args, colors.yellow)
    }
  }

  error(...args: unknown[]): void {
    if (this.config.level <= LogLevel.ERROR) {
      this.log("ERROR", args, colors.red)
    }
  }

  private log(level: string, args: unknown[], color: string): void {
    const timestamp = this.config.timestamps
      ? `${new Date().toISOString()} `
      : ""
    const prefix = this.config.colors
      ? `${color}${timestamp}[${level}]${colors.reset} `
      : `${timestamp}[${level}] `

    const output = args
      .map((arg) => {
        if (typeof arg === "string") {
          return arg
        }
        try {
          return JSON.stringify(arg, null, 2)
        } catch {
          return String(arg)
        }
      })
      .join(" ")

    console.log(prefix + output)
  }
}

/**
 * Create a default CLI logger instance
 */
export function createLogger(config?: Partial<CliLoggerConfig>): CliLogger {
  return new CliLogger(config)
}
