/**
 * Cloudflare Helpers
 *
 * Utilities for Cloudflare API token management with KV-backed storage.
 * The API token can be configured via:
 * 1. Environment variable (CLOUDFLARE_API_TOKEN)
 * 2. KV storage (set via UI settings page)
 *
 * Priority: Environment variable > KV stored value.
 *
 * @packageDocumentation
 */

import { CF_API_TOKEN_KEY } from "../constants.js"

/**
 * Get Cloudflare API token from env var or KV storage.
 *
 * Env var takes priority. Falls back to KV (set via Settings UI).
 * Returns null if neither source has a value.
 */
export async function getCloudflareApiToken(env: {
  CLOUDFLARE_API_TOKEN?: string
  CONFIG: KVNamespace
}): Promise<string | null> {
  if (env.CLOUDFLARE_API_TOKEN) return env.CLOUDFLARE_API_TOKEN
  const stored = await env.CONFIG.get(CF_API_TOKEN_KEY)
  return stored || null
}
