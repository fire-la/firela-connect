/**
 * Relay module
 *
 * Provides WebSocket client for receiving webhook events via Firela Relay service.
 *
 * @packageDocumentation
 */

export type {
  // Types
  RelayMessage,
  AuthMessage,
  AuthSuccessMessage,
  AuthErrorMessage,
  HeartbeatMessage,
  HeartbeatAckMessage,
  WebhookEventMessage,
  EventAckMessage,
  StateChangeMessage,
  // Protocol
  ConnectionState,
  RelayConnectionConfig,
  RelayConnectionStats,
  // Handlers
  RelayEventHandler,
  RelayStateChangeHandler,
  RelayErrorHandler,
} from "./types.js"

export {
  MessageDirectionSchema,
  ConnectionStateSchema,
} from "./types.js"

export {
  RelayWebSocketClient,
  createRelayClient,
} from "./client.js"

export { calculateBackoffDelay } from "./backoff.js"

export type {
  RelayOAuthOptions,
  RelayOAuthResult,
} from "./oauth.js"

export {
  executeOAuthFlow,
  saveRelayCredentials,
  setupRelayCredentials,
} from "./oauth.js"
