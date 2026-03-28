/**
 * Discover command
 *
 * Discover institutions (banks) available through Open Banking providers.
 * Supports GoCardless relay mode for users without provider accounts.
 *
 * @example
 * ```bash
 * # Discover banks in Germany
 * billclaw discover --provider gocardless --country DE
 *
 * # Discover banks in United Kingdom
 * billclaw discover --provider gocardless --country GB
 * ```
 *
 * @packageDocumentation
 */

import { Command } from "commander"
import type { CliCommand, CliContext } from "./registry.js"
import { createTable, printTable, logError } from "../utils/format.js"
import { Spinner } from "../utils/progress.js"
import { createGoCardlessAdapter } from "@firela/billclaw-core"
import { parseGoCardlessRelayError } from "@firela/billclaw-core/relay"

/**
 * Run discover command for GoCardless provider
 */
async function runGoCardlessDiscover(
  context: CliContext,
  args: { country: string },
): Promise<void> {
  const { runtime } = context
  const country = args.country.toUpperCase()

  console.log("")
  console.log("GoCardless Institution Discovery")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("")

  // Validate country code (ISO 3166-1 alpha-2)
  if (!/^[A-Z]{2}$/.test(country)) {
    console.error(
      `Invalid country code: ${args.country}. Please use ISO 3166-1 alpha-2 format (e.g., DE, GB, FR).`,
    )
    process.exit(1)
  }

  // Create adapter and fetch institutions
  const spinner = new Spinner({
    text: `Fetching institutions for country: ${country}...`,
  }).start()

  try {
    const adapter = await createGoCardlessAdapter(runtime)
    const institutions = await adapter.getInstitutions(country)

    spinner.succeed(`Found ${institutions.length} institutions in ${country}`)

    if (institutions.length === 0) {
      console.log("")
      console.log(`No institutions found for country code: ${country}`)
      console.log("")
      console.log("Try a different country code. Common codes:")
      console.log("  DE - Germany")
      console.log("  GB - United Kingdom")
      console.log("  FR - France")
      console.log("  NL - Netherlands")
      console.log("  ES - Spain")
      console.log("  IT - Italy")
      return
    }

    // Display institutions in a table
    console.log("")
    const table = createTable({
      head: ["Institution ID", "Name", "Countries"],
    })

    for (const inst of institutions) {
      table.push([
        inst.id,
        inst.name,
        inst.countries.join(", "),
      ])
    }

    printTable(table)

    console.log("")
    console.log(`Total: ${institutions.length} institutions`)
    console.log("")
    console.log("To connect a bank account, use:")
    console.log(`  billclaw connect gocardless --institution <INSTITUTION_ID>`)
    console.log("")
  } catch (err) {
    spinner.fail("Failed to fetch institutions")
    const userError = parseGoCardlessRelayError(err, {
      endpoint: "getInstitutions",
    })
    logError(runtime.logger, userError, { operation: "gocardless_discover" })

    console.log("")
    console.error(`Error: ${userError.humanReadable.title}`)
    console.error(userError.humanReadable.message)
    if (userError.humanReadable.suggestions) {
      console.log("")
      console.log("Suggestions:")
      for (const suggestion of userError.humanReadable.suggestions) {
        console.log(`  - ${suggestion}`)
      }
    }
    process.exit(1)
  }
}

/**
 * Run discover command handler
 */
async function runDiscover(
  context: CliContext,
  args: { provider: string; country: string },
): Promise<void> {
  const provider = args.provider?.toLowerCase()

  if (!provider) {
    console.error("Error: --provider option is required")
    console.log("")
    console.log("Usage:")
    console.log("  billclaw discover --provider gocardless --country <ISO_CODE>")
    console.log("")
    console.log("Examples:")
    console.log("  billclaw discover --provider gocardless --country DE")
    process.exit(1)
  }

  if (provider === "gocardless") {
    if (!args.country) {
      console.error("Error: --country option is required for GoCardless provider")
      console.log("")
      console.log("Usage:")
      console.log("  billclaw discover --provider gocardless --country <ISO_CODE>")
      console.log("")
      console.log("Common country codes:")
      console.log("  DE - Germany")
      console.log("  GB - United Kingdom")
      console.log("  FR - France")
      process.exit(1)
    }
    await runGoCardlessDiscover(context, args)
  } else {
    console.error(`Error: Unknown provider: ${provider}`)
    console.log("")
    console.log("Supported providers:")
    console.log("  gocardless - GoCardless Bank Account Data API (via relay)")
    process.exit(1)
  }
}

/**
 * Discover command definition
 */
export const discoverCommand: CliCommand = {
  name: "discover",
  description: "Discover institutions (banks) available through Open Banking providers",
  options: [
    {
      flags: "-p, --provider <provider>",
      description: "Provider name (gocardless)",
    },
    {
      flags: "-c, --country <code>",
      description: "ISO 3166-1 alpha-2 country code (e.g., DE, GB, FR)",
    },
  ],
  handler: (context, args) =>
    runDiscover(context, args as { provider: string; country: string }),
}

/**
 * Register discover subcommands with Commander
 */
export function registerDiscoverSubcommands(program: Command): void {
  program
    .command("discover")
    .description("Discover institutions (banks) available through Open Banking providers")
    .option("-p, --provider <provider>", "Provider name (gocardless)")
    .option("-c, --country <code>", "ISO 3166-1 alpha-2 country code (e.g., DE, GB, FR)")
    .action(async (options) => {
      const { createRuntimeContext } = await import("../runtime/context.js")

      const runtime = createRuntimeContext()
      const context: CliContext = { runtime, program }

      try {
        await runDiscover(context, {
          provider: options.provider,
          country: options.country,
        })
      } catch (error) {
        runtime.logger.error("Command failed:", error)
        process.exit(1)
      }
    })
}
