/**
 * Setup command
 *
 * Interactive setup wizard for connecting accounts.
 */

import type { CliCommand, CliContext } from "./registry.js"
import inquirer from "inquirer"
import { success, error } from "../utils/format.js"
import {
  readAccountRegistry,
  writeAccountRegistry,
  getStorageDir,
} from "@firela/billclaw-core"
import {
  parseWebhookError,
  logError,
  formatError,
} from "@firela/billclaw-core/errors"
import * as fs from "node:fs/promises"
import * as path from "node:path"

/**
 * Account type prompt answers
 */
interface AccountTypeAnswers {
  accountType: "plaid" | "gmail" | "gocardless" | "webhook"
}

/**
 * Plaid setup answers
 */
interface PlaidAnswers {
  clientId: string
  secret: string
  environment: "sandbox" | "development" | "production"
}

/**
 * Gmail setup answers
 */
interface GmailAnswers {
  credentialsPath: string
  clientId?: string
  clientSecret?: string
}

/**
 * GoCardless setup answers
 */
interface GoCardlessAnswers {
  clientId: string
  secret: string
  environment: "sandbox" | "live"
}

/**
 * Webhook setup answers
 */
interface WebhookAnswers {
  enableWebhook: boolean
  mode: "auto" | "direct" | "relay" | "polling"
  publicUrl?: string
}

/**
 * Run setup wizard
 */
async function runSetup(context: CliContext): Promise<void> {
  console.log("BillClaw Account Setup")
  console.log("")

  const { accountType } = await inquirer.prompt<AccountTypeAnswers>([
    {
      type: "list",
      name: "accountType",
      message: "What type of account would you like to add?",
      choices: [
        { name: "Plaid (Bank accounts via Plaid Link)", value: "plaid" },
        { name: "Gmail (Email bills)", value: "gmail" },
        {
          name: "GoCardless (Bank accounts via open banking)",
          value: "gocardless",
        },
        { name: "Webhook Receiver (Real-time notifications)", value: "webhook" },
      ],
    },
  ])

  try {
    switch (accountType) {
      case "plaid":
        await setupPlaid(context)
        break
      case "gmail":
        await setupGmail(context)
        break
      case "gocardless":
        await setupGoCardless(context)
        break
      case "webhook":
        await setupWebhook(context)
        break
    }

    success("Configuration completed successfully!")
  } catch (err) {
    error("Failed to complete setup: " + (err as Error).message)
    throw err
  }
}

/**
 * Setup Plaid account
 */
async function setupPlaid(context: CliContext): Promise<void> {
  const answers = await inquirer.prompt<PlaidAnswers>([
    {
      type: "input",
      name: "clientId",
      message: "Plaid Client ID:",
      validate: (input: string) => input.length > 0 || "Client ID is required",
    },
    {
      type: "password",
      name: "secret",
      message: "Plaid Secret:",
      mask: "*",
      validate: (input: string) => input.length > 0 || "Secret is required",
    },
    {
      type: "list",
      name: "environment",
      message: "Plaid Environment:",
      choices: [
        { name: "Sandbox (testing)", value: "sandbox" },
        { name: "Development (testing)", value: "development" },
        { name: "Production (live)", value: "production" },
      ],
      default: "sandbox",
    },
  ])

  const accountId = `plaid-${Date.now()}`

  // Get storage configuration
  const storageConfig = await context.runtime.config.getStorageConfig()

  // Read current account registry
  const accounts = await readAccountRegistry(storageConfig)

  // Add new account to registry
  accounts.push({
    id: accountId,
    type: "plaid",
    name: `Plaid Account ${accounts.length + 1}`,
    createdAt: new Date().toISOString(),
  })
  await writeAccountRegistry(accounts, storageConfig)

  // Store credentials to file
  const accountPath = path.join(
    await getStorageDir(storageConfig),
    `accounts/${accountId}.json`,
  )
  await fs.mkdir(path.dirname(accountPath), { recursive: true })
  await fs.writeFile(
    accountPath,
    JSON.stringify(
      {
        plaidAccessToken: null, // Will be populated by OAuth flow
        clientId: answers.clientId,
        secret: answers.secret,
        environment: answers.environment,
      },
      null,
      2,
    ),
  )

  context.runtime.logger.info("Plaid account configured:", accountId)
}

/**
 * Setup Gmail account
 */
