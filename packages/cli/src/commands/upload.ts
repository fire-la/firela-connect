/**
 * Upload command
 *
 * Upload transactions to Firela Vault (IGN Beancount SaaS).
 */

import type { CliCommand, CliContext } from "./registry.js"
import { Spinner } from "../utils/progress.js"
import {
  Billclaw,
  UploadService,
  createCredentialStore,
  CredentialStrategy,
} from "@firela/billclaw-core"

/**
 * Run upload command
 */
async function runUpload(
  context: CliContext,
  args: { account?: string; dryRun?: boolean },
): Promise<void> {
  const { runtime } = context
  const billclaw = new Billclaw(runtime)
  const config = await runtime.config.getConfig()

  // Check if Firela Vault is configured
  if (!config.ign?.accessToken) {
    console.log("Firela Vault is not configured. Please add your access token to the configuration.")
    console.log("")
    console.log("Configuration example:")
    console.log("  ign:")
    console.log("    apiUrl: https://ign-dev.firela.io/api/v1")
    console.log("    accessToken: your-access-token-from-app")
    console.log("    region: cn")
    console.log("    upload:")
    console.log("      sourceAccount: Assets:Bank:Chase")
    return
  }

  if (!config.ign?.upload) {
    console.log("Firela Vault upload is not configured. Please add upload configuration.")
    console.log("")
    console.log("Configuration example:")
    console.log("  ign:")
    console.log("    upload:")
    console.log("      sourceAccount: Assets:Bank:Chase")
    console.log("      defaultCurrency: USD")
    console.log("      defaultExpenseAccount: Expenses:Unknown")
    console.log("      defaultIncomeAccount: Income:Unknown")
    return
  }

  const accountId = args.account
  const dryRun = args.dryRun ?? false
  const storageConfig = await runtime.config.getStorageConfig()

  // Create credential store for JWT token caching
  const credentialStore = createCredentialStore({
    strategy: CredentialStrategy.KEYCHAIN,
    logger: runtime.logger,
  })

  console.log("")
  console.log(`Uploading transactions to Firela Vault (region: ${config.ign.region})...`)
  console.log("")

  const uploadService = new UploadService(
    config.ign,
    storageConfig,
    credentialStore,
    runtime.logger,
  )

  // Start background token refresh
  uploadService.startBackgroundRefresh()

  // Get accounts to upload
  const accounts = await billclaw.getAccounts()
  const accountsToUpload = accountId
    ? accounts.filter((a) => a.id === accountId)
    : accounts

  if (accountsToUpload.length === 0) {
    if (accountId) {
      console.log(`Account ${accountId} not found.`)
    } else {
      console.log("No accounts found. Run 'billclaw setup' first.")
    }
    return
  }

  let totalUploaded = 0
  let totalImported = 0
  let totalSkipped = 0
  let totalPendingReview = 0
  let totalFailed = 0
  const errors: string[] = []

  for (const account of accountsToUpload) {
    const spinner = new Spinner({
      text: `Uploading ${account.id}...`,
    }).start()

    try {
      const result = await uploadService.uploadAccountTransactions(account.id, {
        days: 30, // Upload last 30 days by default
        dryRun,
      })

      totalUploaded += result.transactionsUploaded

      if (result.result) {
        totalImported += result.result.imported
        totalSkipped += result.result.skipped
        totalPendingReview += result.result.pendingReview
        totalFailed += result.result.failed

        if (dryRun) {
          spinner.succeed(
            `${account.id}: Would upload ${result.transactionsUploaded} transactions`,
          )
        } else {
          spinner.succeed(
            `${account.id}: ${result.result.imported} imported, ${result.result.skipped} skipped, ${result.result.pendingReview} pending review, ${result.result.failed} failed`,
          )
        }
      } else {
        spinner.succeed(`${account.id}: No transactions to upload`)
      }
    } catch (err) {
      const errorMessage =
        err && typeof err === "object" && "humanReadable" in err
          ? (err as any).humanReadable.message
          : err instanceof Error
            ? err.message
            : String(err)
      spinner.fail(`${account.id}: ${errorMessage}`)
      errors.push(`${account.id}: ${errorMessage}`)
    }
  }

  console.log("")
  if (dryRun) {
    console.log("Dry Run Summary:")
    console.log(`  Would upload: ${totalUploaded} transactions`)
  } else {
    console.log("Upload Summary:")
    console.log(`  Total uploaded: ${totalUploaded}`)
    console.log(`  Imported: ${totalImported}`)
    console.log(`  Skipped: ${totalSkipped}`)
    console.log(`  Pending review: ${totalPendingReview}`)
    console.log(`  Failed: ${totalFailed}`)
  }

  if (errors.length > 0) {
    console.log("")
    console.log("Errors:")
    for (const err of errors) {
      console.log(`  - ${err}`)
    }
    console.log("")
    console.log("Note: Local data has been preserved for all accounts.")
  }
}

/**
 * Upload command definition
 */
export const uploadCommand: CliCommand = {
  name: "upload",
  description: "Upload transactions to Firela Vault (IGN Beancount SaaS)",
  options: [
    {
      flags: "-a, --account <id>",
      description: "Specific account ID to upload (default: all)",
    },
    {
      flags: "--dry-run",
      description: "Preview what would be uploaded without sending",
    },
  ],
  handler: (context, args) =>
    runUpload(context, args as { account?: string; dryRun?: boolean }),
}
