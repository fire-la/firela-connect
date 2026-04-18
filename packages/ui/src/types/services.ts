/**
 * Service Toggle Type Definitions
 *
 * Types for runtime service toggle system.
 * Services can be enabled/disabled through the Settings page.
 *
 * @packageDocumentation
 */

/**
 * Service identifiers
 */
export type ServiceId = "billclaw" | "firelaBot"

/**
 * Service configuration metadata
 */
export interface ServiceConfig {
  /** Unique service identifier */
  id: ServiceId
  /** Display name for UI */
  name: string
  /** Description shown in Settings page */
  description: string
  /** Route prefixes protected by this toggle */
  routes: string[]
  /** If set, the toggle is disabled and this message is shown */
  disabledReason?: string
}

/**
 * Service toggle state stored in KV
 */
export interface ServiceState {
  /** BillClaw service (Plaid/Gmail sync, transactions) */
  billclaw: boolean
  /** Firela-Bot service (messaging functionality) */
  firelaBot: boolean
}

/**
 * Environment variables for default service states
 * Values are strings ("true" or "false") from wrangler.toml
 */
export interface ServiceEnvDefaults {
  /** Default state for BillClaw service */
  BILLCLAW_ENABLED?: string
  /** Default state for Firela-Bot service */
  FIRELA_BOT_ENABLED?: string
}

/**
 * Service configurations for UI display
 */
export const SERVICE_CONFIGS: ServiceConfig[] = [
  {
    id: "billclaw",
    name: "BillClaw",
    description: "Financial data sync service (Plaid, Gmail, transactions)",
    routes: ["/api/oauth/plaid", "/api/connect", "/api/sync", "/api/export", "/webhook"],
  },
  {
    id: "firelaBot",
    name: "Firela Bot",
    description: "Messaging and notification service",
    routes: ["/api/bot", "/api/messages"],
    disabledReason: "Under development",
  },
]

/**
 * API response for GET /api/services
 */
export interface ServicesApiResponse {
  success: boolean
  data?: ServiceState
  error?: string
  errorCode?: string
}

/**
 * API response for PUT /api/services/:id
 */
export interface ServiceToggleApiResponse {
  success: boolean
  data?: ServiceState
  error?: string
  errorCode?: string
  serviceId?: string
}