async function setupGmail(context: CliContext): Promise<void> {
  const answers = await inquirer.prompt<GmailAnswers>([
    {
      type: "input",
      name: "credentialsPath",
      message: "Path to Gmail credentials JSON:",
      default: "~/.gmail-credentials.json",
    },
    {
      type: "input",
      name: "clientId",
      message: "Gmail OAuth Client ID (optional):",
    },
    {
      type: "password",
      name: "clientSecret",
      message: "Gmail OAuth Client Secret (optional):",
      mask: "*",
    },
  ])

  const accountId = `gmail-${Date.now()}`

  // Get storage configuration
  const storageConfig = await context.runtime.config.getStorageConfig()

  // Read current account registry
  const accounts = await readAccountRegistry(storageConfig)

  // Add new account to registry
  accounts.push({
    id: accountId,
    type: "gmail",
    name: `Gmail Account ${accounts.length + 1}`,
    createdAt: new Date().toISOString(),
  })
  await writeAccountRegistry(accounts, storageConfig)

  // Store credentials to file
  const accountPath = path.join(
    await getStorageDir(storageConfig),
    `accounts/${accountId}.json`,
  )
  await fs.mkdir(path.dirname(accountPath), { recursive: true })
  await fs.writeFile(
    accountPath,
    JSON.stringify(
      {
        gmailRefreshToken: null, // Will be populated by OAuth flow
        credentialsPath: answers.credentialsPath,
        clientId: answers.clientId || null,
        clientSecret: answers.clientSecret || null,
      },
      null,
      2,
    ),
  )

  context.runtime.logger.info("Gmail account configured:", accountId)
}

/**
 * Setup GoCardless account
 */
async function setupGoCardless(context: CliContext): Promise<void> {
  const answers = await inquirer.prompt<GoCardlessAnswers>([
    {
      type: "input",
      name: "clientId",
      message: "GoCardless Client ID:",
      validate: (input: string) => input.length > 0 || "Client ID is required",
    },
    {
      type: "password",
      name: "secret",
      message: "GoCardless Secret:",
      mask: "*",
      validate: (input: string) => input.length > 0 || "Secret is required",
    },
    {
      type: "list",
      name: "environment",
      message: "GoCardless Environment:",
      choices: [
        { name: "Sandbox (testing)", value: "sandbox" },
        { name: "Production (live)", value: "live" },
      ],
      default: "sandbox",
    },
  ])

  const accountId = `gocardless-${Date.now()}`

  // Get storage configuration
  const storageConfig = await context.runtime.config.getStorageConfig()

  // Read current account registry
  const accounts = await readAccountRegistry(storageConfig)

  // Add new account to registry
  accounts.push({
    id: accountId,
    type: "gocardless",
    name: `GoCardless Account ${accounts.length + 1}`,
    createdAt: new Date().toISOString(),
  })
  await writeAccountRegistry(accounts, storageConfig)

  // Store credentials to file
  const accountPath = path.join(
    await getStorageDir(storageConfig),
    `accounts/${accountId}.json`,
  )
  await fs.mkdir(path.dirname(accountPath), { recursive: true })
  await fs.writeFile(
    accountPath,
    JSON.stringify(
      {
        gocardlessAccessToken: null, // Will be populated by OAuth flow
        clientId: answers.clientId,
        secret: answers.secret,
        environment: answers.environment,
      },
      null,
      2,
    ),
  )

  context.runtime.logger.info("GoCardless account configured:", accountId)
}

/**
 * Setup webhook receiver
 */
