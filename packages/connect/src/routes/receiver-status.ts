/**
 * Receiver status routes
 *
 * Provides status and health check endpoints for the inbound webhook receiver.
 *
 * @packageDocumentation
 */

import type { Request, Response, Router } from "express"
import type { InboundWebhookMode } from "@firela/billclaw-core"

/**
 * Get receiver status
 *
 * Returns the current mode and connection status of the webhook receiver.
 */
export async function getReceiverStatus(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    // Get receiver config from ConfigManager
    const { ConfigManager } = await import("@firela/billclaw-core")
    const configManager = ConfigManager.getInstance()
    const config = await configManager.getConfig()
    const receiver = config.connect?.receiver

    if (!receiver) {
      res.json({
        enabled: false,
        mode: null,
        status: "not_configured",
      })
      return
    }

    // Get current mode status
    const modeStatus = await getModeStatus(receiver.mode, config)

    res.json({
      enabled: true,
      mode: receiver.mode,
      direct: {
        enabled: receiver.direct?.enabled ?? false,
        available: modeStatus.directAvailable,
      },
      relay: {
        enabled: receiver.relay?.enabled ?? false,
        configured: !!(receiver.relay?.webhookId && receiver.relay.apiKey),
        available: modeStatus.relayAvailable,
      },
      polling: {
        enabled: receiver.polling?.enabled ?? true,
        interval: receiver.polling?.interval ?? 300000,
      },
      healthCheck: {
        enabled: receiver.healthCheck?.enabled ?? true,
        interval: receiver.healthCheck?.interval ?? 60000,
      },
    })
  } catch (error) {
    res.status(500).json({
      error: "Failed to get receiver status",
      message: (error as Error).message,
    })
  }
}

/**
 * Get receiver health
 *
 * Health check endpoint for the webhook receiver.
 */
export async function getReceiverHealth(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { ConfigManager } = await import("@firela/billclaw-core")
    const configManager = ConfigManager.getInstance()
    const config = await configManager.getConfig()
    const receiver = config.connect?.receiver

    if (!receiver) {
      res.json({
        status: "ok",
        receiver: "not_configured",
      })
      return
    }

    // Check health based on current mode
    let healthy = true
    let message = "Receiver is healthy"

    if (receiver.mode === "direct") {
      // Direct mode is healthy if server is running
      healthy = true
      message = "Direct mode is active"
    } else if (receiver.mode === "relay") {
      // Relay mode is healthy if credentials are configured
      healthy = !!(receiver.relay?.webhookId && receiver.relay.apiKey)
      message = healthy ? "Relay mode is configured" : "Relay mode needs credentials"
    } else if (receiver.mode === "polling") {
      // Polling mode is always healthy
      healthy = true
      message = "Polling mode is active"
    }

    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "unhealthy",
      receiver: receiver.mode,
      message,
    })
  } catch (error) {
    res.status(500).json({
      error: "Failed to get receiver health",
      message: (error as Error).message,
    })
  }
}

/**
 * Get mode status
 */
async function getModeStatus(
  mode: InboundWebhookMode,
  config: any,
): Promise<{
  directAvailable: boolean
  relayAvailable: boolean
}> {
  // Import but don't use - we implement our own simplified version here
  const { isDirectAvailable: _isDirectAvailable, isRelayAvailable: _isRelayAvailable } = await import("@firela/billclaw-core")

  // Simple health check - in production, would use actual mode selector
  const directAvailable = mode === "direct" || mode === "auto"
  const relayAvailable =
    mode === "relay" ||
    mode === "auto" ||
    !!(config.connect?.receiver?.relay?.webhookId)

  return {
    directAvailable,
    relayAvailable,
  }
}

/**
 * Create receiver status routes
 */
export async function createReceiverStatusRoutes(): Promise<Router> {
  const { default: express } = await import("express")
  const router = express.Router()

  router.get("/status", getReceiverStatus)
  router.get("/health", getReceiverHealth)

  return router
}
