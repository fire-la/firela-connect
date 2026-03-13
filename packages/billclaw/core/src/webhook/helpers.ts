/**
 * Webhook configuration helpers
 *
 * Provides unified helper functions for configuring webhook receiver
 * across different modes (auto, direct, relay, polling).
 *
 * @packageDocumentation
 */

import type { RuntimeContext } from "../runtime/types.js"
import type {
  InboundWebhookMode,
  RelayWebhookConfig,
  DirectWebhookConfig,
  PollingWebhookConfig,
  HealthCheckConfig,
  EventHandlingConfig,
  InboundWebhookReceiverConfig,
} from "./config.js"
import { setupRelayCredentials } from "../relay/oauth.js"
import {
  parseRelayError,
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
  relay?: Partial<RelayWebhookConfig>
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
   * OAuth options for relay mode
   */
  oauth?: {
    oauthUrl?: string
    callbackPort?: number
    timeout?: number
  }
  /**
   * Custom relay configuration overrides
   */
  relayOverrides?: Partial<RelayWebhookConfig>
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
  /**
   * OAuth timeout in milliseconds
   */
  oauthTimeout?: number
  /**
   * OAuth callback port
   */
  oauthCallbackPort?: number
  /**
   * Skip OAuth (use existing credentials)
   */
  skipOAuth?: boolean
}

/**
 * Result of webhook receiver setup
 */
export interface WebhookReceiverSetupResult {
  /**
   * Whether setup was successful
   */
  success: boolean
  /**
   * Updated configuration (partial, ready for updateConfig)
   */
  config?: Partial<InboundWebhookReceiverConfig>
  /**
   * Error message if setup failed
   */
  error?: string
  /**
   * Parsed error for structured handling
   */
  userError?: ReturnType<typeof parseRelayError> | ReturnType<typeof parseWebhookError>
}

/**
 * Default relay configuration constants
 */
const DEFAULT_RELAY_CONFIG = {
  wsUrl: "wss://relay.firela.io/api/webhook-relay/ws",
  apiUrl: "https://relay.firela.io/api/webhook-relay",
  oauthUrl: "https://relay.firela.io/api/oauth/webhook-relay",
  reconnect: true,
  reconnectDelay: 1000,
  maxReconnectDelay: 300000,
  autoFallbackToPolling: true,
} as const

/**
 * Default health check configuration
 */
const DEFAULT_HEALTH_CHECK: HealthCheckConfig = {
  enabled: true,
  interval: 60000,
  onStartup: true,
}

/**
 * Default event handling configuration
 */
const DEFAULT_EVENT_HANDLING: EventHandlingConfig = {
  immediate: true,
  maxConcurrentSyncs: 3,
}

/**
 * Get default relay configuration
 *
 * Returns standardized relay configuration with all default values.
 * Use this to ensure consistency across all webhook setup code.
 *
 * @returns Partial relay configuration with defaults
 */
export function getRelayConfigDefaults(): Partial<RelayWebhookConfig> {
  return { ...DEFAULT_RELAY_CONFIG }
}

/**
 * Build webhook receiver configuration for any mode
 *
 * Creates a complete configuration object for the specified mode,
 * merging with existing configuration and applying overrides.
 *
 * @param mode - Webhook receiver mode
 * @param existingConfig - Existing receiver configuration to preserve
 * @param options - Configuration options
 * @returns Partial configuration ready for updateConfig
 */
export function buildWebhookReceiverConfig(
  mode: InboundWebhookMode,
  existingConfig?: InboundWebhookReceiverConfig,
  options?: WebhookReceiverConfigOptions,
): Partial<InboundWebhookReceiverConfig> {
  const existingRelay = existingConfig?.relay
  const existingHealthCheck = existingConfig?.healthCheck
  const existingEventHandling = existingConfig?.eventHandling

  // Build mode-specific configuration
  const config: PartialReceiverConfig = {
    mode,
  }

  switch (mode) {
    case "direct":
      config.direct = { enabled: true }
      config.relay = { enabled: false }
      config.polling = { enabled: true, interval: 300000 }
      break

    case "relay":
      config.direct = { enabled: false }
      config.relay = {
        enabled: true,
        ...getRelayConfigDefaults(),
        ...(options?.relayOverrides),
        // Preserve credentials if they exist
        webhookId: existingRelay?.webhookId,
        apiKey: existingRelay?.apiKey,
      }
      config.polling = { enabled: true, interval: 300000 }
      break

    case "polling":
      config.direct = { enabled: false }
      config.relay = { enabled: false }
      config.polling = { enabled: true, interval: 300000 }
      break

    case "auto":
    default:
      config.direct = { enabled: true }
      config.relay = { enabled: false }
      config.polling = { enabled: true, interval: 300000 }
      break
  }

  // Add health check defaults if requested
  if (options?.includeHealthCheck !== false) {
    config.healthCheck = {
      ...DEFAULT_HEALTH_CHECK,
      ...existingHealthCheck,
    }
  }

  // Add event handling defaults if requested
  if (options?.includeEventHandling !== false) {
    config.eventHandling = {
      ...DEFAULT_EVENT_HANDLING,
      ...existingEventHandling,
    }
  }

  // Cast to expected return type - the PartialReceiverConfig allows partial mode configs
  // and the caller will merge this with existing config
  return config as Partial<InboundWebhookReceiverConfig>
}

/**
 * Setup webhook receiver with OAuth handling
 *
 * Unified setup function that handles OAuth flow for relay mode
 * and builds configuration for all modes.
 *
 * @param mode - Webhook receiver mode
 * @param context - Runtime context
 * @param options - Setup options
 * @returns Setup result with configuration or error
 */
export async function setupWebhookReceiver(
  mode: InboundWebhookMode,
  context: RuntimeContext,
  options?: WebhookReceiverSetupOptions,
): Promise<WebhookReceiverSetupResult> {
  try {
    // Handle relay mode - requires OAuth
    if (mode === "relay" && !options?.skipOAuth) {
      context.logger.info("Relay mode requires OAuth authorization...")

      const oauthOptions = {
        oauthUrl: "https://relay.firela.io/api/oauth/webhook-relay",
        callbackPort: options?.oauthCallbackPort ?? 34567,
        timeout: options?.oauthTimeout ?? 300000,
      }

      const result = await setupRelayCredentials(oauthOptions, context)

      if (!result.success) {
        const relayError = parseRelayError(
          new Error(result.error || "OAuth authorization failed"),
          { mode },
        )

        logError(context.logger, relayError, {
          function: "setupWebhookReceiver",
          mode,
        })

        return {
          success: false,
          error: result.error,
          userError: relayError,
        }
      }

      context.logger.info("Relay credentials obtained successfully")
    }

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
    const userError =
      error instanceof Error &&
      (error.message.includes("OAuth") ||
        error.message.includes("relay") ||
        error.message.includes("authorization"))
        ? parseRelayError(error as Error, { mode })
        : parseWebhookError(error as Error, { mode })

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
