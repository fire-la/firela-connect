/**
 * Main connect command
 *
 * Unified entry point for connecting OAuth providers.
 * Subcommands handle specific provider implementations.
 */

import { Command } from "commander"
import type { CliCommand, CliContext } from "./registry.js"

/**
 * Connect command handler - displays help
 */
async function runConnect(_context: CliContext): Promise<void> {
  // This is handled by Commander's subcommand system
  // If no subcommand is provided, Commander will show help
}

/**
 * Main connect command definition
 *
 * This command serves as a parent for provider-specific subcommands.
 * Actual handling is done by subcommands (plaid, gmail, status).
 */
export const connectCommand: CliCommand = {
  name: "connect",
  description: "Connect OAuth providers (Plaid, Gmail)",
  arguments: "[provider]",
  handler: runConnect,
}

/**
 * Register connect subcommands with Commander
 *
 * This function is called by the CLI entry point to set up
 * the connect command with its subcommands.
 */
export function registerConnectSubcommands(program: Command): void {
  const connectCmd = program
    .command("connect")
    .description("Connect OAuth providers (Plaid, Gmail)")

  // Plaid subcommand
  connectCmd
    .command("plaid")
    .description("Connect a bank account via Plaid")
    .option("-n, --name <name>", "Account name", "Bank Account")
    .option("-t, --timeout <minutes>", "OAuth timeout in minutes", "10")
    .action(async (options) => {
      const { createRuntimeContext } = await import("../runtime/context.js")
      const { runPlaidConnect } = await import("./connect/plaid.js")

      const runtime = createRuntimeContext()
      const context: CliContext = { runtime, program }

      try {
        await runPlaidConnect(context, {
          name: options.name,
          timeout: parseInt(options.timeout, 10),
        })
      } catch (error) {
        runtime.logger.error("Command failed:", error)
        process.exit(1)
      }
    })

  // Gmail subcommand
  connectCmd
    .command("gmail")
    .description("Connect Gmail account for bill extraction")
    .option("-e, --email <email>", "Email address (auto-detected)")
    .option("-t, --timeout <minutes>", "OAuth timeout in minutes", "10")
    .action(async (options) => {
      const { createRuntimeContext } = await import("../runtime/context.js")
      const { runGmailConnect } = await import("./connect/gmail.js")

      const runtime = createRuntimeContext()
      const context: CliContext = { runtime, program }

      try {
        await runGmailConnect(context, {
          email: options.email,
          timeout: parseInt(options.timeout, 10),
        })
      } catch (error) {
        runtime.logger.error("Command failed:", error)
        process.exit(1)
      }
    })

  // Status subcommand
  connectCmd
    .command("status")
    .description("Display connection status for all accounts")
    .action(async () => {
      const { createRuntimeContext } = await import("../runtime/context.js")
      const { runConnectStatus } = await import("./connect/status.js")

      const runtime = createRuntimeContext()
      const context: CliContext = { runtime, program }

      try {
        await runConnectStatus(context)
      } catch (error) {
        runtime.logger.error("Command failed:", error)
        process.exit(1)
      }
    })
}
