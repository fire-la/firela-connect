/**
 * OAuth routes environment types
 *
 * Shared environment bindings for OAuth routes.
 *
 * @packageDocumentation
 */

/**
 * Environment bindings for OAuth routes
 *
 * All fields optional to support zero-config deploy (Relay mode).
 */
export type OAuthEnv = {
  CONFIG: KVNamespace
  // Relay environment bindings for OAuth flows
  FIRELA_RELAY_URL?: string
}
