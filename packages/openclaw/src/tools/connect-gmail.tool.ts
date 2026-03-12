/**
 * Gmail connection tool for OpenClaw
 *
 * Supports two OAuth modes:
 * - Relay mode (default): Uses Firela Relay for OAuth with PKCE (RFC 7636)
 * - Direct mode (--direct-gmail): Uses Device Code Flow (RFC 8628) directly with Google
 *
 * @packageDocumentation
 */

import type { OpenClawPluginApi } from "../types/openclaw-plugin.js"
import { parseOauthError, logError } from "@firela/billclaw-core/errors"
import {
  generatePKCEPair,
  initConnectSession,
  retrieveCredential,
  confirmCredentialDeletion,
} from "@firela/billclaw-core/oauth"
import { formatUserCode } from "@firela/billclaw-core/utils"
import { RELAY_URL } from "@firela/billclaw-core/connection"

/**
 * Polling interval for Device Code Flow in milliseconds
 */
const POLL_INTERVAL = 5000

/**
 * Default OAuth timeout in milliseconds (10 minutes)
 */
const DEFAULT_OAUTH_TIMEOUT = 10 * 60 * 1000

/**
 * Long-polling timeout in seconds for relay mode
 */
const LONG_POLL_TIMEOUT = 30

/**
 * Format time duration for display
 */
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

/**
 * Gmail connection tool
 */
export const connectGmailTool = {
  name: "connect_gmail",
  label: "Connect Gmail Account",
  description:
    "Connect Gmail account via OAuth. Default: Relay mode (browser-based). Use directMode=true for Device Code Flow (requires own credentials).",
  parameters: {
    type: "object",
    properties: {
      email: {
        type: "string",
        description: "Email address (optional, will be auto-detected)",
      },
      timeout: {
        type: "number",
        description: "OAuth timeout in seconds (default: 600)",
      },
      directMode: {
        type: "boolean",
        description:
          "Use Device Code Flow directly with Google (requires gmail.clientId and gmail.clientSecret in config). Default: false (use relay)",
      },
    },
  },
  execute: async (
    api: OpenClawPluginApi,
    params: { email?: string; timeout?: number; directMode?: boolean },
  ) => {
    const timeoutMs = (params?.timeout ?? 600) * 1000

    // Direct mode: Use Device Code Flow (RFC 8628)
    if (params?.directMode) {
      return executeDirectMode(api, params, timeoutMs)
    }

    // Default: Relay mode with PKCE
    return executeRelayMode(api, params, timeoutMs)
  },
}

/**
 * Execute relay mode OAuth flow
 */
async function executeRelayMode(
  api: OpenClawPluginApi,
  _params: { email?: string; timeout?: number },
  timeoutMs: number,
) {
  try {
    // Generate PKCE pair (async for Workers compatibility)
    const pkcePair = await generatePKCEPair("S256", 128)

    // Initialize session with relay
    const sessionId = await initConnectSession(RELAY_URL, pkcePair)

    // Build authorize URL (points to toykit relay)
    const authorizeUrl = `${RELAY_URL}/api/oauth/gmail/authorize/${sessionId}`

    api.logger?.info?.(
      `Gmail OAuth (relay mode): session=${sessionId}, pkce=S256`,
    )

    // Return with machine-readable and human-readable output
    const machineReadable = {
      success: true,
      mode: "relay",
      sessionId,
      authorizeUrl,
      timeoutSeconds: timeoutMs / 1000,
      pkceEnabled: true,
      status: "pending_user_action",
      nextActions: [
        "Open the authorize URL in a browser",
        "Complete Google OAuth authentication",
        "Tool will poll for credential completion",
      ],
    }

    const humanReadable = {
      title: "Gmail Account Connection - Relay Mode",
      status: "OAuth Initiated",
      mode: "Relay (Firela Relay service)",
      sessionId,
      authorizeUrl,
      timeout: formatDuration(timeoutMs),
      security: "PKCE enabled (S256)",
      instructions: [
        "1. Open the URL below in your browser",
        "2. Sign in to your Google account",
        "3. Grant read-only access to Gmail",
        "4. The tool will retrieve the credential automatically",
        `5. Timeout: ${formatDuration(timeoutMs)}`,
      ],
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              machineReadable,
              humanReadable,
              // For polling by background service
              _pollConfig: {
                sessionId,
                codeVerifier: pkcePair.codeVerifier,
                relayUrl: RELAY_URL,
                timeoutMs,
              },
            },
            null,
            2,
          ),
        },
      ],
    }
  } catch (error) {
    const userError = parseOauthError(
      error as Error | { code?: string; message?: string },
      { provider: "gmail", operation: "auth_url" },
    )
    logError(api.logger, userError, { tool: "connect_gmail", mode: "relay" })

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              machineReadable: {
                success: false,
                error: {
                  errorCode: userError.errorCode,
                  category: userError.category,
                  recoverable: userError.recoverable,
                },
              },
              humanReadable: {
                title: "Gmail Connection Failed (Relay Mode)",
                message: userError.humanReadable.message,
                suggestions: [
                  ...userError.humanReadable.suggestions,
                  "Alternatively, use directMode=true with your own Gmail OAuth credentials",
                ],
              },
            },
            null,
            2,
          ),
        },
      ],
    }
  }
}

