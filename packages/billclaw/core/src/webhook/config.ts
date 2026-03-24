/**
 * Unified inbound webhook receiver configuration
 *
 * This module defines configuration schemas for receiving webhooks from external
 * services (Plaid, GoCardless, Gmail) via three modes:
 * - Relay: Webhooks via firela-relay service (no public IP required)
 * - Direct: Webhooks delivered directly to user's Connect service
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
 * - auto: Automatically detect optimal mode (Relay > Direct > Polling)
 * - relay: Force relay mode (requires relay.url and relay.apiKey)
 * - direct: Force direct webhook delivery (requires public IP)
 * - polling: Force API polling fallback
 */
export const InboundWebhookModeSchema = z.enum(["auto", "relay", "direct", "polling"])
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
 * Inbound webhook receiver configuration
 *
 * This is the unified configuration for all webhook reception modes.
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
