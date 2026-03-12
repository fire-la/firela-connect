/**
 * Config API Routes
 *
 * REST API endpoints for configuration management.
 * Provides endpoints for reading and updating BillClaw configuration.
 */
import { Router } from "express"
import { join } from "path"
import { ConfigManager } from "@firela/billclaw-core"
import type { BillclawConfig } from "@firela/billclaw-core"

import "fs/promises"
import { access, constants, mkdir, unlink, writeFile } from "fs/promises"

export const configRouter: Router = Router()

/**
 * Mask sensitive configuration fields
 */
function maskConfig(config: BillclawConfig): BillclawConfig {
  const masked = { ...config }

  // Mask Plaid secret
  if (masked.plaid) {
    masked.plaid = {
      ...masked.plaid,
      secret: masked.plaid.secret ? "***" : undefined,
    }
  }

  // Mask Gmail client secret
  if (masked.gmail) {
    masked.gmail = {
      ...masked.gmail,
      clientSecret: masked.gmail.clientSecret ? "***" : undefined,
    }
  }

  // Mask IGN access token
  if (masked.ign) {
    masked.ign = {
      ...masked.ign,
      accessToken: masked.ign.accessToken ? "***" : undefined,
    }
  }

  // Mask account-level sensitive data (tokens, etc.)
  if (masked.accounts) {
    masked.accounts = masked.accounts.map((account) => ({
      ...account,
      plaidAccessToken: account.plaidAccessToken ? "***" : undefined,
      gocardlessAccessToken: account.gocardlessAccessToken ? "***" : undefined,
      gmailAccessToken: account.gmailAccessToken ? "***" : undefined,
      gmailRefreshToken: account.gmailRefreshToken ? "***" : undefined,
    }))
  }

  return masked
}

/**
 * GET /api/config
 * Returns the current configuration with sensitive fields masked
 */
configRouter.get("/config", async (_req, res) => {
  try {
    const configManager = ConfigManager.getInstance()
    const config = await configManager.getConfig()
    const masked = maskConfig(config)
    res.json({ success: true, data: masked })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load config"
    res.status(500).json({ success: false, error: message })
  }
})

/**
 * PUT /api/config
 * Updates the configuration
 */
configRouter.put("/config", async (req, res) => {
  try {
    const configManager = ConfigManager.getInstance()
    // Use updateConfig for partial updates
    await configManager.updateConfig(req.body as Partial<BillclawConfig>)
    res.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update config"
    res.status(400).json({ success: false, error: message })
  }
})

/**
 * GET /api/accounts
 * Lists all connected accounts
 */
