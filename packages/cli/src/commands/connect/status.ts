/**
 * Connect status command
 *
 * Display the current connection status for all OAuth providers.
 */

import type { CliCommand, CliContext } from "../registry.js"
import { success, formatStatus } from "../../utils/format.js"
import { Spinner } from "../../utils/progress.js"
import { Billclaw } from "@firela/billclaw-core"
import { selectConnectionMode } from "@firela/billclaw-core/connection"
import {
  logError,
  formatOauthError,
  createUserError,
  ERROR_CODES,
  ErrorCategory,
} from "@firela/billclaw-core/errors"

/**
 * Run connect status command
 */
export async function runConnectStatus(context: CliContext): Promise<void> {
  const { runtime } = context
  const billclaw = new Billclaw(runtime)

  const spinner = new Spinner({ text: "Checking connection status..." }).start()

  try {
    const accounts = await billclaw.getAccounts()

    spinner.succeed(`Found ${accounts.length} account(s)`)

    if (accounts.length === 0) {
      console.log("")
      console.log("No accounts configured.")
      console.log("")
      console.log("To connect a new account:")
      console.log("  billclaw connect plaid   - Connect a bank account via Plaid")
      console.log("  billclaw connect gmail   - Connect Gmail for bill extraction")
      return
    }

    // Check connection mode
    console.log("")
    console.log("Connection Mode:")
    const modeSelection = await selectConnectionMode(runtime, "oauth")
    console.log(`  Mode: ${modeSelection.mode}`)
    console.log(`  Reason: ${modeSelection.reason}`)

    // Display account status
    console.log("")
    console.log("Connected Accounts:")
    console.log("")

    for (const account of accounts) {
      const statusIcon = account.enabled ? "✓" : "○"
      const lastSync = account.lastSync
        ? new Date(account.lastSync).toLocaleString()
        : "Never"
      const lastStatus = account.lastStatus ?? "pending"

      console.log(`  ${statusIcon} ${account.name} (${account.type})`)
      console.log(`    ID: ${account.id}`)
      console.log(`    Last sync: ${lastSync}`)
      console.log(`    Status: ${formatStatus(lastStatus)}`)

      // Provider-specific info
      if (account.type === "plaid" && account.plaidItemId) {
        console.log(`    Plaid Item ID: ${account.plaidItemId.substring(0, 12)}...`)
      }
      if (account.type === "gmail" && account.gmailEmailAddress) {
        console.log(`    Email: ${account.gmailEmailAddress}`)
      }

      console.log("")
    }

    success("Connection status displayed successfully")
  } catch (err) {
    spinner.fail("Failed to get connection status")

    const userError = createUserError(
      ERROR_CODES.UNKNOWN_ERROR,
      ErrorCategory.UNKNOWN,
      "error",
      true,
      {
        title: "Connection Status Failed",
        message: err instanceof Error ? err.message : "Unknown error occurred",
        suggestions: [
          "Check your configuration file for valid account entries",
          "Ensure data directory has proper permissions",
          "Run 'billclaw setup' to reconfigure",
        ],
      },
    )
    logError(runtime.logger, userError, { operation: "connect_status" })

    console.error("")
    console.error(formatOauthError(userError))
  }
}

/**
 * Connect status command definition
 */
export const connectStatusCommand: CliCommand = {
  name: "connect-status",
  description: "Display connection status for all accounts",
  aliases: ["status"],
  handler: (context) => runConnectStatus(context),
}
