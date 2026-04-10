/**
 * OAuth routes environment types
 *
 * Shared environment bindings for OAuth routes.
 *
 * @packageDocumentation
 */

/**
 * Environment bindings for OAuth routes
 */
export type OAuthEnv = {
  PLAID_CLIENT_ID: string
  PLAID_SECRET: string
  PLAID_ENV: string
  CONFIG: KVNamespace
  // Relay environment bindings for OAuth flows
  FIRELA_RELAY_URL: string
  FIRELA_RELAY_API_KEY: string
}
