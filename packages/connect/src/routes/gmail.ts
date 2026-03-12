/**
 * Gmail OAuth routes
 *
 * Provides HTTP endpoints for Gmail OAuth 2.0 flow.
 *
 * @packageDocumentation
 */

import express from "express"
import type { Router } from "express"

import {
  parseOauthError,
} from "@firela/billclaw-core/errors"

import {
  gmailOAuthHandler,
  ConfigManager,
} from "@firela/billclaw-core"

import { storeCredential } from "./credentials.js"

export const gmailRouter: Router = express.Router()

/**
 * GET /oauth/gmail/authorize
 *
 * Generate a Gmail OAuth authorization URL.
 */
gmailRouter.get("/authorize", async (req, res) => {
  try {
    const configManager = ConfigManager.getInstance()
    const config = await configManager.getServiceConfig("gmail")
    const redirectUri = req.query.redirectUri as string | undefined

    const result = await gmailOAuthHandler(config, { redirectUri })

    res.json({
      success: true,
      authUrl: result.url,
      state: result.state,
    })
  } catch (error) {
    const authError = parseOauthError(
      error as Error | { code?: string; message?: string; status?: number },
      {
        provider: "gmail",
        operation: "auth_url",
      },
    )
    // TODO: Add proper logger middleware to Connect service
    console.error("[gmail_authorize]", authError)

    res.status(500).json({
      success: false,
      error: authError.humanReadable.message,
      errorCode: authError.errorCode,
    })
  }
})

/**
 * POST /oauth/gmail/exchange
 *
 * Exchange a Gmail authorization code for access token.
 * Optionally stores credential for Direct mode polling.
 *
 * Request body:
 * - code: Authorization code (required)
 * - state: OAuth state parameter (required)
 * - redirectUri: Redirect URI (optional)
 * - sessionId: Session ID for credential polling (optional, for Direct mode)
 */
gmailRouter.post("/exchange", async (req, res) => {
  try {
    const { code, state, redirectUri, sessionId } = req.body

    if (!code || !state) {
      const validationError = parseOauthError(
        { message: "code and state are required" },
        { provider: "gmail", operation: "code_exchange" },
      )
      // TODO: Add proper logger middleware to Connect service
      console.error("[gmail_exchange_validation]", validationError)

      return res.status(400).json({
        success: false,
        error: validationError.humanReadable.message,
        errorCode: validationError.errorCode,
      })
    }

    const configManager = ConfigManager.getInstance()
    const config = await configManager.getServiceConfig("gmail")
    const result = await gmailOAuthHandler(config, { code, state, redirectUri })

    // Store credential for Direct mode polling if sessionId is provided
    if (sessionId) {
      storeCredential(sessionId, {
        provider: "gmail",
        publicToken: result.accessToken ?? "",
        metadata: result.refreshToken ?? "",
      })
    }

    res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    })
  } catch (error) {
    const exchangeError = parseOauthError(
      error as Error | { code?: string; message?: string; status?: number },
      {
        provider: "gmail",
        operation: "code_exchange",
      },
    )
    // TODO: Add proper logger middleware to Connect service
    console.error("[gmail_exchange]", exchangeError)

    res.status(500).json({
      success: false,
      error: exchangeError.humanReadable.message,
      errorCode: exchangeError.errorCode,
    })
  }
})
