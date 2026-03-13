/**
 * CLI utilities for formatted output
 *
 * Provides table formatting, colored output, and status displays.
 */
import chalk from "chalk"

/**
 * Table configuration options
 */
export interface TableOptions {
  head: string[]
  style?: Record<string, unknown>
}

/**
 * Simple table implementation
 */
export class CliTable {
  private _head: string[]
  private rows: string[][] = []

  constructor(options: TableOptions) {
    this._head = options.head
  }

  push(row: string[]): void {
    this.rows.push(row)
  }

  toString(): string {
    // Calculate column widths
    const colCount = this._head.length
    const widths: number[] = []

    for (let i = 0; i < colCount; i++) {
      let maxLen = this._head[i].length
      for (const row of this.rows) {
        if (row[i] && row[i].length > maxLen) {
          maxLen = row[i].length
        }
      }
      widths.push(maxLen + 2)
    }

    // Build output
    const lines: string[] = []

    // Header
    const header = this._head.map((h, i) => h.padEnd(widths[i])).join("")
    lines.push(chalk.cyan(header))

    // Rows
    for (const row of this.rows) {
      const line = row.map((cell, i) => (cell ?? "").padEnd(widths[i])).join("")
      lines.push(line)
    }

    return lines.join("\n")
  }
}

/**
 * Create a formatted table
 */
export function createTable(options: TableOptions): CliTable {
  return new CliTable(options)
}

/**
 * Print a table to console
 */
export function printTable(table: CliTable): void {
  console.log(table.toString())
}

/**
 * Format a status badge
 */
export function formatStatus(status: string): string {
  const normalized = status.toLowerCase()
  switch (normalized) {
    case "active":
    case "connected":
    case "ok":
    case "success":
      return chalk.green(status)
    case "pending":
    case "syncing":
      return chalk.yellow(status)
    case "inactive":
    case "disconnected":
    case "error":
    case "failed":
      return chalk.red(status)
    default:
      return chalk.gray(status)
  }
}

/**
 * Format an account type badge
 */
export function formatAccountType(type: string): string {
  const normalized = type.toLowerCase()
  switch (normalized) {
    case "plaid":
      return chalk.blue(type)
    case "gmail":
      return chalk.red(type)
    case "gocardless":
      return chalk.green(type)
    default:
      return chalk.gray(type)
  }
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount)
}

/**
 * Format date
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * Format datetime
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Print success message
 */
export function success(message: string): void {
  console.log(chalk.green("✓") + " " + message)
}

/**
 * Print error message
 */
export function error(message: string): void {
  console.error(chalk.red("✗") + " " + message)
}

/**
 * Print warning message
 */
export function warn(message: string): void {
  console.warn(chalk.yellow("⚠") + " " + message)
}

/**
 * Print info message
 */
export function info(message: string): void {
  console.log(chalk.blue("ℹ") + " " + message)
}

/**
 * Log error with context
 */
export function logError(
  logger: { error: (msg: string, ...args: unknown[]) => void },
  err: Error | unknown,
  context?: Record<string, unknown>
): void {
  const errorMessage = err instanceof Error ? err.message : String(err)
  const contextStr = context ? ` ${JSON.stringify(context)}` : ""
  logger.error(`Error: ${errorMessage}${contextStr}`)
}
