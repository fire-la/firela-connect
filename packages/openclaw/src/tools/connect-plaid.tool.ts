/**
 * Plaid connection tool for OpenClaw
 *
 * Initiates Plaid OAuth connection flow using unified connection mode selector.
 * Supports Direct and Relay modes for OAuth completion.
 * Uses PKCE (RFC 7636) for security against authorization code interception.
 *
 * @packageDocumentation
 */

import { randomUUID } from "crypto"
import type { OpenClawPluginApi } from "../types/openclaw-plugin.js"
import { parseOauthError, logError } from "@firela/billclaw-core/errors"
import {
  generatePKCEPair,
  initConnectSession,
  retrieveCredential,
  confirmCredentialDeletion,
} from "@firela/billclaw-core/oauth"
import { RELAY_URL } from "@firela/billclaw-core/connection"

/**
 * Default OAuth timeout in milliseconds (10 minutes)
 */
const DEFAULT_OAUTH_TIMEOUT = 10 * 60 * 1000

/**
 * Long-polling timeout in seconds
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
 * Plaid connection tool
 */
export const connectPlaidTool = {
  name: "connect_plaid",
  label: "Connect Plaid Account",
  description:
    "Connect a bank account via Plaid OAuth using unified connection mode (Direct/Relay)",
  parameters: {
    type: "object",
    properties: {
      accountName: {
        type: "string",
        description: "Account name (default: 'Bank Account')",
      },
      timeout: {
        type: "number",
        description: "OAuth timeout in seconds (default: 600)",
      },
      mode: {
        type: "string",
        description: "Force connection mode: 'direct', 'relay', or 'auto' (default: 'auto')",
        enum: ["auto", "direct", "relay"],
      },
    },
  },
  execute: async (
    api: OpenClawPluginApi,
    params: { accountName?: string; timeout?: number; mode?: string },
  ) => {
    try {
      const runtime = await import("../runtime/context.js")
      const { getConfig } = await import("@firela/billclaw-core")
      const { selectConnectionMode } = await import(
        "@firela/billclaw-core/connection",
      )
      const context = new runtime.OpenClawRuntimeContext(api)

      const accountName = params?.accountName ?? "Bank Account"
      const timeoutMs = (params?.timeout ?? 600) * 1000

      // Determine connection mode
      let modeSelection
      if (params?.mode && params.mode !== "auto") {
        modeSelection = {
          mode: params.mode as "direct" | "relay",
          reason: `User configured mode: ${params.mode}`,
          purpose: "oauth" as const,
        }
      } else {
        modeSelection = await selectConnectionMode(context, "oauth")
      }

      // Check if polling mode was selected
      if (modeSelection.mode === "polling") {
        const error = parseOauthError(
          { message: "Polling mode is not supported for OAuth connections" },
          { provider: "generic", operation: "polling" },
        )
        logError(api.logger, error, { tool: "connect_plaid" })

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
                    title: error.humanReadable.title,
                    message: error.humanReadable.message,
                    suggestions: [
                      "Set connect.publicUrl in your config for Direct mode",
                      "Configure Relay credentials for Relay mode",
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

      // Get connection details based on mode
      const config = await getConfig()
      const publicUrl = config.connect?.publicUrl

      // Generate session and connect URL based on mode
      let sessionId: string
      let connectUrl: string
      let modeDescription: string
      let pkcePair: { codeVerifier: string; codeChallenge: string; codeChallengeMethod: "S256" | "plain" } | undefined

      if (modeSelection.mode === "direct" && publicUrl) {
        // Direct mode: No PKCE, use local Connect service (no /api/connect/session endpoint)
        sessionId = randomUUID()
        connectUrl = `${publicUrl}/oauth/plaid/link?session=${sessionId}`
        modeDescription = "Direct (your Connect service)"
      } else {
        // Relay mode: PKCE required, use Firela Relay
        pkcePair = await generatePKCEPair("S256", 128)
        sessionId = await initConnectSession(RELAY_URL, pkcePair)
        connectUrl = `https://connect.firela.io/plaid?session=${sessionId}`
        modeDescription = "Relay (Firela Relay service)"
      }

      // Build response with machine-readable and human-readable output
      const pkceEnabled = modeSelection.mode === "relay"
      const machineReadable = {
        success: true,
        sessionId,
        mode: modeSelection.mode,
        modeReason: modeSelection.reason,
        connectUrl,
        accountName,
        timeoutSeconds: timeoutMs / 1000,
        pkceEnabled,
        status: "pending_user_action",
        nextActions: [
          "Open the provided URL in a browser",
          "Complete the Plaid Link authentication flow",
          "Call pollForPlaidCredential to retrieve the token",
        ],
      }

      const humanReadable = {
        title: "Plaid Bank Account Connection",
        status: "Initiated",
        sessionId,
        mode: modeSelection.mode,
        modeDescription,
        accountName,
        connectUrl,
        timeout: formatDuration(timeoutMs),
        security: pkceEnabled ? "PKCE enabled (S256)" : "Local OAuth (no PKCE)",
        instructions: [
          "1. Open the URL below in your browser",
          "2. Complete the Plaid Link authentication",
          "3. The tool will retrieve the credential automatically",
          `4. Timeout: ${formatDuration(timeoutMs)}`,
        ],
      }

      // Log the initiation
      api.logger?.info?.(
        `Plaid OAuth initiated: session=${sessionId}, mode=${modeSelection.mode}, pkce=${pkceEnabled ? "S256" : "disabled"}`,
      )

      // Return with PKCE info for polling (only for Relay mode)
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                machineReadable,
                humanReadable,
                // Include PKCE info for polling (only for Relay mode)
                ...(pkcePair && {
                  _pkce: {
                    codeVerifier: pkcePair.codeVerifier,
                    codeChallengeMethod: pkcePair.codeChallengeMethod,
                  },
                }),
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
        { provider: "plaid", operation: "link_token" },
      )
      logError(api.logger, userError, { tool: "connect_plaid" })

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
                  title: "Plaid Connection Failed",
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
  },
}

/**
 * Poll for credential completion using PKCE and long-polling
 *
 * Note: Only Relay mode is supported for automatic credential polling.
 * Direct mode requires manual credential handling via the Connect service UI.
 *
 * @param sessionId - Session ID from initConnectSession
 * @param codeVerifier - PKCE code verifier (required for Relay mode)
 * @param mode - Connection mode (only 'relay' supported for auto-polling)
 * @param _publicUrl - Public URL for direct mode (unused, kept for API compatibility)
 * @param timeout - Total timeout in milliseconds
 * @returns Credential data if successful, null if timeout
 * @throws Error if called with Direct mode (not supported)
 */
export async function pollForPlaidCredential(
  sessionId: string,
  codeVerifier: string | undefined,
  mode: "direct" | "relay",
  _publicUrl: string | undefined,
  timeout: number = DEFAULT_OAUTH_TIMEOUT,
): Promise<{ publicToken: string; provider: string; metadata?: string } | null> {
  // Direct mode does not support automatic credential polling
  // The local Connect service does not have /api/connect/* endpoints
  if (mode === "direct") {
    throw new Error(
      "Direct mode does not support automatic credential polling. " +
        "Please complete the OAuth flow in your browser and manually configure the account.",
    )
  }

  if (!codeVerifier) {
    throw new Error("codeVerifier is required for Relay mode")
  }

  const startTime = Date.now()

  // Use long-polling with retries until total timeout
  while (Date.now() - startTime < timeout) {
    try {
      const credential = await retrieveCredential(RELAY_URL, {
        sessionId,
        codeVerifier,
        wait: true,
        timeout: LONG_POLL_TIMEOUT,
      })

      if (credential?.public_token) {
        // Confirm deletion (optional cleanup)
        await confirmCredentialDeletion(RELAY_URL, sessionId).catch(() => {
          // Ignore deletion errors
        })

        return {
          publicToken: credential.public_token,
          provider: credential.provider,
          metadata: credential.metadata,
        }
      }
    } catch (error) {
      const errorMessage = String(error)

      // Check for terminal errors (don't retry)
      if (
        errorMessage.includes("expired") ||
        errorMessage.includes("invalid code_verifier") ||
        errorMessage.includes("maximum retrieval")
      ) {
        throw error
      }

      // For "not found" or "not yet stored", continue polling
      // Ignore transient errors and retry
    }
  }

  return null
}
