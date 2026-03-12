/**
 * PKCE (Proof Key for Code Exchange) utilities
 *
 * Implements PKCE as defined in RFC 7636 for secure OAuth flows.
 * Used to protect against authorization code interception attacks.
 *
 * Workers-compatible: Uses Web Crypto API instead of Node.js crypto.
 *
 * @packageDocumentation
 */

/**
 * PKCE code challenge methods
 */
export type CodeChallengeMethod = "S256" | "plain"

/**
 * PKCE pair containing verifier and challenge
 */
export interface PKCEPair {
  /** Code verifier - random string (43-128 characters) */
  codeVerifier: string
  /** Code challenge - SHA256 hash of verifier (or plain for 'plain' method) */
  codeChallenge: string
  /** Challenge method used */
  codeChallengeMethod: CodeChallengeMethod
}

/**
 * Generate a cryptographically random string for PKCE code verifier
 *
 * The code verifier is a random string of 43-128 characters using
 * the unreserved characters: [A-Z], [a-z], [0-9], "-", ".", "_", "~"
 *
 * Workers-compatible: Uses Web Crypto API (crypto.getRandomValues).
 *
 * @param length - Length of the verifier (default: 128, min: 43, max: 128)
 * @returns Random string suitable for code verifier
 */
export function generateCodeVerifier(length: number = 128): string {
  // Clamp length to valid range
  length = Math.max(43, Math.min(128, length))

  // Generate random bytes using Web Crypto API
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return base64URLEncode(bytes).slice(0, length)
}

/**
 * Generate code challenge from code verifier
 *
 * For S256 method: SHA256 hash of the verifier, base64url encoded (RFC 7636)
 * For plain method: the verifier itself
 *
 * Workers-compatible: Uses Web Crypto API (crypto.subtle.digest).
 *
 * @param codeVerifier - The code verifier string
 * @param method - Challenge method (default: S256)
 * @returns Code challenge string (async for S256)
 */
export async function generateCodeChallenge(
  codeVerifier: string,
  method: CodeChallengeMethod = "S256",
): Promise<string> {
  if (method === "plain") {
    return codeVerifier
  }

  // S256: SHA256 hash, base64url encoded (RFC 7636, matches ToyKit relay server)
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = new Uint8Array(hashBuffer)
  return base64URLEncode(hashArray)
}

/**
 * Generate code challenge synchronously (for Node.js environments only)
 *
 * Falls back to Node.js crypto if Web Crypto API is not available.
 * This function is NOT available in Workers - use generateCodeChallenge instead.
 *
 * @param codeVerifier - The code verifier string
 * @param method - Challenge method (default: S256)
 * @returns Code challenge string
 * @throws Error if called in Workers environment
 */
export function generateCodeChallengeSync(
  codeVerifier: string,
  method: CodeChallengeMethod = "S256",
): string {
  if (method === "plain") {
    return codeVerifier
  }

  // For Node.js environments, use require (synchronous)
  // This is kept for backward compatibility but won't work in Workers
  try {
    // Use require for synchronous import (Node.js only)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require("crypto")
    const hash = nodeCrypto.createHash("sha256").update(codeVerifier).digest()
    return base64URLEncode(hash)
  } catch {
    throw new Error(
      "generateCodeChallengeSync is not available in Workers. Use generateCodeChallenge instead.",
    )
  }
}

/**
 * Generate a complete PKCE pair (verifier + challenge)
 *
 * Workers-compatible: Uses async generateCodeChallenge.
 *
 * @param method - Challenge method (default: S256)
 * @param verifierLength - Length of verifier (default: 128)
 * @returns Promise<PKCEPair> with verifier, challenge, and method
 */
export async function generatePKCEPair(
  method: CodeChallengeMethod = "S256",
  verifierLength: number = 128,
): Promise<PKCEPair> {
  const codeVerifier = generateCodeVerifier(verifierLength)
  const codeChallenge = await generateCodeChallenge(codeVerifier, method)

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: method,
  }
}

/**
 * Verify a code verifier against a code challenge
 *
 * Workers-compatible: Uses async generateCodeChallenge.
 *
 * @param codeChallenge - The stored code challenge
 * @param codeVerifier - The code verifier to verify
 * @param method - Challenge method used
 * @returns Promise<boolean> - True if verification succeeds
 */