/**
 * Execute direct mode OAuth flow (Device Code Flow)
 */
async function executeDirectMode(
  api: OpenClawPluginApi,
  _params: { email?: string; timeout?: number },
  timeoutMs: number,
) {
  try {
    const { getConfig } = await import("@firela/billclaw-core")
    const config = await getConfig()
    const gmailConfig = config.gmail

    // Check Gmail OAuth configuration (required for direct mode)
    if (!gmailConfig?.clientId || !gmailConfig?.clientSecret) {
      const error = parseOauthError(
        {
          message: "Gmail OAuth credentials not configured",
          code: "GMAIL_OAUTH_NOT_CONFIGURED",
        },
        { provider: "gmail", operation: "auth_url" },
      )
      logError(api.logger, error, { tool: "connect_gmail", mode: "direct" })

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                machineReadable: {
                  success: false,
                  error: {
                    errorCode: error.errorCode,
                    category: error.category,
                    recoverable: error.recoverable,
                  },
                },
                humanReadable: {
                  title: "Gmail OAuth Not Configured",
                  message:
                    "Direct mode requires Gmail OAuth credentials (clientId and clientSecret)",
                  instructions: [
                    "Add to your config:",
                    "  gmail:",
                    "    clientId: your-client-id",
                    "    clientSecret: your-client-secret",
                    "",
                    "You can obtain these from Google Cloud Console:",
                    "  https://console.cloud.google.com/apis/credentials",
                    "",
                    "Alternatively, omit directMode=true to use relay mode (no config needed)",
                  ],
                },
              },
              null,
              2,
            ),
          },
        ],
      }
    }

    // Request device code from Google
    const deviceCodeResponse = await fetch(
      "https://oauth2.googleapis.com/device/code",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: gmailConfig.clientId,
          scope: "https://www.googleapis.com/auth/gmail.readonly",
        }).toString(),
        signal: AbortSignal.timeout(10000),
      },
    )

    if (!deviceCodeResponse.ok) {
      const errorText = await deviceCodeResponse.text()
      throw new Error(`Failed to get device code: ${errorText}`)
    }

    const deviceData = (await deviceCodeResponse.json()) as {
      user_code: string
      verification_url: string
      device_code: string
      expires_in: number
      interval: number
    }

    const userCode = deviceData.user_code
    const verificationUrl = deviceData.verification_url
    const deviceCode = deviceData.device_code
    const expiresIn = deviceData.expires_in * 1000 // Convert to ms
    const pollInterval = (deviceData.interval ?? 5) * 1000

    api.logger?.info?.(
      `Gmail OAuth (direct mode): user_code=${userCode}, expires_in=${expiresIn}ms`,
    )

    // Return machine-readable and human-readable output
    const machineReadable = {
      success: true,
      mode: "direct",
      status: "pending_user_authorization",
      userCode,
      formattedUserCode: formatUserCode(userCode),
      verificationUrl,
      deviceCode,
      expiresIn,
      timeoutMs: Math.min(timeoutMs, expiresIn),
      pollInterval,
      nextActions: [
        `Go to ${verificationUrl}`,
        `Enter code: ${formatUserCode(userCode)}`,
        "Wait for authorization to complete",
      ],
    }

    const humanReadable = {
      title: "Gmail Account Connection - Direct Mode (Device Code Flow)",
      status: "Device Code Generated",
      mode: "Direct (your own OAuth credentials)",
      instructions: [
        `1. Go to: ${verificationUrl}`,
        `2. Enter code: ${formatUserCode(userCode)}`,
        `3. Authorize the application`,
        `4. Wait for authorization (expires in ${formatDuration(expiresIn)})`,
      ],
      verificationUrl,
      userCode: formatUserCode(userCode),
      expiresInMinutes: Math.floor(expiresIn / 60000),
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              machineReadable,
              humanReadable,
              // For polling by background service
              _pollConfig: {
                mode: "direct",
                deviceCode,
                clientId: gmailConfig.clientId,
                clientSecret: gmailConfig.clientSecret,
                timeoutMs: Math.min(timeoutMs, expiresIn),
              },
            },
            null,
            2,
          ),
        },
      ],
    }
  } catch (error) {
    const userError = parseOauthError(
      error as Error | { code?: string; message?: string },
      { provider: "gmail", operation: "auth_url" },
    )
    logError(api.logger, userError, { tool: "connect_gmail", mode: "direct" })

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              machineReadable: {
                success: false,
                error: {
                  errorCode: userError.errorCode,
                  category: userError.category,
                  severity: userError.severity,
                  recoverable: userError.recoverable,
                },
              },
              humanReadable: {
                title: "Gmail Connection Failed (Direct Mode)",
                message: userError.humanReadable.message,
                suggestions: userError.humanReadable.suggestions,
              },
            },
            null,
            2,
          ),
        },
      ],
    }
  }
}

