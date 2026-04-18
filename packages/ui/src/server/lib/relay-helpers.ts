/**
 * Relay Helpers
 *
 * Utilities for relay API key management with KV-backed storage.
 * The relay API key can be configured via:
 * 1. Environment variable (FIRELA_RELAY_API_KEY)
 * 2. KV storage (set via UI settings page)
 *
 * Priority: Environment variable > KV stored value.
 *
 * @packageDocumentation
 */

import { RELAY_API_KEY_KEY } from "../constants.js"

/**
 * Get relay API key from env var or KV.
 *
 * Returns null if neither source has a value.
 */
export async function getRelayApiKey(env: { FIRELA_RELAY_API_KEY?: string; CONFIG: KVNamespace }): Promise<string | null> {
  if (env.FIRELA_RELAY_API_KEY) return env.FIRELA_RELAY_API_KEY
  const stored = await env.CONFIG.get(RELAY_API_KEY_KEY)
  return stored || null
}
