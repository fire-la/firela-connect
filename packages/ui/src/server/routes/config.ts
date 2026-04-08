/**
 * Config API Routes
 *
 * REST API endpoints for configuration management.
 * Uses KV namespace for configuration storage in Cloudflare Workers.
 *
 * Migrated from Express (packages/connect/src/routes/config.ts) to Hono.
 *
 * @packageDocumentation
 */

import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import type { Env } from "../index.js"
import { serverCache, CacheKeys } from "../lib/server-cache.js"

export const configRoutes = new Hono<{ Bindings: Env }>()

// KV key for config storage
const CONFIG_KEY = "billclaw:config"

/**
 * Mask sensitive configuration fields
 */
function maskConfig(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const masked = { ...config }

  // Mask Plaid secret
  if (masked.plaid && typeof masked.plaid === "object") {
    masked.plaid = {
      ...masked.plaid,
      secret: (masked.plaid as Record<string, unknown>).secret
        ? "***"
        : undefined,
    }
  }

  // Mask Gmail credentials
  if (masked.gmail && typeof masked.gmail === "object") {
    const gmail = masked.gmail as Record<string, unknown>
    masked.gmail = {
      ...gmail,
      clientSecret: gmail.clientSecret ? "***" : undefined,
    }
  }

  // Mask VLT API token
  if (masked.vlt && typeof masked.vlt === "object") {
    const vlt = masked.vlt as Record<string, unknown>
    masked.vlt = {
      ...vlt,
      accessToken: vlt.accessToken ? "***" : undefined,
    }
  }

  // Mask account-level sensitive data
  if (Array.isArray(masked.accounts)) {
    masked.accounts = masked.accounts.map((account) => {
      const acc = account as Record<string, unknown>
      return {
        ...acc,
        plaidAccessToken: acc.plaidAccessToken ? "***" : undefined,
        gocardlessAccessToken: acc.gocardlessAccessToken ? "***" : undefined,
        gmailAccessToken: acc.gmailAccessToken ? "***" : undefined,
        gmailRefreshToken: acc.gmailRefreshToken ? "***" : undefined,
      }
    })
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
    // Check if CONFIG KV namespace is available
    if (!c.env.CONFIG) {
      return c.json({
        success: true,
        data: {},
        message: "KV storage not configured",
      })
    }

    // Try cache first, fall back to KV
    let config = serverCache.get<Record<string, unknown>>(CacheKeys.config)
    if (!config) {
      const raw = await c.env.CONFIG.get(CONFIG_KEY, "json")
      if (!raw) {
        return c.json({
          success: true,
          data: {},
        })
      }
      config = raw as Record<string, unknown>
      serverCache.set(CacheKeys.config, config)
    }

    const masked = maskConfig(config)
    return c.json({ success: true, data: masked })
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load config",
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
      // Check if CONFIG KV namespace is available
      if (!c.env.CONFIG) {
        return c.json(
          {
            success: false,
            error: "KV storage not configured",
          },
          400,
        )
      }

      const config = c.req.valid("json")
      await c.env.CONFIG.put(CONFIG_KEY, JSON.stringify(config))
      // Invalidate cache after write
      serverCache.delete(CacheKeys.config)
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
        configPath: "KV:billclaw:config",
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

/**
 * POST /api/export/test
 * Validates export configuration
 */
configRoutes.post("/export/test", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      format?: string
      filePrefix?: string
    }
    const { format, filePrefix } = body

    // Validate export format
    const validFormats = ["beancount", "ledger"]
    if (format && !validFormats.includes(format)) {
      return c.json(
        {
          success: false,
          error: "Invalid export format",
        },
        400,
      )
    }

    // Note: In Cloudflare Workers, file system operations are not available
    // We can only validate the format and structure

    // Validate file prefix is valid filename
    if (filePrefix) {
      const validPrefixRegex = /^[a-zA-Z0-9_-]+$/
      if (!validPrefixRegex.test(filePrefix)) {
        return c.json(
          {
            success: false,
            error: "Invalid file prefix",
          },
          400,
        )
      }
    }

    return c.json({
      success: true,
      message: "Export configuration is valid",
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to test configuration",
      },
      500,
    )
  }
})

/**
 * POST /api/vlt/test
 * Validates VLT (Firela Vault) configuration
 */
configRoutes.post("/vlt/test", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      apiUrl?: string
      accessToken?: string
      region?: string
    }
    const { apiUrl, accessToken, region } = body

    const validRegions = ["cn", "us", "eu-core", "de"]
    if (region && !validRegions.includes(region)) {
      return c.json(
        {
          success: false,
          error: "Invalid region",
        },
        400,
      )
    }

    // Validate API URL
    if (apiUrl) {
      try {
        new URL(apiUrl)
      } catch {
        return c.json(
          {
            success: false,
            error: "Invalid API URL",
          },
          400,
        )
      }
    }

    // If accessToken is provided, validate format
    if (accessToken && accessToken.length < 10) {
      return c.json(
        {
          success: false,
          error: "Access token too short",
        },
        400,
      )
    }

    return c.json({
      success: true,
      message: "Firela Vault configuration is valid",
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to test configuration",
      },
      500,
    )
  }
})

/**
 * POST /api/webhooks/test
 * Validates webhook configuration
 */
configRoutes.post("/webhooks/test", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as {
      mode?: string
      publicUrl?: string
      healthCheckEnabled?: boolean
      healthCheckTimeout?: number
    }
    const { mode, publicUrl, healthCheckEnabled, healthCheckTimeout } = body

    // Validate connection mode
    const validModes = ["auto", "direct", "polling"]
    if (mode && !validModes.includes(mode)) {
      return c.json(
        {
          success: false,
          error: "Invalid connection mode",
        },
        400,
      )
    }

    // For direct mode, validate public URL is reachable
    if (mode === "direct") {
      if (!publicUrl) {
        return c.json(
          {
            success: false,
            error: "Public URL is required for direct mode",
          },
          400,
        )
      }

      // Validate URL format
      try {
        new URL(publicUrl)
      } catch {
        return c.json(
          {
            success: false,
            error: "Invalid public URL format",
          },
          400,
        )
      }

      // Try health check on public URL
      if (healthCheckEnabled) {
        try {
          const controller = new AbortController()
          const timeoutMs = healthCheckTimeout || 5000
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

          const response = await fetch(publicUrl, {
            method: "HEAD",
            signal: controller.signal,
          })

          clearTimeout(timeoutId)

          if (!response.ok) {
            return c.json(
              {
                success: false,
                error: `Public URL returned status ${response.status}`,
              },
              400,
            )
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error"
          return c.json(
            {
              success: false,
              error: `Failed to reach public URL: ${errorMsg}`,
            },
            400,
          )
        }
      }
    }

    return c.json({
      success: true,
      message: "Webhook configuration is valid",
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to test configuration",
      },
      500,
    )
  }
})
