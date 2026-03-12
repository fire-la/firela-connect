/**
 * Sync command
 *
 * Manually trigger transaction sync from configured accounts.
 */

import type { CliCommand, CliContext } from "./registry.js"
import { Spinner } from "../utils/progress.js"
import { success, formatStatus } from "../utils/format.js"
import {
  Billclaw,
  formatError,
  UploadService,
  createCredentialStore,
  CredentialStrategy,
  type IgnUploadResult,
} from "@firela/billclaw-core"

/**
 * Run sync command
 */
async function runSync(
  context: CliContext,
  args: {
    account?: string
    all?: boolean
    upload?: boolean
    localOnly?: boolean
  },
): Promise<void> {
  const { runtime } = context
  const billclaw = new Billclaw(runtime)

  const accountId = args.account
  const syncAll = args.all ?? false
  const shouldUpload = args.upload ?? false
  const localOnly = args.localOnly ?? false

  if (syncAll || !accountId) {
    await syncAllAccounts(billclaw, runtime, shouldUpload, localOnly)
  } else {
    await syncSingleAccount(billclaw, accountId, runtime, shouldUpload, localOnly)
  }
}

/**
 * Sync all configured accounts
 */
async function syncAllAccounts(
  billclaw: Billclaw,
  runtime: any,
  shouldUpload: boolean = false,
  localOnly: boolean = false,
): Promise<void> {
  const spinner = new Spinner({ text: "Getting accounts..." }).start()

  try {
    const accounts = await billclaw.getAccounts()
    spinner.succeed(`Found ${accounts.length} account(s)`)

    if (accounts.length === 0) {
      console.log("No accounts configured. Run 'billclaw setup' first.")
      return
    }

    let totalAdded = 0
    let totalUpdated = 0
    const errors: string[] = []
    const uploadResults: Array<{ accountId: string; result?: IgnUploadResult; error?: string }> = []

    for (const account of accounts) {
      const accountSpinner = new Spinner({
        text: `Syncing ${account.id}...`,
      }).start()

      try {
        let results
        switch (account.type) {
          case "plaid":
            results = await billclaw.syncPlaid([account.id])
            break
          case "gmail":
            results = await billclaw.syncGmail([account.id])
            break
          default:
            throw new Error(`Unknown account type: ${account.type}`)
        }

        const added = results.reduce((sum, r) => sum + r.transactionsAdded, 0)
        const updated = results.reduce(
          (sum, r) => sum + r.transactionsUpdated,
          0,
        )
        totalAdded += added
        totalUpdated += updated

        accountSpinner.succeed(
          `${account.id}: ${formatStatus("success")} (+${added}, ~${updated})`,
        )

        for (const result of results) {
          if (result.errors) {
            // Convert UserError[] to formatted strings for display
            for (const userError of result.errors) {
              errors.push(formatError(userError))
            }
          }
        }

        // Handle upload after successful sync
        if (!localOnly) {
          const uploadResult = await handleUpload(
            account.id,
            runtime,
            shouldUpload,
          )
          if (uploadResult) {
            uploadResults.push(uploadResult)
          }
        }
      } catch (err) {
        accountSpinner.fail(`${account.id}: ${(err as Error).message}`)
        errors.push(`${account.id}: ${(err as Error).message}`)
      }
    }

    console.log("")
    console.log("Sync Summary:")
    console.log(`  Transactions added: ${totalAdded}`)
    console.log(`  Transactions updated: ${totalUpdated}`)

    // Display upload results
    if (uploadResults.length > 0) {
      console.log("")
      console.log("IGN Upload Results:")
      for (const { accountId, result, error } of uploadResults) {
        if (result) {
          console.log(
            `  ${accountId}: ${result.imported} imported, ${result.skipped} skipped, ${result.pendingReview} pending review, ${result.failed} failed`,
          )
        } else if (error) {
          console.log(`  ${accountId}: Upload failed - ${error}`)
          console.log(`    (Local data preserved)`)
        }
      }
    }

    if (errors.length > 0) {
      console.log(`  Errors: ${errors.length}`)
      for (const err of errors) {
        console.log(`    - ${err}`)
      }
    } else {
      success("All accounts synced successfully!")
    }
  } catch (err) {
    spinner.fail("Sync failed")
    throw err
  }
}

