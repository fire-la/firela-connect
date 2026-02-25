/**
 * Relay OAuth credential flow
 *
 * Manages OAuth flow for obtaining relay credentials from Firela Relay service.
 *
 * @packageDocumentation
 */

import * as http from "node:http"
import { randomBytes } from "node:crypto"
import type { RuntimeContext } from "../runtime/types.js"
import type { RelayCredentials } from "../webhook/config.js"

// Re-export for convenience
export type { RelayCredentials }

/**
 * OAuth options
 */
export interface RelayOAuthOptions {
  /**
   * OAuth authorization URL
   */
  oauthUrl: string
  /**
   * Local server port for callback
   */
  callbackPort?: number
  /**
   * OAuth client ID
   */
  clientId?: string
  /**
   * Timeout for OAuth flow (ms)
   */
  timeout?: number
}

/**
 * OAuth flow result
 */
export interface RelayOAuthResult {
  success: boolean
  credentials?: RelayCredentials
  error?: string
}

/**
 * Generate random state for OAuth security
 */
function generateState(): string {
  return randomBytes(16).toString("hex")
}

/**
 * Open URL in browser (platform-specific)
 */
async function openBrowser(url: string, context: RuntimeContext): Promise<void> {
  if (context.platform?.openUrl) {
    await context.platform.openUrl(url)
  } else {
    context.logger.info("Please open this URL in your browser:", url)
  }
}

/**
 * Execute OAuth flow to obtain relay credentials
 *
 * This function:
 * 1. Starts a local HTTP server for OAuth callback
 * 2. Generates OAuth authorization URL with state parameter
 * 3. Opens browser to authorization page
 * 4. Waits for callback with authorization code
 * 5. Exchanges code for relay credentials
 * 6. Returns credentials
 */
export async function executeOAuthFlow(
  options: RelayOAuthOptions,
  context: RuntimeContext,
): Promise<RelayOAuthResult> {
  const { oauthUrl, callbackPort = 34567, timeout = 300000 } = options

  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url?.startsWith("/callback")) {
        handleCallback(req, res)
      }
    })

    let timeoutHandle: NodeJS.Timeout | null = null
    let expectedState: string | null = null // Store expected state for CSRF verification

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
      server.close()
      expectedState = null
    }

    /**
     * Handle OAuth callback
     */
    async function handleCallback(
      req: http.IncomingMessage,
      res: http.ServerResponse,
    ) {
      try {
        const url = new URL(req.url || "", `http://localhost:${callbackPort}`)
        const code = url.searchParams.get("code")
        const state = url.searchParams.get("state")
        const error = url.searchParams.get("error")

        if (error) {
          context.logger.error("OAuth error:", error)
          sendResponse(res, "Authorization failed or was cancelled")
          cleanup()
          resolve({
            success: false,
            error: error || "Authorization cancelled",
          })
          return
        }

        if (!code) {
          sendResponse(res, "Missing authorization code")
          cleanup()
          resolve({
            success: false,
            error: "Missing authorization code",
          })
          return
        }

        // Verify state parameter for CSRF protection
        if (expectedState && state !== expectedState) {
          context.logger.error("State mismatch - possible CSRF attack")
          sendResponse(res, "Authorization failed - state mismatch")
          cleanup()
          resolve({
            success: false,
            error: "State mismatch",
          })
          return
        }

        // Exchange code for credentials
        context.logger.debug("Exchanging authorization code for credentials")

        const credentials = await exchangeCodeForCredentials(
          code,
          options,
          context,
        )

        if (credentials) {
          sendResponse(res, "Authorization successful! You can close this window.")
          cleanup()
          resolve({
            success: true,
            credentials,
          })
        } else {
          sendResponse(res, "Failed to exchange code for credentials")
          cleanup()
          resolve({
            success: false,
            error: "Failed to exchange code for credentials",
          })
        }
      } catch (error) {
        context.logger.error("OAuth callback error:", error)
        sendResponse(res, "An error occurred during authorization")
        cleanup()
        resolve({
          success: false,
          error: String(error),
        })
      }
    }

    /**
     * Send HTML response
     */
    function sendResponse(res: http.ServerResponse, message: string) {
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>BillClaw OAuth Callback</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .message {
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="message">
            <h2>BillClaw Authorization</h2>
            <p>${message}</p>
          </div>
        </body>
        </html>
      `)
    }

    /**
     * Exchange authorization code for relay credentials
     */
    async function exchangeCodeForCredentials(
      code: string,
      opts: RelayOAuthOptions,
      ctx: RuntimeContext,
    ): Promise<RelayCredentials | null> {
      try {
        // Extract API URL from OAuth URL
        const apiUrl = opts.oauthUrl.replace("/api/oauth/webhook-relay", "")

        const response = await fetch(`${apiUrl}/api/oauth/webhook-relay/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        })

        if (!response.ok) {
          ctx.logger.error("Token exchange failed:", response.statusText)
          return null
        }

        const data = (await response.json()) as {
          success?: boolean
          message?: string
          data?: {
            webhook_id: string
            api_key: string
            user_id?: number
          }
        }

        if (!data.success) {
          ctx.logger.error("Token exchange error:", data.message)
          return null
        }

        return {
          webhookId: data.data?.webhook_id ?? "",
          apiKey: data.data?.api_key ?? "",
          userId: data.data?.user_id,
        }
      } catch (error) {
        ctx.logger.error("Token exchange error:", error)
        return null
      }
    }

    // Start server
    server.listen(callbackPort, () => {
      expectedState = generateState() // State for CSRF protection
      const callbackUrl = `http://localhost:${callbackPort}/callback`

      // Build authorization URL
      const authUrl = new URL(oauthUrl)
      authUrl.searchParams.set("redirect_uri", callbackUrl)
      authUrl.searchParams.set("response_type", "code")
      authUrl.searchParams.set("state", expectedState) // Include state for CSRF protection

      if (options.clientId) {
        authUrl.searchParams.set("client_id", options.clientId)
      }

      context.logger.info("Starting OAuth flow...")
      context.logger.debug("Callback URL:", callbackUrl)

      // Open browser
      openBrowser(authUrl.toString(), context)

      // Set timeout
      timeoutHandle = setTimeout(() => {
        context.logger.warn("OAuth flow timed out")
        cleanup()
        resolve({
          success: false,
          error: "OAuth flow timed out",
        })
      }, timeout)
    })

    server.on("error", (error) => {
      context.logger.error("OAuth server error:", error)
      cleanup()
      resolve({
        success: false,
        error: String(error),
      })
    })
  })
}

