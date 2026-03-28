/**
 * GoCardless connect command
 *
 * Connect a bank account via GoCardless OAuth flow through relay.
 * Supports relay mode only - users cannot have their own GoCardless accounts.
 *
 * @example
 * ```bash
 * # Connect a bank account
 * billclaw connect gocardless --institution SANDBOX_Oj
 *
 * # With custom account name
 * billclaw connect gocardless --institution SANDBOX_Oj --name "My Bank"
 * ```
 *
 * @packageDocumentation
 */

import type { CliCommand, CliContext } from "../registry.js"
import { logError } from "../../utils/format.js"
import { Spinner } from "../../utils/progress.js"
import {
  createGoCardlessAdapter,
  type GoCardlessSyncAdapter,
} from "@firela/billclaw-core"
import { parseGoCardlessRelayError } from "@firela/billclaw-core/relay"


/**
 * Polling interval in milliseconds (1 second)
 */
const POLL_INTERVAL = 1000

/**
 * Relay callback URL for GoCardless OAuth
 * The relay service handles the callback and stores the requisition status
 */
const RELAY_CALLBACK_URL = "https://relay.firela.io/callback/gocardless"

/**
 * Run GoCardless connect command
 */
export async function runGoCardlessConnect(
  context: CliContext,
  args: { institution: string; name?: string; timeout?: number },
): Promise<void> {
  const { runtime } = context
  const institutionId = args.institution
  const timeoutMs = (args.timeout ?? 5) * 60 * 1000

  console.log("")
  console.log("GoCardless Bank Account Connection")
  console.log("====================================")
  console.log("")

  // Validate institution ID
  if (!institutionId) {
    console.error("Error: --institution option is required")
    console.log("")
    console.log("Usage:")
    console.log("  billclaw connect gocardless --institution <INSTITUTION_ID>")
    console.log("")
    console.log("To discover institution IDs, use:")
    console.log("  billclaw discover --provider gocardless --country <ISO_CODE>")
    process.exit(1)
  }

  // Create adapter
  let adapter: GoCardlessSyncAdapter
  const adapterSpinner = new Spinner({
    text: "Initializing GoCardless adapter...",
  }).start()

  try {
    adapter = await createGoCardlessAdapter(runtime)
    adapterSpinner.succeed("GoCardless adapter initialized (relay mode)")
  } catch (err) {
    adapterSpinner.fail("Failed to initialize adapter")
    const userError = parseGoCardlessRelayError(err)
    logError(runtime.logger, userError, { operation: "gocardless_adapter_init" })

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
    return
  }

  // Create requisition (start OAuth flow)
  console.log("")
  console.log(`Institution: ${institutionId}`)

  const requisitionSpinner = new Spinner({
    text: "Creating requisition...",
  }).start()

  let requisitionLink: string
  let _requisitionId: string
  try {
    const requisition = await adapter.createRequisition({
      institution_id: institutionId,
      redirect: RELAY_CALLBACK_URL,
      reference: `billclaw-${Date.now()}`,
    })
    requisitionLink = requisition.link
    _requisitionId = requisition.id
    requisitionSpinner.succeed("Requisition created")
  } catch (err) {
    requisitionSpinner.fail("Failed to create requisition")
    const userError = parseGoCardlessRelayError(err)
    logError(runtime.logger, userError, { operation: "gocardless_create_requisition" })

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
    return
  }

  // Display OAuth link for user to open
  console.log("")
  console.log("OAuth Authorization Required")
  console.log("--------------------------")
  console.log("")
  console.log("Please open the following URL in your browser to authenticate:")
  console.log("")
  console.log(`  ${requisitionLink}`)
  console.log("")
  console.log("After authorization, you will be redirected back to the relay callback.")
  console.log("")

  // Wait for OAuth completion by polling
  console.log(
    `Waiting for OAuth completion (timeout: ${timeoutMs / 60000} minutes)...`,
  )
  console.log("Press Ctrl+C to cancel")
  console.log("")

  const pollSpinner = new Spinner({
    text: "Waiting for authorization...",
  }).start()

  try {
    // Simple polling: check requisition status periodically
    // For now, we wait for the user to complete OAuth and then timeout
    // In a production system, the relay would notify the CLI via webhook
    const pollStartTime = Date.now()

    while (Date.now() - pollStartTime < timeoutMs) {
      await sleep(POLL_INTERVAL)
      // Placeholder: In production, would check requisition status here
      // For this implementation, we rely on the relay callback
    }

    // Timeout reached
    pollSpinner.fail("OAuth timed out")
    console.log("")
    console.error("Error: OAuth authorization timed out")
    console.log("")
    console.log("Suggestions:")
    console.log("  - The authorization may have taken longer than expected")
    console.log("  - You can check the status later with: billclaw connect status")
    console.log("  - Make sure pop-up blockers are disabled")
    process.exit(1)
  } catch (err) {
    pollSpinner.fail("OAuth failed")
    const userError = parseGoCardlessRelayError(err)
    logError(runtime.logger, userError, { operation: "gocardless_oauth_polling" })

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
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * GoCardless connect command definition
 */
export const gocardlessConnectCommand: CliCommand = {
  name: "connect-gocardless",
  description: "Connect a bank account via GoCardless (relay mode only)",
  aliases: ["gocardless"],
  options: [
    {
      flags: "-i, --institution <id>",
      description: "GoCardless institution ID (from discover command)",
    },
    {
      flags: "-n, --name <name>",
      description: "Account name (default: 'GoCardless Bank Account')",
    },
    {
      flags: "-t, --timeout <minutes>",
      description: "OAuth timeout in minutes (default: 5)",
    },
  ],
  handler: (context, args) =>
    runGoCardlessConnect(context, args as {
      institution: string
      name?: string
      timeout?: number
    }),
}
