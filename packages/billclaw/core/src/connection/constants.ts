/**
 * Connection constants
 *
 * Shared constants for connection-related functionality.
 *
 * @packageDocumentation
 */

/**
 * Base URL for the Firela Relay service
 *
 * Used for OAuth flows and other non-webhook relay operations.
 * For webhook-specific URLs (wsUrl, apiUrl, oauthUrl), see webhook/config.ts.
 */
export const RELAY_URL = "https://relay.firela.io"
