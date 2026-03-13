/**
 * Export command
 *
 * Export transactions to Beancount or Ledger format.
 */

import type { CliCommand, CliContext } from "./registry.js"
import { Spinner } from "../utils/progress.js"
import {
  Billclaw,
  exportToBeancount,
  exportToLedger,
  type BeancountExportOptions,
  type LedgerExportOptions,
} from "@firela/billclaw-core"
import * as fs from "node:fs/promises"
import * as path from "node:path"

/**
 * Run export command
 */
async function runExport(
  context: CliContext,
  args: {
    format?: "beancount" | "ledger"
    output?: string
    account?: string
    year?: string
    month?: string
  },
): Promise<void> {
  const { runtime } = context
  const billclaw = new Billclaw(runtime)

  const format = args.format ?? "beancount"
  const outputPath = args.output ?? getDefaultExportPath(format)

  const spinner = new Spinner({
    text: `Exporting transactions to ${format}...`,
  }).start()

  try {
    const now = new Date()
    const year = args.year ? parseInt(args.year, 10) : now.getFullYear()
    const month = args.month ? parseInt(args.month, 10) : now.getMonth() + 1
    const accountId = args.account

    // Get transactions for the specified period
    const transactions = await billclaw.getTransactions(
      accountId || "all",
      year,
      month,
    )

    // Export to requested format
    let content: string

    switch (format) {
      case "beancount": {
        const options: BeancountExportOptions = {
          accountId: accountId || "all",
          year,
          month,
          commodity: "USD",
        }
        content = await exportToBeancount(transactions, options)
        break
      }
      case "ledger": {
        const options: LedgerExportOptions = {
          accountId: accountId || "all",
          year,
          month,
          commodity: "USD",
        }
        content = await exportToLedger(transactions, options)
        break
      }
      default:
        throw new Error(`Unknown export format: ${format}`)
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath)
    await fs.mkdir(outputDir, { recursive: true })

    // Write to file
    await fs.writeFile(outputPath, content, "utf-8")

    spinner.succeed(
      `Exported ${transactions.length} transactions to ${outputPath}`,
    )
  } catch (err) {
    spinner.fail(`Export failed: ${(err as Error).message}`)
    throw err
  }
}

/**
 * Get default export path
 */
function getDefaultExportPath(format: string): string {
  const date = new Date().toISOString().split("T")[0]
  return `~/.firela/billclaw/exports/${format}-${date}.${
    format === "beancount" ? "beancount" : "ldg"
  }`
}

/**
 * Export command definition
 */
export const exportCommand: CliCommand = {
  name: "export",
  description: "Export transactions to Beancount or Ledger format",
  options: [
    {
      flags: "-f, --format <format>",
      description: "Export format: beancount or ledger (default: beancount)",
    },
    {
      flags: "-o, --output <path>",
      description: "Output file path",
    },
    {
      flags: "-a, --account <id>",
      description: "Account ID to export (default: all)",
    },
    {
      flags: "-y, --year <year>",
      description: "Year to export (default: current year)",
    },
    {
      flags: "-m, --month <month>",
      description: "Month to export (default: current month)",
    },
  ],
  handler: (context: CliContext, args?: Record<string, unknown>) => {
    const typedArgs = args as {
      format?: "beancount" | "ledger"
      output?: string
      account?: string
      year?: string
      month?: string
    } | undefined
    return runExport(context, typedArgs ?? {})
  },
}
