/**
 * BillClaw CLI
 *
 * Standalone command-line interface for financial data management.
 */

import { Command } from "commander"
import { CommandRegistry } from "./commands/registry.js"
import { allCommands } from "./commands/index.js"
import { registerConnectSubcommands } from "./commands/connect.js"
import { showUpdateNotification } from "./utils/update-check.js"

/**
 * CLI version
 */
const VERSION = "0.5.4"

/**
 * Create and configure the CLI program
 */
export async function createProgram(): Promise<Command> {
  const program = new Command()

  program
    .name("billclaw")
    .description(
      "BillClaw - Financial data sovereignty with multi-platform support",
    )
    .version(VERSION)

  const registry = new CommandRegistry(program)

  // Register all commands
  for (const commandLoader of allCommands) {
    const _commandName = Object.keys(commandLoader)[0]
    const loadCommand = Object.values(commandLoader)[0] as () => Promise<any>
    const command = await loadCommand()
    registry.register(command)
  }

  // Register connect subcommands (special handling for nested commands)
  registerConnectSubcommands(program)

  return program
}

/**
 * Main entry point
 */
export async function main(args: string[] = process.argv): Promise<void> {
  try {
    const program = await createProgram()
    await program.parseAsync(args)

    // Show update notification after command completes (non-blocking)
    // In test environment, skip to avoid keeping process alive
    if (process.env.NODE_ENV !== 'test') {
      showUpdateNotification()
    }
  } catch (error) {
    console.error("CLI error:", error)
    process.exit(1)
  }
}
