/**
 * Cloudflare Helpers
 *
 * Utilities for Cloudflare API token management with KV-backed storage.
 * The API token is configured via the Settings UI and stored in KV.
 *
 * @packageDocumentation
 */

import { CF_API_TOKEN_KEY } from "../constants.js"

/**
 * Get Cloudflare API token from KV storage.
 *
 * Returns null if not configured.
 */
export async function getCloudflareApiToken(env: {
  CONFIG: KVNamespace
}): Promise<string | null> {
  const stored = await env.CONFIG.get(CF_API_TOKEN_KEY)
  return stored || null
}
