/**
 * Unified connection mode selector with auto-detection
 *
 * Provides automatic mode selection based on environment availability:
 * - Relay: Checks if firela-relay service is configured and reachable
 * - Direct: Checks if Connect service is reachable via health check
 * - Polling: Always available as fallback (webhook only)
 *
 * This module supports both:
 * - OAuth flow completion (Plaid Link, Gmail authorization)
 * - Webhook reception (Plaid, GoCardless, Gmail notifications)
 *
 * @packageDocumentation
 */

import type { RuntimeContext } from "../runtime/types.js"
import type {
  ConnectionMode,
  ConnectionModeSelector,
} from "../models/config.js"
import type {
  ConnectionPurpose,
  ConnectionModeSelectionResult,
  HealthCheckResult,
} from "./types.js"
import type { InboundWebhookReceiverConfig } from "../webhook/config.js"
import { RelayClient } from "../relay/client.js"

/**
 * Default health check timeout in milliseconds
 */
const DEFAULT_HEALTH_CHECK_TIMEOUT = 5000

/**
 * Check if Relay mode is available
 *
 * Relay mode requires both relay URL and API key to be configured.
 * Uses RelayClient health check to verify connectivity.
 */
export async function isRelayAvailable(
  context: RuntimeContext,
  timeout: number = DEFAULT_HEALTH_CHECK_TIMEOUT,
): Promise<HealthCheckResult> {
  try {
    const config = await context.config.getConfig()
    const relayUrl = config.relay?.url
    const relayApiKey = config.relay?.apiKey

    if (!relayUrl || !relayApiKey) {
      return {
        available: false,
        error: "Relay URL or API key not configured",
      }
    }

    const client = new RelayClient(
      { url: relayUrl, apiKey: relayApiKey },
      context.logger,
    )

    const result = await client.healthCheck(timeout)
    return result
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Check if Direct mode is available
 *
 * Direct mode requires Connect service to be reachable via health check.
 * Uses native fetch (Node.js 18+) for framework independence.
 */
export async function isDirectAvailable(
  context: RuntimeContext,
  timeout: number = DEFAULT_HEALTH_CHECK_TIMEOUT,
): Promise<HealthCheckResult> {
  try {
    const config = await context.config.getConfig()
    const publicUrl = config.connect?.publicUrl

    if (!publicUrl) {
      return {
        available: false,
        error: "No publicUrl configured",
      }
    }

    const startTime = Date.now()
    const response = await fetch(`${publicUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(timeout),
    })
    const latency = Date.now() - startTime

    return {
      available: response.ok,
      latency,
      error: response.ok ? undefined : `Health check returned ${response.status}`,
    }
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Get connection mode configuration
 *
 * Supports both new unified 'connection' config and legacy 'receiver' config.
 * Prioritizes new unified config for forward compatibility.
 */
async function getConnectionModeConfig(
  context: RuntimeContext,
): Promise<{ mode: ConnectionMode; healthCheck: ConnectionModeSelector["healthCheck"] }> {
  const config = await context.config.getConfig()

  // Check new unified connection config first
  if (config.connect?.connection) {
    return {
      mode: config.connect.connection.mode,
      healthCheck: config.connect.connection.healthCheck,
    }
  }

  // Fall back to legacy receiver config
  if (config.connect?.receiver) {
    return {
      mode: config.connect.receiver.mode,
      healthCheck: {
        enabled: true,
        timeout: DEFAULT_HEALTH_CHECK_TIMEOUT,
        retries: 2,
        retryDelay: 1000,
      },
    }
  }

  // Default to auto mode
  return {
    mode: "auto",
    healthCheck: {
      enabled: true,
      timeout: DEFAULT_HEALTH_CHECK_TIMEOUT,
      retries: 2,
      retryDelay: 1000,
    },
  }
}

/**
 * Select optimal connection mode based on configuration and availability
 *
 * Selection priority:
 * 1. User configured mode (relay/direct/polling)
 * 2. Auto-detection: Try Relay → Direct → Fallback to Polling
 *
 * @param context - Runtime context for config access and logging
 * @param purpose - Whether this is for 'webhook' or 'oauth' connection
 * @param receiverConfig - Optional legacy receiver config override
 */
export async function selectConnectionMode(
  context: RuntimeContext,
  purpose: ConnectionPurpose = "webhook",
  receiverConfig?: InboundWebhookReceiverConfig,
): Promise<ConnectionModeSelectionResult> {
  const { mode: configuredMode, healthCheck } = receiverConfig
    ? {
        mode: receiverConfig.mode,
        healthCheck: {
          enabled: true,
          timeout: DEFAULT_HEALTH_CHECK_TIMEOUT,
          retries: 2,
          retryDelay: 1000,
        },
      }
    : await getConnectionModeConfig(context)

  // If user explicitly configured a mode, respect it
  if (configuredMode !== "auto") {
    // Validate that polling mode is only used for webhooks
    if (configuredMode === "polling" && purpose === "oauth") {
      context.logger.warn(
        "Polling mode is not supported for OAuth. Please configure relay.url/apiKey for Relay mode or connect.publicUrl for Direct mode.",
      )
      return {
        mode: "relay",
        reason: "Polling mode not supported for OAuth. Configure relay.url/apiKey or connect.publicUrl.",
        purpose,
      }
    }

    return {
      mode: configuredMode,
      reason: `User configured mode: ${configuredMode}`,
      purpose,
    }
  }

  // Auto-detection: Try Relay → Direct → Fallback to Polling
  context.logger.debug(`Connection mode selector: auto-detection started for ${purpose}`)

  const timeout = healthCheck?.timeout ?? DEFAULT_HEALTH_CHECK_TIMEOUT

  // Check Relay mode first (works without public IP)
  context.logger.debug("Connection mode selector: checking Relay mode availability")
  const relayResult = await isRelayAvailable(context, timeout)
  if (relayResult.available) {
    context.logger.info("Connection mode selector: Relay mode selected")
    return {
      mode: "relay",
      reason: `Relay mode available (latency: ${relayResult.latency}ms)`,
      purpose,
    }
  }

  // Check Direct mode (lowest latency, requires public URL)
  context.logger.debug("Connection mode selector: checking Direct mode availability")
  const directResult = await isDirectAvailable(context, timeout)
  if (directResult.available) {
    context.logger.info("Connection mode selector: Direct mode selected")
    return {
      mode: "direct",
      reason: `Direct mode available (latency: ${directResult.latency}ms)`,
      purpose,
    }
  }

  // Fallback to Polling (webhook only) or error (OAuth)
  if (purpose === "oauth") {
    context.logger.error("Connection mode selector: No suitable mode available for OAuth")
    return {
      mode: "relay",
      reason: `OAuth requires Relay or Direct mode. Configure relay.url/apiKey or connect.publicUrl. Relay error: ${relayResult.error}, Direct error: ${directResult.error}`,
      purpose,
    }
  }

  context.logger.info("Connection mode selector: Polling mode selected (fallback)")
  return {
    mode: "polling",
    reason: `Polling mode (Relay unavailable: ${relayResult.error}, Direct unavailable: ${directResult.error})`,
    purpose,
  }
}

/**
 * Get fallback mode for current mode
 *
 * Fallback chain:
 * - Relay → Direct → Polling (webhook only)
 * - Direct → Polling (webhook only)
 * - Polling → Polling (no further fallback)
 */
export function getFallbackMode(
  currentMode: ConnectionMode,
  purpose: ConnectionPurpose,
): ConnectionMode {
  // Polling is not a valid fallback for OAuth
  if (purpose === "oauth") {
    // OAuth requires Relay or Direct mode - no fallback available
    throw new Error("OAuth requires Relay or Direct mode. Configure relay.url/apiKey or connect.publicUrl.")
  }

  switch (currentMode) {
    case "relay":
      return "direct" // Try direct as fallback
    case "direct":
      return "polling"
    case "polling":
      return "polling" // No further fallback
    case "auto":
      return "polling"
  }
}

/**
 * Check if mode can be upgraded to a better mode
 *
 * Upgrade path:
 * - Polling → Relay or Direct (if available)
 * - Direct → Relay (if available)
 */
export async function canUpgradeMode(
  currentMode: ConnectionMode,
  context: RuntimeContext,
  _receiverConfig?: InboundWebhookReceiverConfig,
): Promise<boolean> {
  switch (currentMode) {
    case "polling":
      // Can upgrade to relay or direct if available
      return (await isRelayAvailable(context)).available ||
             (await isDirectAvailable(context)).available

    case "direct":
      // Can upgrade to relay if available
      return (await isRelayAvailable(context)).available

    case "relay":
    case "auto":
      // Already at optimal mode
      return false
  }
}

/**
 * Get best available mode (for upgrade decisions)
 */
export async function getBestAvailableMode(
  context: RuntimeContext,
  purpose: ConnectionPurpose = "webhook",
): Promise<ConnectionMode> {
  // Check Relay first (works without public IP)
  if ((await isRelayAvailable(context)).available) {
    return "relay"
  }

  // Check Direct (lowest latency)
  if ((await isDirectAvailable(context)).available) {
    return "direct"
  }

  // For OAuth, Relay or Direct is required
  if (purpose === "oauth") {
    return "relay" // Return relay as suggestion
  }

  // Fallback to Polling (webhook only)
  return "polling"
}

/**
 * Legacy compatibility: selectMode wrapper
 *
 * @deprecated Use selectConnectionMode instead
 */
export async function selectMode(
  context: RuntimeContext,
  receiverConfig?: InboundWebhookReceiverConfig,
): Promise<{ mode: import("../webhook/config.js").InboundWebhookMode; reason: string }> {
  const result = await selectConnectionMode(context, "webhook", receiverConfig)
  return {
    mode: result.mode as import("../webhook/config.js").InboundWebhookMode,
    reason: result.reason,
  }
}