configRouter.get("/accounts", async (_req, res) => {
  try {
    const configManager = ConfigManager.getInstance()
    const config = await configManager.getConfig()

    // Transform accounts for UI display
    const accounts = config.accounts.map((account) => ({
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

    res.json({ success: true, data: accounts })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list accounts"
    res.status(500).json({ success: false, error: message })
  }
})

/**
 * GET /api/system/status
 * Returns system status information
 */
configRouter.get("/system/status", async (_req, res) => {
  try {
    res.json({
      success: true,
      data: {
        version: process.env.npm_package_version || "0.5.5",
        platform: process.platform,
        nodeVersion: process.version,
        configPath: "~/.firela/billclaw/config.json",
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get system status"
    res.status(500).json({ success: false, error: message })
  }
})

/**
 * DELETE /api/accounts/:id
 * Remove an account from configuration
 */
configRouter.delete("/accounts/:id", async (req, res) => {
  try {
    const { id } = req.params
    const configManager = ConfigManager.getInstance()
    const config = await configManager.getConfig()

    if (!config.accounts) {
      config.accounts = []
    }

    const accountIndex = config.accounts.findIndex(
      (account) => account.id === id
    )

    if (accountIndex === -1) {
      res.status(404).json({ success: false, error: "Account not found" })
      return
    }

    config.accounts.splice(accountIndex, 1)
    await configManager.updateConfig({ accounts: config.accounts })

    res.status(204).send()
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete account"
    res.status(500).json({ success: false, error: message })
  }
})

/**
 * POST /api/export/test
 * Validates export configuration
 */
configRouter.post("/export/test", async (req, res) => {
  try {
    const { format, outputPath, filePrefix } = req.body

    // Validate export format
    const validFormats = ["beancount", "ledger"]
    if (!validFormats.includes(format)) {
      res.status(400).json({
        success: false,
        error: "Invalid export format",
      })
      return
    }

    // Validate output path exists and is writable
    try {
      await access(outputPath, constants.W_OK)
    } catch {
      // Directory doesn't exist, try to create it
      await mkdir(outputPath, { recursive: true })
    }

    // Validate file prefix is valid filename
    const validPrefixRegex = /^[a-zA-Z0-9_-]+$/
    if (!validPrefixRegex.test(filePrefix)) {
      res.status(400).json({
        success: false,
        error: "Invalid file prefix",
      })
      return
    }

    // Try creating test file to verify write permissions
    const testFilePath = join(outputPath, ".test-write")
    await writeFile(testFilePath, "test")
    await unlink(testFilePath)

    res.json({
      success: true,
      message: "Export configuration is valid",
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to test configuration"
    res.status(500).json({ success: false, error: message })
  }
})

/**
 * POST /api/ign/test
 * Validates IGN (Firela Vault) configuration
 */
configRouter.post("/ign/test", async (req, res) => {
  try {
    const { apiUrl, accessToken, region } = req.body

    const validRegions = ["cn", "us", "eu-core", "de"]
    if (!validRegions.includes(region)) {
      res.status(400).json({
        success: false,
        error: "Invalid region",
      })
      return
    }

    // Validate API URL
    try {
      new URL(apiUrl)
    } catch {
      res.status(400).json({
        success: false,
        error: "Invalid API URL",
      })
      return
    }

    // If accessToken is provided, validate format
    if (accessToken && accessToken.length < 10) {
      res.status(400).json({
        success: false,
        error: "Access token too short",
      })
      return
    }

    // Try API connection (if configured)
    // Note: In production, you would actually make a real API call
    res.json({
      success: true,
      message: "Firela Vault configuration is valid",
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to test configuration"
    res.status(500).json({ success: false, error: message })
  }
})

/**
 * POST /api/webhooks/test
 * Validates webhook configuration
 */
configRouter.post("/webhooks/test", async (req, res) => {
  try {
    const { mode, publicUrl, healthCheckEnabled, healthCheckTimeout } = req.body

    // Validate connection mode
    const validModes = ["auto", "direct", "relay", "polling"]
    if (mode && !validModes.includes(mode)) {
      res.status(400).json({
        success: false,
        error: "Invalid connection mode",
      })
      return
    }

    // For direct mode, validate public URL is reachable
    if (mode === "direct") {
      if (!publicUrl) {
        res.status(400).json({
          success: false,
          error: "Public URL is required for direct mode",
        })
        return
      }

      // Validate URL format
      try {
        new URL(publicUrl)
      } catch {
        res.status(400).json({
          success: false,
          error: "Invalid public URL format",
        })
        return
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
            res.status(400).json({
              success: false,
              error: `Public URL returned status ${response.status}`,
            })
            return
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Unknown error"
          res.status(400).json({
            success: false,
            error: `Failed to reach public URL: ${errorMsg}`,
          })
          return
        }
      }
    }

    // For relay mode, validate relay service is available
    if (mode === "relay") {
      // Note: In production, you would check relay service health
      // For now, we assume relay is always available
    }

    // Polling mode is always valid
    res.json({
      success: true,
      message: "Webhook configuration is valid",
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to test configuration"
    res.status(500).json({ success: false, error: message })
  }
})
