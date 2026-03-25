/**
 * Relay configuration utilities for CLI
 *
 * Provides health check validation and error formatting for relay configuration display.
 */

import {
  RelayClient,
  type RelayHealthCheckResult,
} from "@firela/billclaw-core/relay"
import type { RelayConfig, Logger } from "@firela/billclaw-core"

/** Startup health check timeout (3 seconds per CONTEXT.md decision) */
export const STARTUP_HEALTH_CHECK_TIMEOUT = 3000

/** Relay error classification for user-friendly guidance */
export interface RelayErrorGuidance {
  category: "network" | "auth" | "missing" | "invalid"
  message: string
  action: string
}

/**
 * Validate relay connection with health check
 *
 * @param config - Relay configuration
 * @param logger - Optional logger for debug output
 * @param timeout - Health check timeout in ms (default: 3000)
 * @returns Health check result
 */
export async function validateRelayConnection(
  config: RelayConfig | undefined,
  logger?: Logger,
  timeout: number = STARTUP_HEALTH_CHECK_TIMEOUT,
): Promise<RelayHealthCheckResult> {
  // No relay configured
  if (!config?.url || !config?.apiKey) {
    return {
      available: false,
      error: "Not configured",
    }
  }

  try {
    const client = new RelayClient(
      { url: config.url, apiKey: config.apiKey },
      logger,
    )
    return await client.healthCheck(timeout)
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Classify relay error and provide actionable guidance
 *
 * @param healthResult - Health check result
 * @param config - Relay configuration
 * @returns Error guidance with category, message, and action
 */
export function classifyRelayError(
  healthResult: RelayHealthCheckResult,
  config: RelayConfig | undefined,
): RelayErrorGuidance {
  // Missing configuration
  if (!config?.url && !config?.apiKey) {
    return {
      category: "missing",
      message: "Relay not configured",
      action: `Run: export FIRELA_RELAY_URL=https://relay.firela.io
       export FIRELA_RELAY_API_KEY=your_key`,
    }
  }

  // Incomplete configuration
  if (!config?.url || !config?.apiKey) {
    const missing = !config?.url ? "FIRELA_RELAY_URL" : "FIRELA_RELAY_API_KEY"
    return {
      category: "invalid",
      message: `Missing ${missing}`,
      action: `Run: export ${missing}=your_value`,
    }
  }

  // Authentication error
  const errorMsg = healthResult.error?.toLowerCase() || ""
  if (errorMsg.includes("401") || errorMsg.includes("unauthorized")) {
    return {
      category: "auth",
      message: "Invalid API key",
      action: `Verify your API key is correct
  Run: export FIRELA_RELAY_API_KEY=your_valid_key`,
    }
  }

  // Network error (default)
  return {
    category: "network",
    message: `Connection failed: ${healthResult.error}`,
    action: `Check your network connection
  Verify the URL is correct: ${config?.url}`,
  }
}

/**
 * Format relay status for display
 *
 * @param healthResult - Health check result
 * @param config - Relay configuration
 * @param verbose - Show detailed output
 * @returns Formatted status string
 */
export function formatRelayStatus(
  healthResult: RelayHealthCheckResult,
  config: RelayConfig | undefined,
  verbose: boolean = false,
): string {
  if (!config?.url && !config?.apiKey) {
    return "Not configured"
  }

  if (healthResult.available) {
    const latency = healthResult.latency ? ` (${healthResult.latency}ms)` : ""
    return verbose ? `Connected${latency}` : "Connected"
  }

  return "Failed"
}
