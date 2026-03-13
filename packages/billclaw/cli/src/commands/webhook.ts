/**
 * Webhook command
 *
 * Send test webhooks to verify webhook configuration.
 */

import type { CliCommand, CliContext } from "./registry.js"
import { emitWebhookTest } from "@firela/billclaw-core"
import { success, error } from "../utils/format.js"

/**
 * Run webhook test command
 */
async function runWebhookTest(
  context: CliContext,
  _args: Record<string, unknown>,
): Promise<void> {
  const { runtime } = context

  try {
    // Get configured webhooks directly from config
    const config = await runtime.config.getConfig()
    const webhooks = config.webhooks || []

    if (webhooks.length === 0) {
      console.log("No webhooks configured.")
      console.log("To configure webhooks, add them to your config file:")
      console.log("  ~/.firela/billclaw/config.json")
      return
    }

    const enabledWebhooks = webhooks.filter((w: any) => w.enabled && w.url)

    if (enabledWebhooks.length === 0) {
      console.log("No enabled webhooks found.")
      console.log(`Total webhooks configured: ${webhooks.length}`)
      return
    }

    console.log(`Sending test webhook to ${enabledWebhooks.length} endpoint(s)...`)

    // Send test webhook
    await emitWebhookTest(
      runtime.logger,
      webhooks,
      "Test webhook from BillClaw CLI",
    )

    success("Test webhook sent successfully!")
    console.log("\nEndpoints:")
    for (const webhook of enabledWebhooks) {
      console.log(`  - ${(webhook as any).url}`)
    }
  } catch (err) {
    error(`Failed to send test webhook: ${(err as Error).message}`)
    throw err
  }
}

/**
 * Webhook test command definition
 */
export const webhookTestCommand: CliCommand = {
  name: "webhook",
  description: "Send test webhook to verify configuration",
  aliases: ["test-webhook"],
  options: [],
  handler: (context, args) => runWebhookTest(context, args as Record<string, unknown>),
}