export async function verifyPKCE(
  codeChallenge: string,
  codeVerifier: string,
  method: CodeChallengeMethod = "S256",
): Promise<boolean> {
  const expectedChallenge = await generateCodeChallenge(codeVerifier, method)
  return expectedChallenge === codeChallenge
}

/**
 * Base64URL encode (without padding)
 *
 * Base64URL uses '-' and '_' instead of '+' and '/',
 * and omits padding '=' characters.
 *
 * Workers-compatible: Works with Uint8Array using Web APIs.
 *
 * @param buffer - Uint8Array to encode
 * @returns Base64URL encoded string
 */
function base64URLEncode(buffer: Uint8Array): string {
  // Use btoa with binary string conversion (works in both Node.js and Workers)
  let binary = ""
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i])
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

/**
 * Session initialization request
 */
export interface InitSessionRequest {
  codeChallenge: string
  codeChallengeMethod?: CodeChallengeMethod
}

/**
 * Session initialization response
 */
export interface InitSessionResponse {
  success: boolean
  message?: string
  data?: {
    session_id: string
    expires_in: number
  }
}

/**
 * Credential retrieval request
 */
export interface RetrieveCredentialRequest {
  sessionId: string
  codeVerifier: string
  wait?: boolean
  timeout?: number
}

/**
 * Credential retrieval response
 */
export interface RetrieveCredentialResponse {
  success: boolean
  message?: string
  data?: {
    session_id: string
    provider: string
    public_token: string
    metadata?: string
    retrieval_count?: number
    retrieved_at?: number
  }
}

/**
 * Initialize a Connect session with PKCE
 *
 * @param relayUrl - Base URL of the relay service
 * @param pkcePair - PKCE pair containing code_challenge
 * @returns Session ID if successful
 */
export async function initConnectSession(
  relayUrl: string,
  pkcePair: PKCEPair,
): Promise<string> {
  const url = `${relayUrl}/api/connect/session`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code_challenge: pkcePair.codeChallenge,
      code_challenge_method: pkcePair.codeChallengeMethod,
    }),
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Unknown error" })) as { message?: string }
    throw new Error(errorData.message || `Failed to init session: ${response.status}`)
  }

  const result = (await response.json()) as InitSessionResponse

  if (!result.success || !result.data?.session_id) {
    throw new Error(result.message || "Failed to get session ID")
  }

  return result.data.session_id
}

/**
 * Retrieve credential with PKCE verification
 *
 * Supports long-polling for better UX.
 *
 * @param relayUrl - Base URL of the relay service
 * @param request - Retrieval request parameters
 * @returns Credential data if successful
 */
export async function retrieveCredential(
  relayUrl: string,
  request: RetrieveCredentialRequest,
): Promise<RetrieveCredentialResponse["data"]> {
  const { sessionId, codeVerifier, wait = true, timeout = 30 } = request

  // Build URL with query parameters
  const params = new URLSearchParams({
    code_verifier: codeVerifier,
  })

  if (wait) {
    params.set("wait", "true")
    params.set("timeout", String(timeout))
  }

  const url = `${relayUrl}/api/connect/credentials/${sessionId}?${params.toString()}`

  // Use longer timeout for long-polling
  const fetchTimeout = wait ? (timeout + 5) * 1000 : 10000

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(fetchTimeout),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Unknown error" })) as { message?: string }
    throw new Error(errorData.message || `Failed to retrieve credential: ${response.status}`)
  }

  const result = (await response.json()) as RetrieveCredentialResponse

  if (!result.success) {
    throw new Error(result.message || "Failed to retrieve credential")
  }

  return result.data
}

/**
 * Confirm credential deletion after successful retrieval
 *
 * @param relayUrl - Base URL of the relay service
 * @param sessionId - Session ID to confirm deletion
 */
export async function confirmCredentialDeletion(
  relayUrl: string,
  sessionId: string,
): Promise<void> {
  const url = `${relayUrl}/api/connect/credentials/${sessionId}`

  await fetch(url, {
    method: "DELETE",
    signal: AbortSignal.timeout(5000),
  })
}