/**
 * Sync a single account
 */
async function syncSingleAccount(
  billclaw: Billclaw,
  accountId: string,
  runtime: any,
  shouldUpload: boolean = false,
  localOnly: boolean = false,
): Promise<void> {
  const spinner = new Spinner({
    text: `Syncing account ${accountId}...`,
  }).start()

  try {
    const accounts = await billclaw.getAccounts()
    const account = accounts.find((a) => a.id === accountId)

    if (!account) {
      spinner.fail(`Account ${accountId} not found`)
      return
    }

    let results
    switch (account.type) {
      case "plaid":
        results = await billclaw.syncPlaid([accountId])
        break
      case "gmail":
        results = await billclaw.syncGmail([accountId])
        break
      default:
        throw new Error(`Unknown account type: ${account.type}`)
    }

    const added = results.reduce((sum, r) => sum + r.transactionsAdded, 0)
    const updated = results.reduce((sum, r) => sum + r.transactionsUpdated, 0)

    spinner.succeed(`Synced ${accountId}: +${added} new, ${updated} updated`)

    const userErrors = results.flatMap((r) => r.errors || [])
    if (userErrors.length > 0) {
      console.log("Errors:")
      for (const userError of userErrors) {
        console.log(`  - ${formatError(userError)}`)
      }
    }

    // Handle upload after successful sync
    if (!localOnly) {
      const uploadResult = await handleUpload(accountId, runtime, shouldUpload)
      if (uploadResult) {
        if (uploadResult.result) {
          console.log("")
          console.log("IGN Upload:")
          console.log(
            `  Uploaded: ${uploadResult.result.imported} imported, ${uploadResult.result.skipped} skipped, ${uploadResult.result.pendingReview} pending review, ${uploadResult.result.failed} failed`,
          )
        } else if (uploadResult.error) {
          console.log("")
          console.log(`IGN Upload failed: ${uploadResult.error}`)
          console.log("  (Local data preserved)")
        }
      }
    }
  } catch (err) {
    spinner.fail(`Sync failed: ${(err as Error).message}`)
    throw err
  }
}

/**
 * Handle IGN upload after sync
 *
 * @param accountId - Account ID
 * @param runtime - CLI runtime context
 * @param forceUpload - Whether upload was explicitly requested via --upload flag
 * @returns Upload result or null if not applicable
 */
async function handleUpload(
  accountId: string,
  runtime: any,
  forceUpload: boolean,
): Promise<{ accountId: string; result?: IgnUploadResult; error?: string } | null> {
  const config = await runtime.config.getConfig()

  // Check if IGN is configured (accessToken required for auth)
  if (!config.ign?.accessToken || !config.ign?.upload) {
    return null
  }

  // Check upload mode
  const uploadMode = config.ign.upload.mode
  const shouldUpload = forceUpload || uploadMode === "auto"

  if (!shouldUpload) {
    return null
  }

  const storageConfig = await runtime.config.getStorageConfig()

  // Create credential store for JWT token caching
  const credentialStore = createCredentialStore({
    strategy: CredentialStrategy.KEYCHAIN,
    logger: runtime.logger,
  })

  const uploadService = new UploadService(
    config.ign,
    storageConfig,
    credentialStore,
    runtime.logger,
  )

  try {
    const result = await uploadService.uploadAccountTransactions(accountId)
    return { accountId, result: result.result }
  } catch (err) {
    const errorMessage =
      err && typeof err === "object" && "humanReadable" in err
        ? (err as any).humanReadable.message
        : err instanceof Error
          ? err.message
          : String(err)
    return { accountId, error: errorMessage }
  }
}

/**
 * Sync command definition
 */
export const syncCommand: CliCommand = {
  name: "sync",
  description: "Manually trigger transaction sync",
  aliases: ["pull"],
  options: [
    {
      flags: "-a, --account <id>",
      description: "Specific account ID to sync",
    },
    {
      flags: "--all",
      description: "Sync all accounts (default)",
    },
    {
      flags: "-u, --upload",
      description: "Upload to IGN after sync",
    },
    {
      flags: "--local-only",
      description: "Skip upload even if auto mode configured",
    },
  ],
  handler: (context, args) =>
    runSync(context, args as {
      account?: string
      all?: boolean
      upload?: boolean
      localOnly?: boolean
    }),
}