/**
 * Save relay credentials to config
 */
export async function saveRelayCredentials(
  credentials: RelayCredentials,
  context: RuntimeContext,
): Promise<void> {
  const config = await context.config.getConfig()
  const existingConnect = config.connect ?? {}
  const existingReceiver = existingConnect.receiver
  const existingRelay = existingReceiver?.relay

  await context.config.updateConfig({
    connect: {
      // Preserve existing connect fields
      port: existingConnect.port ?? 4456,
      host: existingConnect.host ?? "localhost",
      publicUrl: existingConnect.publicUrl,
      tls: existingConnect.tls,
      // Update receiver config
      receiver: {
        mode: existingReceiver?.mode ?? "relay",
        direct: existingReceiver?.direct,
        polling: existingReceiver?.polling,
        healthCheck: existingReceiver?.healthCheck,
        eventHandling: existingReceiver?.eventHandling,
        relay: {
          enabled: true,
          webhookId: credentials.webhookId,
          apiKey: credentials.apiKey,
          wsUrl: existingRelay?.wsUrl ?? "wss://relay.firela.io/api/webhook-relay/ws",
          apiUrl: existingRelay?.apiUrl ?? "https://relay.firela.io/api/webhook-relay",
          oauthUrl: existingRelay?.oauthUrl ?? "https://relay.firela.io/api/oauth/webhook-relay",
          reconnect: existingRelay?.reconnect ?? true,
          reconnectDelay: existingRelay?.reconnectDelay ?? 1000,
          maxReconnectDelay: existingRelay?.maxReconnectDelay ?? 300000,
          autoFallbackToPolling: existingRelay?.autoFallbackToPolling ?? true,
          enableRecovery: existingRelay?.enableRecovery ?? true,
          maxRecoveryEvents: existingRelay?.maxRecoveryEvents ?? 100,
        },
      },
    },
  })

  context.logger.info("Relay credentials saved to config")
}

/**
 * Execute full OAuth flow and save credentials
 */
export async function setupRelayCredentials(
  options: RelayOAuthOptions,
  context: RuntimeContext,
): Promise<RelayOAuthResult> {
  const result = await executeOAuthFlow(options, context)

  if (result.success && result.credentials) {
    await saveRelayCredentials(result.credentials, context)
  }

  return result
}
