/**
 * Webhook receiver commands
 *
 * Manage inbound webhook receiver configuration (Direct/Relay/Polling modes).
 */

import type { CliCommand, CliContext } from "./registry.js"
import { success, error } from "../utils/format.js"
import type { InboundWebhookMode } from "@firela/billclaw-core"
import {
  parseWebhookError,
  logError,
  formatError,
} from "@firela/billclaw-core/errors"

/**
 * Run webhook receiver config command
 */
async function runConfig(
  context: CliContext,
  _args?: Record<string, unknown>,
): Promise<void> {
  const { runtime } = context
  const config = await runtime.config.getConfig()
  const receiver = config.connect?.receiver

  if (!receiver) {
    console.log("Webhook receiver is not configured.")
    console.log("\nTo enable webhook receiver, run:")
    console.log("  billclaw webhook-receiver-enable")
    return
  }

  console.log("Webhook Receiver Configuration:")
  console.log(`  Mode: ${receiver.mode}`)
  console.log(`  Direct: ${receiver.direct?.enabled ? "enabled" : "disabled"}`)
  console.log(`  Relay: ${receiver.relay?.enabled ? "enabled" : "disabled"}`)
  console.log(`  Polling: ${receiver.polling?.enabled ? "enabled" : "disabled"}`)

  if (receiver.healthCheck) {
    console.log(`  Health Check: ${receiver.healthCheck.enabled ? "enabled" : "disabled"}`)
    if (receiver.healthCheck.enabled) {
      console.log(`    Interval: ${receiver.healthCheck.interval}ms`)
      console.log(`    On Startup: ${receiver.healthCheck.onStartup ? "yes" : "no"}`)
    }
  }

  if (receiver.eventHandling) {
    console.log(`  Event Handling:`)
    console.log(`    Immediate: ${receiver.eventHandling.immediate ? "yes" : "no"}`)
    console.log(`    Max Concurrent Syncs: ${receiver.eventHandling.maxConcurrentSyncs}`)
  }

  if (receiver.mode === "relay" && receiver.relay) {
    console.log("\nRelay Configuration:")
    console.log(`  WebSocket URL: ${receiver.relay.wsUrl}`)
    console.log(`  API URL: ${receiver.relay.apiUrl}`)
    console.log(`  Webhook ID: ${receiver.relay.webhookId ?? "Not configured"}`)
    console.log(`  Auto Fallback: ${receiver.relay.autoFallbackToPolling ? "yes" : "no"}`)
  }

  if (receiver.mode === "direct" && receiver.direct?.enabled) {
    console.log("\nDirect Mode:")
    console.log(`  Public URL: ${config.connect?.publicUrl ?? "Not configured"}`)
    console.log(`  Webhook URL: ${config.connect?.publicUrl}/webhook/plaid`)
  }
}

/**
 * Run webhook receiver status command
 */
async function runStatus(
  context: CliContext,
  _args?: Record<string, unknown>,
): Promise<void> {
  const { runtime } = context
  const config = await runtime.config.getConfig()
  const receiver = config.connect?.receiver

  if (!receiver) {
    console.log("Webhook receiver is not configured.")
    return
  }

  console.log("Webhook Receiver Status:")
  console.log(`  Mode: ${receiver.mode}`)
  console.log(`  Status: ${getStatusText(receiver.mode, receiver)}`)

  // Check availability for each mode
  if (receiver.mode === "auto" || receiver.mode === "direct") {
    console.log("\nDirect Mode:")
    console.log(`  Status: Checking...`)
    // TODO: Implement actual status check via mode selector
  }

  if (receiver.mode === "auto" || receiver.mode === "relay") {
    console.log("\nRelay Mode:")
    if (receiver.relay?.enabled && receiver.relay.webhookId) {
      console.log(`  Status: Configured`)
      console.log(`  Webhook ID: ${receiver.relay.webhookId}`)
      // TODO: Check actual connection status
    } else {
      console.log(`  Status: Not configured`)
    }
  }

  console.log("\nPolling Mode:")
  console.log(`  Status: Always available (fallback)`)
  if (receiver.polling) {
    console.log(`  Interval: ${receiver.polling.interval}ms`)
  }
}

/**
 * Run webhook receiver enable command
 */
