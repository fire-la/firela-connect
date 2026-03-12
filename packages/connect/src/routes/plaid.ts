/**
 * Plaid OAuth routes
 *
 * Provides HTTP endpoints for Plaid Link OAuth flow.
 *
 * @packageDocumentation
 */

import express from "express"
import type { Router } from "express"

import {
  parseOauthError,
} from "@firela/billclaw-core/errors"

import {
  plaidOAuthHandler,
  ConfigManager,
} from "@firela/billclaw-core"

import { storeCredential } from "./credentials.js"

export const plaidRouter: Router = express.Router()

/**
 * GET /oauth/plaid/link-token
 *
 * Create a Plaid Link token for initializing the Plaid Link frontend.
 */
plaidRouter.get("/link-token", async (_req, res) => {
  try {
    const configManager = ConfigManager.getInstance()
    const config = await configManager.getServiceConfig("plaid")
    const result = await plaidOAuthHandler(config)

    // Return the Link token and the Plaid Link URL
    res.json({
      success: true,
      linkToken: result.token,
      plaidUrl: result.url,
    })
  } catch (error) {
    const linkError = parseOauthError(
      error as Error | { code?: string; message?: string; status?: number },
      {
        provider: "plaid",
        operation: "link_token",
      },
    )
    // TODO: Add proper logger middleware to Connect service
    console.error("[plaid_link_token]", linkError)

    res.status(500).json({
      success: false,
      error: linkError.humanReadable.message,
      errorCode: linkError.errorCode,
    })
  }
})

/**
 * POST /oauth/plaid/exchange
 *
 * Exchange a Plaid public token for an access token.
 * Optionally stores credential for Direct mode polling.
 *
 * Request body:
 * - publicToken: Plaid public token (required)
 * - accountId: Account identifier (optional)
 * - sessionId: Session ID for credential polling (optional, for Direct mode)
 */
plaidRouter.post("/exchange", async (req, res) => {
  try {
    const { publicToken, accountId, sessionId } = req.body

    if (!publicToken) {
      return res.status(400).json({
        success: false,
        error: "publicToken is required",
      })
    }

    const configManager = ConfigManager.getInstance()
    const config = await configManager.getServiceConfig("plaid")
    const result = await plaidOAuthHandler(config, publicToken, accountId)

    // Store credential for Direct mode polling if sessionId is provided
    if (sessionId) {
      storeCredential(sessionId, {
        provider: "plaid",
        publicToken: publicToken,
        metadata: result.itemId,
      })
    }

    res.json({
      success: true,
      accessToken: result.accessToken,
      itemId: result.itemId,
    })
  } catch (error) {
    const exchangeError = parseOauthError(
      error as Error | { code?: string; message?: string; status?: number },
      {
        provider: "plaid",
        operation: "public_token_exchange",
      },
    )
    // TODO: Add proper logger middleware to Connect service
    console.error("[plaid_token_exchange]", exchangeError)

    res.status(500).json({
      success: false,
      error: exchangeError.humanReadable.message,
      errorCode: exchangeError.errorCode,
    })
  }
})