async function setupWebhook(context: CliContext): Promise<void> {
  console.log("")
  console.log("Webhook Receiver Configuration")
  console.log("==============================")
  console.log("")
  console.log("The webhook receiver enables real-time transaction updates from")
  console.log("external services (Plaid, GoCardless, Gmail).")
  console.log("")
  console.log("Available modes:")
  console.log("  • Auto    - Automatically detects the best mode")
  console.log("  • Direct  - Receives webhooks directly (requires public URL)")
  console.log("  • Relay   - Uses Firela Relay service (no public URL needed)")
  console.log("  • Polling - Falls back to API polling")
  console.log("")

  const answers = await inquirer.prompt<WebhookAnswers>([
    {
      type: "confirm",
      name: "enableWebhook",
      message: "Enable webhook receiver for real-time updates?",
      default: true,
    },
    {
      type: "list",
      name: "mode",
      message: (answers) =>
        answers.enableWebhook
          ? "Select webhook receiver mode:"
          : "Webhook receiver will be disabled. Press Enter to continue...",
      choices: [
        { name: "Auto (recommended) - Automatic mode selection", value: "auto" },
        {
          name: "Direct - For servers with public IP",
          value: "direct",
        },
        {
          name: "Relay - For home/office without public IP",
          value: "relay",
        },
        {
          name: "Polling - Fallback API polling mode",
          value: "polling",
        },
      ],
      default: "auto",
      when: (answers) => answers.enableWebhook,
    },
    {
      type: "input",
      name: "publicUrl",
      message: "Public URL for Direct mode (e.g., https://yourdomain.com):",
      default: async () => {
        try {
          const config = await context.runtime.config.getConfig()
          return config.connect?.publicUrl || ""
        } catch {
          return ""
        }
      },
      when: (answers) => answers.enableWebhook && answers.mode === "direct",
      validate: (input: string) => {
        if (!input) return "Public URL is required for Direct mode"
        try {
          new URL(input)
          return true
        } catch {
          return "Please enter a valid URL (e.g., https://yourdomain.com)"
        }
      },
    },
  ])

  if (!answers.enableWebhook) {
    console.log("")
    console.log("Webhook receiver will remain disabled.")
    console.log("You can enable it later by running: bills setup")
    return
  }

  // Prepare configuration update
  const configUpdate: any = {
    connect: {
      receiver: {
        mode: answers.mode,
      },
    },
  }

  // Add public URL for direct mode
  if (answers.mode === "direct" && answers.publicUrl) {
    configUpdate.connect.publicUrl = answers.publicUrl
  }

  // Configure mode-specific settings using unified helper
  const { setupWebhookReceiver } = await import("@firela/billclaw-core/webhook")

  const setupResult = await setupWebhookReceiver(
    answers.mode,
    context.runtime,
    {
      publicUrl: answers.publicUrl,
      oauthTimeout: 300000,
    },
  )

  if (!setupResult.success) {
    const userError =
      setupResult.userError ??
      parseWebhookError(
        new Error(setupResult.error || "Setup failed"),
        { mode: answers.mode },
      )

    logError(context.runtime.logger, userError, {
      command: "setup",
      mode: answers.mode,
    })
    error(formatError(userError))

    // Fallback to polling mode on error
    console.log("")
    console.log("Falling back to polling mode...")
    configUpdate.connect.receiver.mode = "polling"
    configUpdate.connect.receiver.polling = { enabled: true, interval: 300000 }
  } else {
    // Merge the setup result into config update
    Object.assign(configUpdate.connect.receiver, setupResult.config)

    if (answers.mode === "relay") {
      success("OAuth authorization completed successfully!")
    }
  }

  // Save configuration
  try {
    const { updateConfig } = await import("@firela/billclaw-core")
    await updateConfig(configUpdate)

    console.log("")
    success(`Webhook receiver configured in ${answers.mode} mode`)
    console.log("")
    console.log("Next steps:")

    switch (answers.mode) {
      case "direct":
        console.log("  1. Ensure Connect service is running")
        console.log(`  2. Configure webhooks to: ${answers.publicUrl}/webhook/plaid`)
        break
      case "relay":
        console.log("  1. Webhook receiver is active via Firela Relay")
        console.log("  2. Use 'bills webhook-receiver status' to verify connection")
        break
      case "polling":
        console.log("  1. Webhooks will be fetched via API polling")
        console.log(`  2. Polling interval: 5 minutes`)
        break
      case "auto":
        console.log("  1. Webhook receiver will auto-detect optimal mode")
        console.log("  2. Use 'bills webhook-receiver status' to check current mode")
        break
    }

    context.runtime.logger.info("Webhook receiver configured")
  } catch (err) {
    const userError =
      err instanceof Error && (err as any).type === "UserError"
        ? (err as any)
        : parseWebhookError(err as Error, { mode: answers.mode })

    logError(context.runtime.logger, userError, { command: "setup", mode: answers.mode })
    error(formatError(userError))
    throw err
  }
}

/**
 * Setup command definition
 */
export const setupCommand: CliCommand = {
  name: "setup",
  description: "Interactive setup wizard for connecting accounts",
  aliases: ["init"],
  handler: runSetup,
}