async function runEnable(
  context: CliContext,
  args?: Record<string, unknown>,
): Promise<void> {
  const { runtime } = context
  const mode = (args?.mode as InboundWebhookMode) ?? "auto"

  console.log(`Enabling webhook receiver in ${mode} mode...`)

  try {
    // Use unified helper for webhook receiver setup
    const { setupWebhookReceiver } = await import("@firela/billclaw-core/webhook")

    const setupResult = await setupWebhookReceiver(mode, runtime, {
      oauthTimeout: 300000,
    })

    if (!setupResult.success) {
      error(`OAuth failed: ${setupResult.error}`)
      return
    }

    if (mode === "relay") {
      success("Relay credentials obtained successfully!")
    }

    // Build complete configuration update
    const config = await runtime.config.getConfig()
    const existingReceiver = config.connect?.receiver

    await runtime.config.updateConfig({
      connect: {
        port: config.connect?.port ?? 4456,
        host: config.connect?.host ?? "localhost",
        publicUrl: config.connect?.publicUrl,
        tls: config.connect?.tls,
        receiver: {
          mode,
          ...setupResult.config,
          // Preserve existing non-mode-specific settings
          healthCheck: existingReceiver?.healthCheck,
          eventHandling: existingReceiver?.eventHandling,
        },
      },
    })

    success(`Webhook receiver enabled in ${mode} mode`)
    console.log("\nNext steps:")
    if (mode === "direct") {
      console.log("  - Ensure your Connect service is running")
      console.log("  - Configure Plaid webhooks to point to your public URL")
      console.log(`    ${config.connect?.publicUrl}/webhook/plaid`)
    } else if (mode === "relay") {
      console.log("  - Your webhook receiver is now active")
      console.log("  - Configure Plaid webhooks to use relay URL:")
      console.log("    https://relay.firela.io/api/webhook-relay/webhook/{webhookId}")
    } else {
      console.log("  - Webhook receiver will auto-detect optimal mode")
    }
  } catch (err) {
    const userError =
      err instanceof Error && (err as any).type === "UserError"
        ? (err as any)
        : parseWebhookError(err as Error, { mode })

    logError(runtime.logger, userError, { command: "webhook-receiver-enable", mode })
    error(formatError(userError))
    throw err
  }
}

/**
 * Run webhook receiver disable command
 */
async function runDisable(
  context: CliContext,
  _args?: Record<string, unknown>,
): Promise<void> {
  const { runtime } = context
  const config = await runtime.config.getConfig()

  if (!config.connect?.receiver) {
    console.log("Webhook receiver is not enabled.")
    return
  }

  console.log("Disabling webhook receiver...")

  await runtime.config.updateConfig({
    connect: {
      port: config.connect.port,
      host: config.connect.host,
      publicUrl: config.connect.publicUrl,
      tls: config.connect.tls,
      receiver: undefined,
    },
  })

  success("Webhook receiver disabled")
  console.log("\nNote: Polling mode is still available for syncing")
}

/**
 * Get status text for mode
 */
function getStatusText(mode: string, receiver: any): string {
  if (mode === "direct" && receiver.direct?.enabled) {
    return "Active (Direct mode)"
  }
  if (mode === "relay" && receiver.relay?.enabled) {
    return receiver.relay.webhookId ? "Active (Relay mode)" : "Not configured"
  }
  if (mode === "polling" || mode === "auto") {
    return "Active (Polling fallback)"
  }
  return "Unknown"
}

/**
 * Webhook receiver config command
 */
export const webhookReceiverConfigCommand: CliCommand = {
  name: "webhook-receiver-config",
  description: "Show webhook receiver configuration",
  aliases: ["wh-rcv-cfg"],
  handler: runConfig,
}

/**
 * Webhook receiver status command
 */
export const webhookReceiverStatusCommand: CliCommand = {
  name: "webhook-receiver-status",
  description: "Show webhook receiver status",
  aliases: ["wh-rcv-stat"],
  handler: runStatus,
}

/**
 * Webhook receiver enable command
 */
export const webhookReceiverEnableCommand: CliCommand = {
  name: "webhook-receiver-enable",
  description: "Enable webhook receiver with mode selection",
  aliases: ["wh-rcv-on"],
  options: [
    {
      flags: "--mode <type>",
      description: "Receiver mode (auto, direct, relay, polling)",
      default: "auto",
    },
  ],
  handler: runEnable,
}

/**
 * Webhook receiver disable command
 */
export const webhookReceiverDisableCommand: CliCommand = {
  name: "webhook-receiver-disable",
  description: "Disable webhook receiver",
  aliases: ["wh-rcv-off"],
  handler: runDisable,
}
