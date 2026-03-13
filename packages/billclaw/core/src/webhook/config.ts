/**
 * Unified inbound webhook receiver configuration
 *
 * This module defines configuration schemas for receiving webhooks from external
 * services (Plaid, GoCardless, Gmail) via three modes:
 * - Direct: Webhooks delivered directly to user's Connect service
 * - Relay: Webhooks delivered via Firela Relay WebSocket service
 * - Polling: Fallback mode using direct API calls
 *
 * NOTE: This is INBOUND webhook configuration (receiving notifications FROM external services).
 * Existing WebhookConfigSchema (in models/config.ts) is OUTBOUND (sending notifications TO external URLs).
 *
 * @packageDocumentation
 */

import { z } from "zod"

/**
 * Inbound webhook receiver mode
 *
 * - auto: Automatically detect optimal mode (Direct > Relay > Polling)
 * - direct: Force direct webhook delivery (requires public IP)
 * - relay: Force relay via Firela Relay service
 * - polling: Force API polling fallback
 */
export const InboundWebhookModeSchema = z.enum(["auto", "direct", "relay", "polling"])
export type InboundWebhookMode = z.infer<typeof InboundWebhookModeSchema>

/**
 * Direct mode configuration
 *
 * Webhooks are delivered directly to the user's Connect service.
 * Uses connect.publicUrl as the webhook receiver URL.
 */
export const DirectWebhookConfigSchema = z.object({
  enabled: z.boolean().default(false),
  // URL is derived from connect.publicUrl
})
export type DirectWebhookConfig = z.infer<typeof DirectWebhookConfigSchema>

/**
 * Relay mode configuration
 *
 * Webhooks are delivered via Firela Relay WebSocket service.
 * Credentials are stored in plaintext in config file (user requirement).
 * OAuth flow handles credential acquisition.
 */
export const RelayWebhookConfigSchema = z.object({
  enabled: z.boolean().default(false),
  /**
   * Webhook ID (obtained via OAuth)
   * Format: wh_abc123...
   */
  webhookId: z.string().optional(),
  /**
   * API key (obtained via OAuth)
   * Format: sk_live_def456...
   */
  apiKey: z.string().optional(),
  /**
   * WebSocket URL for relay connection
   */
  wsUrl: z.string().url().default("wss://relay.firela.io/api/webhook-relay/ws"),
  /**
   * API URL for relay service
   */
  apiUrl: z.string().url().default("https://relay.firela.io/api/webhook-relay"),
  /**
   * OAuth URL for credential binding
   */
  oauthUrl: z.string().url().default("https://relay.firela.io/api/oauth/webhook-relay"),
  /**
   * Enable automatic reconnection on WebSocket disconnect
   */
  reconnect: z.boolean().default(true),
  /**
   * Initial reconnection delay in milliseconds
   */
  reconnectDelay: z.number().int().positive().default(1000),
  /**
   * Maximum reconnection delay in milliseconds (5 minutes)
   */
  maxReconnectDelay: z.number().int().positive().default(300000),
  /**
   * Automatically fallback to polling if relay unavailable
   */
  autoFallbackToPolling: z.boolean().default(true),
  /**
   * Enable state recovery on reconnection
   * When enabled, client requests missed events from server after reconnect
   */
  enableRecovery: z.boolean().default(true),
  /**
   * Maximum number of events to recover (0 = unlimited)
   */
  maxRecoveryEvents: z.number().int().min(0).default(100),
})
export type RelayWebhookConfig = z.infer<typeof RelayWebhookConfigSchema>

/**
 * Polling mode configuration
 *
 * Direct API calls to data sources as fallback.
 * Reuses existing sync mechanisms (syncPlaid, syncGoCardless).
 * This interval is for fallback polling when webhook modes fail.
 */
export const PollingWebhookConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /**
   * Fallback polling interval in milliseconds (5 minutes)
   * Separate from sync.defaultFrequency which is user-configured
   */
  interval: z.number().int().positive().default(300000),
})
export type PollingWebhookConfig = z.infer<typeof PollingWebhookConfigSchema>

/**
 * Health check configuration
 */
export const HealthCheckConfigSchema = z.object({
  enabled: z.boolean().default(true),
  interval: z.number().int().positive().default(60000), // 1 minute
  onStartup: z.boolean().default(true),
})
export type HealthCheckConfig = z.infer<typeof HealthCheckConfigSchema>

/**
 * Event handling configuration
 */
export const EventHandlingConfigSchema = z.object({
  immediate: z.boolean().default(true),
  maxConcurrentSyncs: z.number().int().positive().default(3),
})
export type EventHandlingConfig = z.infer<typeof EventHandlingConfigSchema>

/**
 * Relay credentials storage (for reference, stored in relay config)
 *
 * Stored in plaintext in config file (user requirement).
 */
export const RelayCredentialsSchema = z.object({
  webhookId: z.string().min(1),
  apiKey: z.string().min(1),
  userId: z.number().int().optional(),
})
export type RelayCredentials = z.infer<typeof RelayCredentialsSchema>

/**
 * Inbound webhook receiver configuration
 *
 * This is the unified configuration for all three webhook reception modes.
 * Named InboundWebhookReceiverConfigSchema to distinguish from WebhookConfigSchema
 * (which is for OUTBOUND webhooks - sending notifications to external URLs).
 *
 * This configuration is nested under ConnectConfig for clear structure:
 * - Connect is the HTTP server
 * - Connect receives webhooks
 * - Therefore, receiver config belongs under connect
 */
export const InboundWebhookReceiverConfigSchema = z.object({
  mode: InboundWebhookModeSchema.default("auto"),
  direct: DirectWebhookConfigSchema.optional(),
  relay: RelayWebhookConfigSchema.optional(),
  polling: PollingWebhookConfigSchema.optional(),
  healthCheck: HealthCheckConfigSchema.optional(),
  eventHandling: EventHandlingConfigSchema.optional(),
})
export type InboundWebhookReceiverConfig = z.infer<typeof InboundWebhookReceiverConfigSchema>

/**
 * Webhook connection status
 */
export const ConnectionStatusSchema = z.enum([
  "disconnected",
  "connecting",
  "connected",
  "reconnecting",
  "failed",
])
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>

/**
 * Webhook mode status
 */
export interface WebhookModeStatus {
  mode: InboundWebhookMode
  status: ConnectionStatus
  url?: string
  lastActivity?: number
  error?: string
}

/**
 * Webhook event received from external service
 */
export interface WebhookEvent {
  source: "plaid" | "gocardless" | "gmail"
  type: string
  data: unknown
  timestamp: number
}

/**
 * Relay connection state
 */
export interface RelayConnectionState {
  connected: boolean
  connectedAt?: number
  lastHeartbeat?: number
  reconnectAttempts?: number
  error?: string
}
