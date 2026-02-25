/**
 * Relay protocol types
 *
 * Defines the WebSocket protocol for communicating with Firela Relay service.
 *
 * @packageDocumentation
 */

import type { WebhookEvent } from "../webhook/config.js"

// Re-export WebhookEvent for convenience
export type { WebhookEvent }

/**
 * WebSocket message direction
 */
export const MessageDirectionSchema = {
  /** Client → Server: Authentication */
  AUTH: "auth",
  /** Server → Client: Authentication success */
  AUTH_SUCCESS: "auth_success",
  /** Server → Client: Authentication failure */
  AUTH_ERROR: "auth_error",
  /** Server → Client: Heartbeat */
  HEARTBEAT: "heartbeat",
  /** Client → Server: Heartbeat response */
  HEARTBEAT_ACK: "heartbeat_ack",
  /** Server → Client: Webhook event received */
  WEBHOOK_EVENT: "webhook_event",
  /** Client → Server: Acknowledge event */
  EVENT_ACK: "event_ack",
  /** Server → Client: Connection state change */
  STATE_CHANGE: "state_change",
  /** Client → Server: Request missed events after reconnection */
  EVENT_RECOVERY: "event_recovery",
  /** Server → Client: Response with missed events */
  EVENT_RECOVERY_RESPONSE: "event_recovery_response",
} as const

export type MessageDirection = (typeof MessageDirectionSchema)[keyof typeof MessageDirectionSchema]

/**
 * Authentication message (Client → Server)
 */
export interface AuthMessage {
  type: typeof MessageDirectionSchema.AUTH
  webhookId: string
  apiKey: string
  timestamp: number
}

/**
 * Auth success message (Server → Client)
 */
export interface AuthSuccessMessage {
  type: typeof MessageDirectionSchema.AUTH_SUCCESS
  serverTime: number
}

/**
 * Auth error message (Server → Client)
 */
export interface AuthErrorMessage {
  type: typeof MessageDirectionSchema.AUTH_ERROR
  error: string
  code: string
}

/**
 * Heartbeat message (Server → Client)
 */
export interface HeartbeatMessage {
  type: typeof MessageDirectionSchema.HEARTBEAT
  timestamp: number
}

/**
 * Heartbeat ack message (Client → Server)
 */
export interface HeartbeatAckMessage {
  type: typeof MessageDirectionSchema.HEARTBEAT_ACK
  timestamp: number
}

/**
 * Webhook event message (Server → Client)
 */
export interface WebhookEventMessage {
  type: typeof MessageDirectionSchema.WEBHOOK_EVENT
  eventId: string
  event: WebhookEvent
  timestamp: number
}

/**
 * Event acknowledge message (Client → Server)
 */
export interface EventAckMessage {
  type: typeof MessageDirectionSchema.EVENT_ACK
  eventId: string
  timestamp: number
}

/**
 * State change message (Server → Client)
 */
export interface StateChangeMessage {
  type: typeof MessageDirectionSchema.STATE_CHANGE
  state: string
  reason?: string
  timestamp: number
}

/**
 * Event recovery request message (Client → Server)
 */
export interface EventRecoveryMessage {
  type: typeof MessageDirectionSchema.EVENT_RECOVERY
  lastEventTimestamp: number
  webhookId: string
  timestamp: number
}

/**
 * Event recovery response message (Server → Client)
 */
export interface EventRecoveryResponseMessage {
  type: typeof MessageDirectionSchema.EVENT_RECOVERY_RESPONSE
  events: WebhookEvent[]
  recovered: boolean
  timestamp: number
}

/**
 * Union type of all relay messages
 */
export type RelayMessage =
  | AuthMessage
  | AuthSuccessMessage
  | AuthErrorMessage
  | HeartbeatMessage
  | HeartbeatAckMessage
  | WebhookEventMessage
  | EventAckMessage
  | StateChangeMessage
  | EventRecoveryMessage
  | EventRecoveryResponseMessage

/**
 * Relay connection state
 */
export const ConnectionStateSchema = {
  /** Not connected */
  DISCONNECTED: "disconnected",
  /** Establishing connection */
  CONNECTING: "connecting",
  /** Connected and authenticated */
  CONNECTED: "connected",
  /** Reconnecting after disconnect */
  RECONNECTING: "reconnecting",
  /** Connection failed (will retry) */
  FAILED: "failed",
  /** Connection closed (will not retry) */
  CLOSED: "closed",
} as const

export type ConnectionState = (typeof ConnectionStateSchema)[keyof typeof ConnectionStateSchema]

/**
 * Relay connection configuration
 */
export interface RelayConnectionConfig {
  /** WebSocket URL */
  wsUrl: string
  /** Webhook ID for authentication */
  webhookId: string
  /** API key for authentication */
  apiKey: string
  /** Enable automatic reconnection */
  reconnect: boolean
  /** Initial reconnection delay (ms) */
  reconnectDelay: number
  /** Maximum reconnection delay (ms) */
  maxReconnectDelay: number
  /** Auto fallback to polling on failure */
  autoFallbackToPolling: boolean
  /** Enable state recovery on reconnection */
  enableRecovery: boolean
  /** Maximum events to recover (0 = unlimited) */
  maxRecoveryEvents: number
}

/**
 * Relay connection stats
 */
export interface RelayConnectionStats {
  /** Connection state */
  state: ConnectionState
  /** When connection was established */
  connectedAt?: number
  /** Last heartbeat timestamp */
  lastHeartbeat?: number
  /** Number of reconnection attempts */
  reconnectAttempts: number
  /** Number of events received */
  eventsReceived: number
  /** Number of events acknowledged */
  eventsAcked: number
  /** Last error message */
  lastError?: string
  /** Timestamp of last successfully processed event */
  lastEventTimestamp?: number
  /** Total number of events recovered after reconnection */
  eventsRecovered: number
}

/**
 * Relay event handler
 */
export type RelayEventHandler = (event: WebhookEvent) => void

/**
 * Relay state change handler
 */
export type RelayStateChangeHandler = (state: ConnectionState, reason?: string) => void

/**
 * Relay error handler
 */
export type RelayErrorHandler = (error: Error) => void
