/**
 * Plaid Webhook JWT Verification
 *
 * Implements JWT-based webhook verification as required by Plaid.
 * Uses /webhook_verification_key/get endpoint to fetch JWK public keys.
 *
 * @packageDocumentation
 */

import { importJWK, jwtVerify } from "jose"
import type { Env } from "../types/env.js"

/**
 * Result of webhook JWT verification
 */
export interface WebhookVerifyResult {
  valid: boolean
  error?: string
}

/**
 * Cached JWK key
 */
interface CachedKey {
  jwk: JsonWebKey
  fetchedAt: number
}

// Simple in-memory cache for JWK keys (within Worker invocation)
// Note: Each Worker invocation gets fresh memory, so this only helps
// when multiple webhooks are verified in the same invocation
const keyCache = new Map<string, CachedKey>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * Get Plaid API base URL based on environment
 */
function getPlaidBaseUrl(env: Env): string {
  switch (env.PLAID_ENV) {
    case "production":
      return "https://production.plaid.com"
    case "development":
      return "https://development.plaid.com"
    case "sandbox":
    default:
      return "https://sandbox.plaid.com"
  }
}

/**
 * Fetch JWK public key from Plaid
 */
async function fetchVerificationKey(
  kid: string,
  env: Env,
): Promise<JsonWebKey | null> {
  // Check cache first
  const cached = keyCache.get(kid)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.jwk
  }

  try {
    const response = await fetch(
      `${getPlaidBaseUrl(env)}/webhook_verification_key/get`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.PLAID_CLIENT_ID,
          secret: env.PLAID_SECRET,
          key_id: kid,
        }),
      },
    )

    if (!response.ok) {
      console.error(
        "[webhook] Failed to fetch verification key:",
        response.status,
      )
      return null
    }

    const data = (await response.json()) as { key?: JsonWebKey }
    const jwk = data.key

    if (!jwk) {
      console.error("[webhook] No key in response")
      return null
    }

    // Cache the key
    keyCache.set(kid, { jwk, fetchedAt: Date.now() })

    return jwk
  } catch (error) {
    console.error("[webhook] Error fetching verification key:", error)
    return null
  }
}

/**
 * Compute SHA-256 hash of request body
 *
 * Returns lowercase hex string
 */
async function computeBodyHash(body: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(body)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = new Uint8Array(hashBuffer)
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Constant-time comparison for Uint8Arrays
 *
 * Custom implementation for Cloudflare Workers which doesn't have crypto.timingSafeEqual
 * This prevents timing attacks by ensuring comparison time is independent of input values
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  // Lengths must match
  if (a.length !== b.length) {
    return false
  }

  // XOR all bytes and check if result is zero
  // This takes constant time regardless of input values
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }
  return result === 0
}

/**
 * Constant-time string comparison to prevent timing attacks
 *
 * Converts strings to Uint8Arrays and uses timing-safe comparison
 */
function timingSafeEqualStrings(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)

  // Lengths must match for timingSafeEqual
  if (aBytes.length !== bBytes.length) {
    return false
  }

  return timingSafeEqual(aBytes, bBytes)
}

/**
 * Verify Plaid webhook using JWT verification
 *
 * Plaid uses JWT-based webhook verification (not HMAC-SHA256).
 * This implementation:
 * 1. Decodes JWT header to get key ID (kid)
 * 2. Fetches JWK public key from Plaid's /webhook_verification_key/get
 * 3. Verifies JWT signature with 5-minute max age
 * 4. Computes SHA-256 hash of request body
 * 5. Compares hash with JWT's request_body_sha256 using timing-safe comparison
 *
 * @param body - The raw request body as a string
 * @param plaidVerificationHeader - The Plaid-Verification header (JWT)
 * @param env - Worker environment with Plaid credentials
 * @returns Whether the webhook is valid
 */
export async function verifyPlaidWebhookJWT(
  body: string,
  plaidVerificationHeader: string,
  env: Env,
): Promise<WebhookVerifyResult> {
  if (!plaidVerificationHeader) {
    return { valid: false, error: "Missing Plaid-Verification header" }
  }

  try {
    // 1. Decode JWT header to get key ID (kid)
    let header: { kid?: string }
    try {
      // decodeJwt returns the decoded header (not payload)
      // We need to use decodeJwt from jose which returns { header, payload }
      // But jose's decodeJwt only returns payload, so we need to manually decode header
      const parts = plaidVerificationHeader.split(".")
      if (parts.length !== 3) {
        return { valid: false, error: "Invalid JWT format" }
      }
      const headerBytes = Uint8Array.from(atob(parts[0]), (c) =>
        c.charCodeAt(0),
      )
      header = JSON.parse(new TextDecoder().decode(headerBytes))
    } catch {
      return { valid: false, error: "Failed to decode JWT header" }
    }

    const kid = header.kid
    if (!kid) {
      return { valid: false, error: "Missing kid in JWT header" }
    }

    // 2. Fetch JWK public key from Plaid
    const jwk = await fetchVerificationKey(kid, env)
    if (!jwk) {
      return { valid: false, error: "Failed to fetch verification key" }
    }

    // 3. Import JWK for verification
    const publicKey = await importJWK(jwk, "ES256")

    // 4. Verify JWT signature with 5-minute max age
    const { payload } = await jwtVerify(plaidVerificationHeader, publicKey, {
      maxTokenAge: 300, // 5 minutes in seconds - prevents replay attacks
    })

    // 5. Compute body hash and compare using constant-time comparison
    const bodyHash = await computeBodyHash(body)
    const expectedHash = payload.request_body_sha256 as string | undefined

    if (!expectedHash) {
      return { valid: false, error: "Missing request_body_sha256 in JWT" }
    }

    // CRITICAL: Use timing-safe comparison to prevent timing attacks
    if (!timingSafeEqualStrings(bodyHash, expectedHash)) {
      return { valid: false, error: "Body hash mismatch" }
    }

    return { valid: true }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Verification error"
    console.error("[webhook] JWT verification failed:", errorMessage)
    return { valid: false, error: errorMessage }
  }
}
