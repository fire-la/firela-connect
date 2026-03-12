/**
 * Plaid connect command
 *
 * Connect a bank account via Plaid OAuth flow.
 * Supports Direct and Relay modes for OAuth completion.
 */

import type { CliCommand, CliContext } from "../registry.js"
import { success, logError } from "../../utils/format.js"
import { Spinner } from "../../utils/progress.js"
import {
  selectConnectionMode,
} from "@firela/billclaw-core/connection"
import type { AccountConfig } from "@firela/billclaw-core"
import { randomUUID } from "crypto"
import { parseOauthError, formatOauthError } from "@firela/billclaw-core/errors"
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
 * Long-polling timeout in seconds (for Relay mode)
 */
const LONG_POLL_TIMEOUT = 30

/**
 * Run Plaid connect command
 */
export async function runPlaidConnect(
  context: CliContext,
  args: { name?: string; timeout?: number },
): Promise<void> {
  const { runtime } = context
  const accountName = args.name ?? "Bank Account"
  const timeoutMs = (args.timeout ?? 10) * 60 * 1000

  console.log("")
  console.log("Plaid Bank Account Connection")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("")

  // Check connection mode
  const modeSpinner = new Spinner({ text: "Detecting connection mode..." }).start()
  const modeSelection = await selectConnectionMode(runtime, "oauth")
  modeSpinner.succeed(`Using ${modeSelection.mode} mode`)

  if (modeSelection.mode === "polling") {
    const error = parseOauthError(
      { message: "Polling mode is not supported for OAuth connections" },
      { provider: "generic", operation: "polling" },
    )
    logError(runtime.logger, error, { operation: "plaid_connect" })
    console.error("")
    console.error(formatOauthError(error))
    console.error("")
    console.error("Options:")
    console.error("  1. Set connect.publicUrl in your config for Direct mode")
    console.error("  2. Configure Relay credentials for Relay mode")
    process.exit(1)
  }

  // Get connection details based on mode
  const config = await runtime.config.getConfig()
  const publicUrl = config.connect?.publicUrl

  // Determine session and URL based on mode
  let sessionId: string
  let connectUrl: string
  let pkceCodeVerifier: string | undefined

  if (modeSelection.mode === "direct" && publicUrl) {
    // Direct mode: Use local Connect service (no PKCE needed)
    sessionId = randomUUID()
    connectUrl = `${publicUrl}/oauth/plaid/link?session=${sessionId}`
    console.log("Opening Plaid Link via your Connect service...")
  } else {
    // Relay mode: Use Firela Relay with PKCE
    const pkcePair = await generatePKCEPair("S256", 128)
    pkceCodeVerifier = pkcePair.codeVerifier

    sessionId = await initConnectSession(RELAY_URL, pkcePair)
    connectUrl = `https://connect.firela.io/plaid?session=${sessionId}`
    console.log("Opening Plaid Link via Firela Relay (PKCE enabled)...")
  }

  console.log(`Session ID: ${sessionId}`)
  console.log("")

  console.log("")
  console.log(`Visit ${connectUrl} to authenticate`)
  console.log("")

  // Open browser
  const shouldOpenBrowser = process.env.BILLCLAW_OPEN_BROWSER !== "false"
  if (shouldOpenBrowser) {
    try {
      const { default: open } = await import("open")
      await open(connectUrl)
      console.log("Browser opened. Complete the Plaid Link flow...")
    } catch {
      const error = parseOauthError(
        { message: "Could not open browser automatically" },
        { provider: "plaid", operation: "link_token" },
      )
      logError(runtime.logger, error, { operation: "plaid_browser_open" })
      console.error("Could not open browser automatically.")
      console.error(`Please open this URL manually: ${connectUrl}`)
    }
  } else {
    console.log(`Please open this URL: ${connectUrl}`)
  }

  console.log("")
  console.log(`Waiting for OAuth completion (timeout: ${timeoutMs / 60000} minutes)...`)
  console.log("Press Ctrl+C to cancel")
  console.log("")

  // Poll for credential completion
  const pollSpinner = new Spinner({ text: "Waiting..." }).start()

  try {
    const credential = await pollForCredential(
      context,
      sessionId,
      pkceCodeVerifier, // undefined for Direct mode, string for Relay mode
      modeSelection.mode,
      publicUrl,
      timeoutMs,
    )

    pollSpinner.succeed("OAuth completed successfully!")

    // Save account configuration
    const account: AccountConfig = {
      id: `plaid-${Date.now()}`,
      type: "plaid",
      name: accountName,
      enabled: true,
      syncFrequency: "daily",
      plaidAccessToken: credential.accessToken,
      plaidItemId: credential.itemId,
      lastSync: undefined,
      lastStatus: "pending",
    }

    await saveAccount(runtime, account)

    console.log("")
    success(`Bank account "${accountName}" connected successfully!`)
    console.log("")
    console.log("Account Details:")
    console.log(`  ID: ${account.id}`)
    console.log(`  Type: ${account.type}`)
    if (credential.itemId) {
      console.log(`  Plaid Item ID: ${credential.itemId.substring(0, 12)}...`)
    }
    console.log("")
    console.log("Next steps:")
    console.log(`  billclaw sync --account ${account.id}  - Sync transactions`)
    console.log(`  billclaw status                       - View all accounts`)
  } catch (err) {
    pollSpinner.fail("OAuth failed or timed out")
    const userError = parseOauthError(
      err as Error | { code?: string; message?: string; status?: number },
      { provider: "plaid", operation: "polling", sessionId, timeout: timeoutMs },
    )
    logError(runtime.logger, userError, { operation: "plaid_oauth_polling" })

    console.log(formatOauthError(userError))
    process.exit(1)
  }
}

