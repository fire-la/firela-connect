/**
 * Relay health check routes (Hono)
 *
 * Provides endpoint for checking firela-relay service health,
 * including availability, latency, and configuration status.
 *
 * @packageDocumentation
 */

import { Hono } from "hono"
import { RelayClient, maskApiKey } from "@firela/billclaw-core/relay"

import type { Env } from "../index.js"

export const relayRoutes = new Hono<{ Bindings: Env }>()

/**
 * Create a connect session on the relay server
 *
 * Proxies session creation to avoid CORS issues when calling relay from browser.
 * The browser cannot POST directly to the relay due to cross-origin restrictions,
 * so this endpoint acts as a server-side proxy.
 *
 * Request body:
 * - provider: "gmail" | "gocardless" | "plaid"
 * - code_challenge: PKCE code challenge (base64url-encoded SHA-256 hash)
 * - code_challenge_method: "S256"
 *
 * Response:
 * - success: boolean
 * - data: { session_id: string }
 */
relayRoutes.post("/connect/session", async (c) => {
  try {
    if (!c.env.FIRELA_RELAY_URL || !c.env.FIRELA_RELAY_API_KEY) {
      return c.json(
        { success: false, error: "Relay not configured" },
        503,
      )
    }

    const body = await c.req.json<{
      provider?: string
      code_challenge?: string
      code_challenge_method?: string
    }>()

    if (!body.provider || !body.code_challenge) {
      return c.json(
        { success: false, error: "Missing provider or code_challenge" },
        400,
      )
    }

    const relayUrl = c.env.FIRELA_RELAY_URL
    const relayRes = await fetch(`${relayUrl}/api/connect/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${c.env.FIRELA_RELAY_API_KEY}`,
      },
      body: JSON.stringify({
        provider: body.provider,
        code_challenge: body.code_challenge,
        code_challenge_method: body.code_challenge_method || "S256",
      }),
    })

    const data = await relayRes.json() as Record<string, unknown>

    if (!relayRes.ok) {
      return c.json(
        { success: false, error: data.error || "Relay session creation failed" },
        relayRes.status as 400,
      )
    }

    return c.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Relay session creation failed"
    console.error("[relay_connect_session]", error)
    return c.json({ success: false, error: message }, 500)
  }
})

/**
 * Create a RelayClient from environment bindings
 *
 * @param env - Server environment bindings
 * @returns Configured RelayClient instance
 */
function getRelayClient(env: Env): RelayClient {
  return new RelayClient({
    url: env.FIRELA_RELAY_URL!,
    apiKey: env.FIRELA_RELAY_API_KEY!,
  })
}

/**
 * GET /api/relay/health
 *
 * Check relay service health and configuration status.
 *
 * If relay is not configured (missing env vars), returns configured: false.
 * Otherwise, performs a health check against the relay service and returns
 * availability, latency, and masked API key.
 *
 * Response:
 * - success: boolean
 * - data: { available, configured, latency?, error?, relayUrl?, apiKeyMasked?, lastChecked? }
 */
relayRoutes.get("/health", async (c) => {
  try {
    // Check if relay is configured
    if (!c.env.FIRELA_RELAY_URL || !c.env.FIRELA_RELAY_API_KEY) {
      return c.json({
        success: true,
        data: {
          available: false,
          configured: false,
          error: "Relay not configured",
        },
      })
    }

    const client = getRelayClient(c.env)
    const health = await client.healthCheck()

    return c.json({
      success: true,
      data: {
        available: health.available,
        configured: true,
        latency: health.latency,
        error: health.error,
        relayUrl: c.env.FIRELA_RELAY_URL,
        apiKeyMasked: maskApiKey(c.env.FIRELA_RELAY_API_KEY),
        lastChecked: new Date().toISOString(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Relay health check failed"
    console.error("[relay_health]", error)

    return c.json(
      {
        success: false,
        error: message,
      },
      500,
    )
  }
})

/**
 * GET /api/relay/connect/credentials/:sessionId
 *
 * Proxy credential retrieval from relay to avoid CORS issues.
 * Called by the browser after the user completes authorization on the relay.
 *
 * Query params:
 * - code_verifier: PKCE code verifier for credential decryption
 *
 * Response: Proxied from relay (success + credential data, or 410 if expired)
 */
relayRoutes.get("/connect/credentials/:sessionId", async (c) => {
  try {
    if (!c.env.FIRELA_RELAY_URL || !c.env.FIRELA_RELAY_API_KEY) {
      return c.json({ success: false, error: "Relay not configured" }, 503)
    }

    const sessionId = c.req.param("sessionId")
    const codeVerifier = c.req.query("code_verifier")

    if (!codeVerifier) {
      return c.json({ success: false, error: "Missing code_verifier" }, 400)
    }

    const relayUrl = c.env.FIRELA_RELAY_URL
    const relayRes = await fetch(
      `${relayUrl}/api/connect/credentials/${sessionId}?code_verifier=${encodeURIComponent(codeVerifier)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${c.env.FIRELA_RELAY_API_KEY}`,
        },
      },
    )

    const data = await relayRes.json() as Record<string, unknown>
    return c.json(data, relayRes.status as 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Credential retrieval failed"
    console.error("[relay_connect_credentials]", error)
    return c.json({ success: false, error: message }, 500)
  }
})