/**
 * Poll for Gmail credential from relay service
 *
 * This is used by background services to poll for OAuth completion
 * when using relay mode.
 */
export async function pollForGmailCredential(
  sessionId: string,
  codeVerifier: string,
  timeoutMs: number = DEFAULT_OAUTH_TIMEOUT,
): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
} | null> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    try {
      const credential = await retrieveCredential(RELAY_URL, {
        sessionId,
        codeVerifier,
        wait: true,
        timeout: LONG_POLL_TIMEOUT,
      })

      if (credential?.public_token) {
        // Parse the token JSON stored by relay
        const tokenData = JSON.parse(credential.public_token) as {
          access_token: string
          refresh_token: string
          expires_in: number
        }

        // Confirm deletion
        await confirmCredentialDeletion(RELAY_URL, sessionId).catch(() => {})

        return {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
        }
      }
    } catch (error) {
      // Session not ready yet, continue polling
      const err = error as { message?: string }
      if (err.message?.includes("not yet stored")) {
        // Expected, continue polling
      } else {
        // Unexpected error, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  return null
}

/**
 * Poll for Gmail token completion via Device Code Flow
 *
 * This is used by background services for direct mode.
 */
export async function pollForGmailToken(
  clientId: string,
  clientSecret: string,
  deviceCode: string,
  timeout: number = DEFAULT_OAUTH_TIMEOUT,
): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
} | null> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const tokenResponse = await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            device_code: deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          }).toString(),
          signal: AbortSignal.timeout(10000),
        },
      )

      if (tokenResponse.ok) {
        const tokenData = (await tokenResponse.json()) as {
          access_token: string
          refresh_token: string
          expires_in: number
        }
        return {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
        }
      }

      const errorData = (await tokenResponse.json()) as { error: string }
      if (errorData.error === "authorization_pending") {
        // User hasn't authorized yet, keep polling
      } else if (errorData.error === "slow_down") {
        // Poll too fast, increase interval
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL * 2))
        continue
      } else if (errorData.error === "expired_token") {
        // Device code expired
        return null
      } else if (errorData.error === "access_denied") {
        // User denied access
        return null
      }
    } catch {
      // Ignore network errors, retry
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
  }

  return null
}

/**
 * Get email address from Gmail API using access token
 */
export async function getGmailEmailAddress(
  accessToken: string,
): Promise<string | null> {
  try {
    const profileResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(10000),
      },
    )

    if (profileResponse.ok) {
      const profile = (await profileResponse.json()) as {
        emailAddress: string
      }
      return profile.emailAddress
    }
    return null
  } catch {
    return null
  }
}
