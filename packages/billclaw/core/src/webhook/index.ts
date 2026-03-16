/**
 * Webhook module exports
 *
 * Unified inbound webhook receiver for Plaid, GoCardless, Gmail.
 *
 * @packageDocumentation
 */

// Configuration types
export type {
  InboundWebhookMode,
  DirectWebhookConfig,
  PollingWebhookConfig,
  HealthCheckConfig,
  EventHandlingConfig,
  InboundWebhookReceiverConfig,
  ConnectionStatus,
  WebhookModeStatus,
  WebhookEvent,
} from "./config.js"

// Configuration schemas
export {
  InboundWebhookModeSchema,
  DirectWebhookConfigSchema,
  PollingWebhookConfigSchema,
  HealthCheckConfigSchema,
  EventHandlingConfigSchema,
  InboundWebhookReceiverConfigSchema,
  ConnectionStatusSchema,
} from "./config.js"

// Webhook manager
export {
  WebhookManager,
  createWebhookManager,
} from "./manager.js"

// Helper functions
export {
  buildWebhookReceiverConfig,
  setupWebhookReceiver,
} from "./helpers.js"
