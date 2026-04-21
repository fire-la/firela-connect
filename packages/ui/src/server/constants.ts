/**
 * Server Constants
 *
 * Default values for environment bindings.
 * Used as fallbacks when env vars are not set in Cloudflare Workers.
 *
 * @packageDocumentation
 */

/** Default Relay service URL (production) */
export const DEFAULT_RELAY_URL = "https://relay.firela.io"

/** Default Plaid environment */
export const DEFAULT_PLAID_ENV = "sandbox"

/** KV key for auto-generated JWT signing secret */
export const AUTH_SECRET_KEY = "firela:auth:jwt_secret"

/** KV key for setup password (set on first /auth/setup call) */
export const SETUP_PASSWORD_KEY = "firela:auth:setup_password"

/** KV key for relay API key (configured via UI settings) */
export const RELAY_API_KEY_KEY = "firela:relay:api_key"

/** KV key for Cloudflare API token (configured via UI settings) */
export const CF_API_TOKEN_KEY = "firela:cloudflare:api_token"