/**
 * Poll for credential completion
 *
 * @param context - CLI context
 * @param sessionId - Session ID
 * @param codeVerifier - PKCE code verifier (undefined for Direct mode, string for Relay mode)
 * @param mode - Connection mode
 * @param publicUrl - Public URL for Direct mode
 * @param timeout - Timeout in milliseconds
 */
async function pollForCredential(
  context: CliContext,
  sessionId: string,
  codeVerifier: string | undefined,
  mode: string,
  publicUrl?: string,
  timeout: number = DEFAULT_OAUTH_TIMEOUT,
): Promise<{ accessToken: string; itemId?: string }> {
  const { runtime } = context

  // Direct mode: Poll local Connect service
  if (mode === "direct" && publicUrl) {
    const startTime = Date.now()
    const pollUrl = `${publicUrl}/api/connect/credentials/${sessionId}`

    runtime.logger.debug(`Direct mode polling: ${pollUrl}`)

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(pollUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
        })

        if (!response.ok) {
          if (response.status === 404) {
            // Session not found - this is unexpected, throw error
            throw new Error("Session not found or expired")
          }
          // Other errors: continue polling
          runtime.logger.debug(`Poll error: ${response.status}`)
          await sleep(2000)
          continue
        }

        const data = (await response.json()) as {
          success: boolean
          data?: {
            public_token: string
            metadata?: string
          }
        }

        if (data.success && data.data) {
          // Credential ready
          return {
            accessToken: data.data.public_token,
            itemId: data.data.metadata,
          }
        }

        // Credential not ready yet, continue polling
        runtime.logger.debug(`Credential not ready, waiting...`)
        await sleep(2000)
      } catch (error) {
        const errorMessage = String(error)

        // Terminal errors
        if (
          errorMessage.includes("Session not found") ||
          errorMessage.includes("expired")
        ) {
          throw error
        }

        // Transient errors: continue polling
        runtime.logger.debug(`Transient error polling for ${sessionId}: ${errorMessage}`)
        await sleep(2000)
      }
    }

    const timeoutError = parseOauthError(
      { message: "OAuth timed out" },
      { provider: "plaid", operation: "polling", sessionId, timeout },
    )
    logError(runtime.logger, timeoutError, { operation: "plaid_oauth_timeout" })
    throw timeoutError
  }

  // Relay mode: Use PKCE-enabled retrieval
  if (!codeVerifier) {
    throw new Error("code_verifier required for Relay mode")
  }

  const startTime = Date.now()

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
          accessToken: credential.public_token,
          itemId: credential.metadata,
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

      // Log transient errors
      runtime.logger.debug(`Transient error polling for ${sessionId}: ${errorMessage}`)
    }
  }

  const timeoutError = parseOauthError(
    { message: "OAuth timed out" },
    { provider: "plaid", operation: "polling", sessionId, timeout },
  )
  logError(runtime.logger, timeoutError, { operation: "plaid_oauth_timeout" })
  throw timeoutError
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Save account to configuration
 */
async function saveAccount(
  runtime: CliContext["runtime"],
  account: AccountConfig,
): Promise<void> {
  try {
    const config = await runtime.config.getConfig()
    config.accounts.push(account)
    await runtime.config.saveConfig(config)
  } catch (err) {
    const saveError = parseOauthError(
      err as Error | { code?: string; message?: string; status?: number },
      { provider: "plaid", operation: "polling" },
    )
    logError(runtime.logger, saveError, { operation: "plaid_save_account" })
    throw saveError
  }
}

/**
 * Plaid connect command definition
 */
export const plaidConnectCommand: CliCommand = {
  name: "connect-plaid",
  description: "Connect a bank account via Plaid",
  aliases: ["plaid"],
  options: [
    {
      flags: "-n, --name <name>",
      description: "Account name (default: 'Bank Account')",
    },
    {
      flags: "-t, --timeout <minutes>",
      description: "OAuth timeout in minutes (default: 10)",
    },
  ],
  handler: (context, args) =>
    runPlaidConnect(context, args as { name?: string; timeout?: number }),
}
