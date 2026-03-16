/**
 * Webhook configuration helpers
 *
 * Provides unified helper functions for configuring webhook receiver
 * across different modes (auto, direct, polling).
 *
 * @packageDocumentation
 */

import type { RuntimeContext } from "../runtime/types.js"
import type {
  InboundWebhookMode,
  DirectWebhookConfig,
  PollingWebhookConfig,
  HealthCheckConfig,
  EventHandlingConfig,
  InboundWebhookReceiverConfig,
} from "./config.js"
import {
  parseWebhookError,
  logError,
} from "../errors/errors.js"

/**
 * Helper type for partial configuration objects
 * Allows setting partial configuration while maintaining type safety
 */
type PartialReceiverConfig = {
  mode?: InboundWebhookMode
  direct?: Partial<DirectWebhookConfig>
  polling?: Partial<PollingWebhookConfig>
  healthCheck?: Partial<HealthCheckConfig>
  eventHandling?: Partial<EventHandlingConfig>
}

/**
 * Options for building webhook receiver configuration
 */
export interface WebhookReceiverConfigOptions {
  /**
   * Public URL for direct mode
   */
  publicUrl?: string
  /**
   * Include health check defaults
   */
  includeHealthCheck?: boolean
  /**
   * Include event handling defaults
   */
  includeEventHandling?: boolean
}

/**
 * Options for setting up webhook receiver
 */
export interface WebhookReceiverSetupOptions {
  /**
   * Public URL for direct mode
   */
  publicUrl?: string
}

/**
 * Result of webhook receiver setup
 */
export interface WebhookReceiverSetupResult {
  success: boolean
  config?: InboundWebhookReceiverConfig
  error?: string
  userError?: ReturnType<typeof parseWebhookError>
}

/**
 * Build webhook receiver configuration
 *
 * Creates a complete InboundWebhookReceiverConfig object with sensible defaults
 * based on the specified mode and optional overrides.
 *
 * @param mode - Webhook receiver mode
 * @param existingConfig - Existing configuration to merge with
 * @param options - Additional options
 * @returns Complete webhook receiver configuration
 */
export function buildWebhookReceiverConfig(
  mode: InboundWebhookMode,
  existingConfig?: InboundWebhookReceiverConfig,
  options?: WebhookReceiverConfigOptions,
): InboundWebhookReceiverConfig {
  const config: PartialReceiverConfig = {
    mode,
  }

  // Get existing sub-configs
  const existingPolling = existingConfig?.polling

  switch (mode) {
    case "direct":
      config.direct = {
        enabled: true,
      }
      config.polling = { enabled: false }
      break

    case "polling":
      config.direct = { enabled: false }
      config.polling = {
        enabled: true,
        interval: 300000, // 5 minutes
        ...(existingPolling),
      }
      break

    case "auto":
    default:
      config.direct = { enabled: false }
      config.polling = { enabled: false }
      break
  }

  // Add health check config if requested
  if (options?.includeHealthCheck) {
    config.healthCheck = {
      enabled: true,
      interval: 60000, // 1 minute
      onStartup: true,
      ...existingConfig?.healthCheck,
    }
  }

  // Add event handling config if requested
  if (options?.includeEventHandling) {
    config.eventHandling = {
      immediate: true,
      maxConcurrentSyncs: 3,
      ...existingConfig?.eventHandling,
    }
  }

  return config as InboundWebhookReceiverConfig
}

/**
 * Setup webhook receiver
 *
 * Unified setup function that configures the webhook receiver
 * based on the specified mode.
 *
 * @param mode - Webhook receiver mode
 * @param context - Runtime context for logging and configuration
 * @param options - Setup options
 * @returns Setup result with configuration or error
 */
export async function setupWebhookReceiver(
  mode: InboundWebhookMode,
  context: RuntimeContext,
  options?: WebhookReceiverSetupOptions,
): Promise<WebhookReceiverSetupResult> {
  try {
    // Build configuration
    const receiverConfig = buildWebhookReceiverConfig(mode, undefined, {
      publicUrl: options?.publicUrl,
      includeHealthCheck: true,
      includeEventHandling: true,
    })

    return {
      success: true,
      config: receiverConfig,
    }
  } catch (error) {
    const userError = parseWebhookError(error as Error, { mode })

    logError(context.logger, userError, {
      function: "setupWebhookReceiver",
      mode,
    })

    return {
      success: false,
      error: String(error),
      userError,
    }
  }
}
