/**
 * Config API Routes
 *
 * REST API endpoints for configuration management in Cloudflare Worker.
 * Uses KV namespace for configuration storage.
 */
import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import type { Env } from "../types/env.js"

export const configRoutes = new Hono<{ Bindings: Env }>()

// KV key for config storage
const CONFIG_KEY = "billclaw:config"

/**
 * Mask sensitive configuration fields
 */
function maskConfig(config: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...config }

  // Mask Plaid secret
  if (masked.plaid && typeof masked.plaid === "object") {
    masked.plaid = {
      ...masked.plaid,
      secret: "***",
    }
  }

  // Mask Gmail credentials
  if (masked.gmail && typeof masked.gmail === "object") {
    masked.gmail = {
      ...masked.gmail,
      clientSecret: "***",
      refreshToken: masked.gmail
        ? (masked.gmail as Record<string, unknown>).refreshToken
          ? "***"
          : undefined
        : undefined,
    }
  }

  // Mask IGN API token
  if (masked.ign && typeof masked.ign === "object") {
    masked.ign = {
      ...masked.ign,
      apiToken: "***",
      webhookSecret: "***",
    }
  }

  return masked
}

// Schema for config update
const configUpdateSchema = z.record(z.unknown())

/**
 * GET /api/config
 * Returns the current configuration with sensitive fields masked
 */
configRoutes.get("/config", async (c) => {
  try {
    const config = await c.env.CONFIG.get(CONFIG_KEY, "json")

    if (!config) {
      return c.json({
        success: true,
        data: {},
      })
    }

    const masked = maskConfig(config as Record<string, unknown>)
    return c.json({ success: true, data: masked })
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load config",
      },
      500,
    )
  }
})

/**
 * PUT /api/config
 * Updates the configuration
 */
configRoutes.put(
  "/config",
  zValidator("json", configUpdateSchema),
  async (c) => {
    try {
      const config = c.req.valid("json")
      await c.env.CONFIG.put(CONFIG_KEY, JSON.stringify(config))
      return c.json({ success: true })
    } catch (error) {
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to update config",
        },
        400,
      )
    }
  },
)

/**
 * GET /api/accounts
 * Lists all connected accounts from KV storage
 */
configRoutes.get("/accounts", async (c) => {
  try {
    const accountsKey = "billclaw:accounts"
    const accounts = await c.env.CONFIG.get(accountsKey, "json")

    return c.json({
      success: true,
      data: accounts || [],
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to list accounts",
      },
      500,
    )
  }
})

/**
 * GET /api/system/status
 * Returns system status information
 */
configRoutes.get("/system/status", async (c) => {
  try {
    return c.json({
      success: true,
      data: {
        version: "0.0.1",
        platform: "cloudflare-workers",
        runtime: "edge",
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get system status",
      },
      500,
    )
  }
})
