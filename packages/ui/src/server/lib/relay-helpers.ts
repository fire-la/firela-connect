/**
 * Relay Helpers
 *
 * Utilities for relay API key management with KV-backed storage.
 * The relay API key is configured via the Settings UI and stored in KV.
 *
 * @packageDocumentation
 */

import { RELAY_API_KEY_KEY } from "../constants.js"

/**
 * Get relay API key from KV storage.
 *
 * Returns null if not configured.
 */
export async function getRelayApiKey(env: { CONFIG: KVNamespace }): Promise<string | null> {
  const stored = await env.CONFIG.get(RELAY_API_KEY_KEY)
  return stored || null
}
