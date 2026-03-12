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

export const configRoutes = new Hono<{ Bindings: Env }>()

// KV key for config storage
const CONFIG_KEY = "billclaw:config"
const ACCOUNTS_KEY = "billclaw:accounts"

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

  // Mask IGN API token
  if (masked.ign && typeof masked.ign === "object") {
    const ign = masked.ign as Record<string, unknown>
    masked.ign = {
      ...ign,
      accessToken: ign.accessToken ? "***" : undefined,
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
    // Check if CONFIG KV namespace is available
    if (!c.env.CONFIG) {
      return c.json({
        success: true,
        data: [],
        message: "KV storage not configured",
      })
    }

    const accounts = await c.env.CONFIG.get(ACCOUNTS_KEY, "json")

    // Transform accounts for UI display
    const accountList = Array.isArray(accounts) ? accounts : []
    const transformedAccounts = accountList.map((account: Record<string, unknown>) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      enabled: account.enabled,
      lastSync: account.lastSync || null,
      lastStatus: account.lastStatus || null,
      status:
        account.type === "plaid"
          ? account.plaidAccessToken
            ? "connected"
            : "disconnected"
          : account.type === "gmail"
            ? account.gmailRefreshToken
              ? "connected"
              : "disconnected"
            : account.type === "gocardless"
              ? account.gocardlessAccessToken
                ? "connected"
                : "disconnected"
              : "unknown",
    }))

    return c.json({
      success: true,
      data: transformedAccounts,
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
 * DELETE /api/accounts/:id
 * Remove an account from configuration
 */
configRoutes.delete("/accounts/:id", async (c) => {
  try {
    const { id } = c.req.param()

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

    const accounts = await c.env.CONFIG.get(ACCOUNTS_KEY, "json")
    const accountList: Record<string, unknown>[] = Array.isArray(accounts)
      ? accounts
      : []

    const accountIndex = accountList.findIndex(
      (account) => account.id === id,
    )

    if (accountIndex === -1) {
      return c.json({ success: false, error: "Account not found" }, 404)
    }

    accountList.splice(accountIndex, 1)
    await c.env.CONFIG.put(ACCOUNTS_KEY, JSON.stringify(accountList))

    return c.body(null, 204)
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete account",
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
    const body = await c.req.json<{
      format?: string
      outputPath?: string
      filePrefix?: string
    }>().catch(() => ({}))
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
 * POST /api/ign/test
 * Validates IGN (Firela Vault) configuration
 */
configRoutes.post("/ign/test", async (c) => {
  try {
    const body = await c.req.json<{
      apiUrl?: string
      accessToken?: string
      region?: string
    }>().catch(() => ({}))
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
    const body = await c.req.json<{
      mode?: string
      publicUrl?: string
      healthCheckEnabled?: boolean
      healthCheckTimeout?: number
    }>().catch(() => ({}))
    const { mode, publicUrl, healthCheckEnabled, healthCheckTimeout } = body

    // Validate connection mode
    const validModes = ["auto", "direct", "relay", "polling"]
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

    // For relay mode, validate relay service is available
    if (mode === "relay") {
      // Note: In production, you would check relay service health
      // For now, we assume relay is always available
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
