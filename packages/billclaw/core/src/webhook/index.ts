/**
 * Unified inbound webhook receiver module
 *
 * Exports configuration types, mode selection logic, and webhook manager
 * for webhook reception via Direct/Relay/Polling modes.
 *
 * NOTE: Mode selection functions (selectMode, isDirectAvailable, etc.)
 * are now exported from the connection module. This module only exports
 * webhook-specific configuration and types.
 *
 * @packageDocumentation
 */

export type {
  InboundWebhookMode,
  DirectWebhookConfig,
  RelayWebhookConfig,
  PollingWebhookConfig,
  HealthCheckConfig,
  EventHandlingConfig,
  RelayCredentials,
  InboundWebhookReceiverConfig,
  ConnectionStatus,
  WebhookModeStatus,
  WebhookEvent,
  RelayConnectionState,
} from "./config.js"

export type {
  ModeSelectionResult,
} from "../connection/types.js"

export type {
  WebhookManagerOptions,
  ModeChangeEvent,
} from "./manager.js"

// Note: WebhookManagerState is an interface, accessed via getState() method
// It is not exported separately as it's part of the WebhookManager class

export {
  InboundWebhookModeSchema,
  DirectWebhookConfigSchema,
  RelayWebhookConfigSchema,
  PollingWebhookConfigSchema,
  HealthCheckConfigSchema,
  EventHandlingConfigSchema,
  RelayCredentialsSchema,
  InboundWebhookReceiverConfigSchema,
  ConnectionStatusSchema,
} from "./config.js"

// Mode selection functions are now in connection module
// Use: import { selectMode } from '@firela/billclaw-core/connection'
// Or: import { selectMode } from '@firela/billclaw-core' (re-exported via connection)

export {
  WebhookManager,
  createWebhookManager,
} from "./manager.js"

// Webhook configuration helpers
export type {
  WebhookReceiverConfigOptions,
  WebhookReceiverSetupOptions,
  WebhookReceiverSetupResult,
} from "./helpers.js"

export {
  getRelayConfigDefaults,
  buildWebhookReceiverConfig,
  setupWebhookReceiver,
} from "./helpers.js"
