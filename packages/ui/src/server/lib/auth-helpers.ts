/**
 * Auth Helpers
 *
 * Utilities for JWT secret management with KV-backed auto-generation.
 * On first run, secrets are generated and stored in the CONFIG KV namespace
 * so users don't need to manually configure JWT_SECRET or SETUP_PASSWORD.
 *
 * Priority: Environment variable > KV stored value > auto-generated.
 *
 * @packageDocumentation
 */

import { AUTH_SECRET_KEY } from "../constants.js"
import type { Env } from "../index.js"

/**
 * Get JWT signing secret from env var or KV.
 *
 * Returns null if neither source has a value.
 */
export async function getAuthSecret(env: Env): Promise<string | null> {
  if (env.JWT_SECRET) return env.JWT_SECRET
  const stored = await env.CONFIG.get(AUTH_SECRET_KEY)
  return stored || null
}

/**
 * Get or create JWT signing secret.
 *
 * Checks env var first, then KV. If neither exists, generates a new
 * 32-byte hex secret and stores it in KV for future requests.
 */
export async function ensureAuthSecret(env: Env): Promise<string> {
  if (env.JWT_SECRET) return env.JWT_SECRET

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
