/**
 * Gmail connect command
 *
 * Connect Gmail account via relay server.
 * All OAuth operations are proxied through the relay server.
 * No local Gmail OAuth credentials required.
 */

import type { CliCommand, CliContext } from "../registry.js"
import { success } from "../../utils/format.js"
import { Spinner } from "../../utils/progress.js"
import type { AccountConfig } from "@firela/billclaw-core"
import {
  generatePKCEPair,
  initiateGmailRelayAuth,
  retrieveGmailRelayCredential,
} from "@firela/billclaw-core/oauth"

/**
 * Polling interval in milliseconds
 */
const POLL_INTERVAL = 2000

/**
 * Run Gmail connect command (relay-only mode)
 */
export async function runGmailConnect(
  context: CliContext,
  args: { email?: string; timeout?: number },
): Promise<void> {
  const { runtime } = context
  const timeoutMs = (args.timeout ?? 10) * 60 * 1000

  console.log("")
  console.log("Gmail Account Connection")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("")

  // Get relay URL from config
  const config = await runtime.config.getConfig()
  const relayBaseUrl = config.connect?.publicUrl

  if (!relayBaseUrl) {
    console.error("Error: connect.publicUrl not configured")
    console.error("")
    console.error("Please add the following to your config:")
    console.error("  connect:")
    console.error("    publicUrl: https://relay.firela.io")
    process.exit(1)
  }

  console.log(`Mode: Relay (via ${relayBaseUrl})`)
  console.log("")

  // Generate PKCE pair for secure session
  const pkceSpinner = new Spinner({ text: "Generating PKCE challenge..." }).start()
  const pkcePair = await generatePKCEPair("S256", 128)
  pkceSpinner.succeed("PKCE challenge generated")

  // Create connect session on relay server
  const sessionSpinner = new Spinner({ text: "Creating connect session..." }).start()
  const { sessionId, authorizeUrl } = await initiateGmailRelayAuth(
    relayBaseUrl,
    pkcePair.codeChallenge,
  )
  sessionSpinner.succeed("Connect session created")

  console.log("")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("")
  console.log(`Visit ${authorizeUrl} to authenticate`)
  console.log("")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("")

  // Open browser
  const shouldOpenBrowser = process.env.BILLCLAW_OPEN_BROWSER !== "false"
  if (shouldOpenBrowser) {
    try {
      const { default: open } = await import("open")
      await open(authorizeUrl)
    } catch {
      // Browser open failed, user will see URL above
    }
  }

  console.log(`Waiting for authorization (timeout: ${Math.floor(timeoutMs / 60000)} minutes)...`)
  console.log("Press Ctrl+C to cancel")
  console.log("")

  // Poll for credential
  const pollSpinner = new Spinner({ text: "Waiting for authorization..." }).start()
  const startTime = Date.now()

  let credential: {
    accessToken: string
    expiresIn: number
    email: string
  } | null = null

  while (Date.now() - startTime < timeoutMs) {
    try {
      credential = await retrieveGmailRelayCredential(
        relayBaseUrl,
        sessionId,
        pkcePair.codeVerifier,
      )
      break
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)

      // Terminal errors
      if (errorMessage.includes("session expired")) {
        pollSpinner.fail("Session expired")
        throw err
      }

      // Credential not ready yet or transient error: continue polling
      await sleep(POLL_INTERVAL)
    }
  }

  if (!credential) {
    pollSpinner.fail("Authorization timed out")
    throw new Error("Authorization timed out. Please try again.")
  }

  pollSpinner.succeed("Authorization completed!")

  // Save account -- email flows from relay metadata to accountConfig.gmailEmailAddress
  await saveGmailAccount(runtime, credential, args.email)

  console.log("")
  success("Gmail account connected successfully!")
  console.log("")
  console.log("Next steps:")
  console.log("  billclaw sync --type gmail  - Fetch bills from Gmail")
  console.log("  billclaw status             - View all accounts")
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Save Gmail account to configuration
 */
async function saveGmailAccount(
  runtime: CliContext["runtime"],
  credential: { accessToken: string; expiresIn: number; email: string },
  emailOverride?: string,
): Promise<void> {
  // Use relay-returned email (most reliable), fall back to override
  const emailAddress = emailOverride || credential.email

  // Calculate token expiry
  const tokenExpiry = new Date(
    Date.now() + credential.expiresIn * 1000,
  ).toISOString()

  // Save account configuration
  const config = await runtime.config.getConfig()
  const account: AccountConfig = {
    id: `gmail-${Date.now()}`,
    type: "gmail",
    name: emailAddress ?? "Gmail Account",
    enabled: true,
    syncFrequency: "daily",
    gmailEmailAddress: emailAddress, // Critical: email stored for relay refresh calls
    gmailAccessToken: credential.accessToken,
    // Note: gmailRefreshToken NOT set -- relay holds it
    gmailTokenExpiry: tokenExpiry,
    lastSync: undefined,
    lastStatus: "pending",
  }

  config.accounts.push(account)
  await runtime.config.saveConfig(config)

  console.log("")
  console.log("Account Details:")
  console.log(`  ID: ${account.id}`)
  console.log(`  Type: ${account.type}`)
  console.log(`  Email: ${emailAddress}`)
}

/**
 * Gmail connect command definition
 */
export const gmailConnectCommand: CliCommand = {
  name: "connect-gmail",
  description: "Connect Gmail account for bill extraction",
  aliases: ["gmail"],
  options: [
    {
      flags: "-e, --email <email>",
      description: "Email address (auto-detected if not provided)",
    },
    {
      flags: "-t, --timeout <minutes>",
      description: "OAuth timeout in minutes (default: 10)",
    },
  ],
  handler: (context, args) =>
    runGmailConnect(context, args as { email?: string; timeout?: number }),
}
