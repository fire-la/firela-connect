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
  GMAIL_CLIENT_ID: string
  GMAIL_CLIENT_SECRET: string
  GMAIL_REDIRECT_URI: string
  CONFIG: KVNamespace
}
