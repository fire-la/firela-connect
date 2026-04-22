/**
 * Auth Helpers
 *
 * Utilities for JWT secret management with KV-backed auto-generation.
 * On first run, secrets are generated and stored in the CONFIG KV namespace
 * so users don't need to manually configure JWT_SECRET or SETUP_PASSWORD.
 *
 * @packageDocumentation
 */

import { AUTH_SECRET_KEY } from "../constants.js"

/**
 * Get JWT signing secret from KV storage.
 *
 * Returns null if not configured.
 */
export async function getAuthSecret(env: { CONFIG: KVNamespace }): Promise<string | null> {
  const stored = await env.CONFIG.get(AUTH_SECRET_KEY)
  return stored || null
}

/**
 * Get or create JWT signing secret.
 *
 * Checks KV first. If not found, generates a new 32-byte hex secret
 * and stores it in KV for future requests.
 */
export async function ensureAuthSecret(env: { CONFIG: KVNamespace }): Promise<string> {
  const stored = await env.CONFIG.get(AUTH_SECRET_KEY)
  if (stored) return stored

  const generated = generateSecret()
  await env.CONFIG.put(AUTH_SECRET_KEY, generated)
  return generated
}

/**
 * Generate a cryptographically random 32-byte hex string.
 *
 * Uses Web Crypto API (available in Cloudflare Workers).
 */
function generateSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}
