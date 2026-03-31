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
