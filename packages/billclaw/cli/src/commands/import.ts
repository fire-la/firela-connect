/**
 * Import command - imports CSV files and parses and uploads transactions to VLT.
 *
 * @module @firela/billclaw-cli
 */

import { existsSync, readFileSync } from "node:fs"
import type { CliCommand, CliContext } from "./registry.js"
import { Spinner } from "../utils/progress.js"
import { success } from "../utils/format.js"
import {
  parserRegistry,
  type ParserName,
  transformParsedTransactions,
} from "@firela/billclaw-core"
import {
  uploadTransactions,
  type PlaidTransactionUpload,
  type ProviderSyncConfig,
} from "@firela/billclaw-core"
import { VltAuthManager } from "@firela/billclaw-core"
import { createCredentialStore, CredentialStrategy } from "@firela/billclaw-core"

/**
 * Run import command
 */
async function runImport(
  context: CliContext,
  args: {
    file?: string
    parser?: string
    account?: string
    dryRun?: boolean
  },
): Promise<void> {
  const filePath = args.file
  const parserName = args.parser as ParserName | undefined
  const accountId = args.account
  const dryRun = args.dryRun ?? false

  // Validate file path
  if (!filePath) {
    console.error("Error: File path is required")
    console.error("Usage: billclaw import <file> [options]")
    return
  }

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`)
    return
  }

  const spinner = new Spinner({ text: "Reading file..." }).start()

  // Read file content
  let content: Buffer
  try {
    content = readFileSync(filePath)
  } catch (err) {
    spinner.fail(`Failed to read file: ${(err as Error).message}`)
    return
  }

  // Auto-detect parser if not specified
  let detectedParserName: ParserName | null = parserName ?? null
  if (!detectedParserName) {
    spinner.update("Detecting file format...")
    detectedParserName = parserRegistry.detect(content)
    if (!detectedParserName) {
      spinner.fail("Could not detect CSV format")
      console.error("")
      console.error("Available parsers:")
      for (const name of parserRegistry.list()) {
        console.error(`  - ${name}`)
      }
      console.error("")
      console.error("Use --parser <name> to specify a parser.")
      return
    }
  }

  spinner.update(`Parsing with ${detectedParserName}...`)

  // Get parser and parse file
  const parser = parserRegistry.get(detectedParserName)
  const result = parser.parse(content)

  if (!result.success) {
    spinner.fail("Parse failed")
    console.error("")
    console.error("Errors:")
    for (const error of result.errors) {
      console.error(`  - ${error.type}: ${error.message}`)
    }
    return
  }

  spinner.succeed(`Parsed ${result.data.length} transaction(s)`)

  // For dry-run without account, show sample data without transformation
  if (dryRun && !accountId) {
    console.log("")
    console.log("Dry run mode - skipping upload")
    console.log("")
    console.log("Sample raw transactions:")
    for (const txn of result.data.slice(0, 3)) {
      console.log(`  - ${txn.date.toISOString().split('T')[0]}: ${txn.payee} (${txn.amount} ${txn.currency})`)
    }
    if (result.data.length > 3) {
      console.log(`  ... and ${result.data.length - 3} more`)
    }
    return
  }

  // Check account ID for transformation
  if (!accountId) {
    console.error("")
    console.error("Error: Account ID is required for upload")
    console.error("Use --account <id> to specify the target account")
    console.error("")
    console.error("For dry-run without upload, use --dry-run without --account")
    return
  }

  // Transform to Plaid format
  const plaidTransactions = transformParsedTransactions(result.data, {
    accountId: accountId,
    pending: false,
  })

  console.log(`Transformed ${plaidTransactions.length} transaction(s) for upload`)

  if (dryRun) {
    console.log("")
    console.log("Dry run mode - skipping upload")
    console.log("")
    console.log("Sample transactions:")
    for (const txn of plaidTransactions.slice(0, 3)) {
      console.log(`  - ${txn.date}: ${txn.name} (${txn.amount} ${txn.iso_currency_code})`)
    }
    if (plaidTransactions.length > 3) {
      console.log(`  ... and ${plaidTransactions.length - 3} more`)
    }
    return
  }

  // Upload to VLT
  await handleUpload(context, plaidTransactions, accountId)
}

/**
 * Handle VLT upload
 */
async function handleUpload(
  context: CliContext,
  transactions: PlaidTransactionUpload[],
  _accountId: string,
): Promise<void> {
  const { runtime } = context
  const config = await runtime.config.getConfig()

  // Check if VLT is configured
  if (!config.vlt?.accessToken) {
    console.error("")
    console.error("Error: VLT not configured")
    console.error("Run 'billclaw config' to set up VLT credentials")
    return
  }

  if (!config.vlt?.upload) {
    console.error("")
    console.error("Error: VLT upload configuration missing")
    console.error("Run 'billclaw config' to configure upload settings")
    return
  }

  const spinner = new Spinner({ text: "Uploading to VLT..." }).start()

  try {
    // Create credential store for JWT token caching
    const credentialStore = createCredentialStore({
      strategy: CredentialStrategy.KEYCHAIN,
      logger: runtime.logger,
    })

    // Use VltAuthManager for token management
    const authManager = new VltAuthManager(config.vlt, credentialStore, runtime.logger)
    const apiToken = await authManager.ensureValidToken()

    // Build sync config from VLT config
    const syncConfig: ProviderSyncConfig = {
      sourceAccount: config.vlt.upload.sourceAccount,
      defaultCurrency: config.vlt.upload.defaultCurrency || "USD",
      defaultExpenseAccount: config.vlt.upload.defaultExpenseAccount || "Expenses:Unknown",
      defaultIncomeAccount: config.vlt.upload.defaultIncomeAccount || "Income:Unknown",
      filterPending: config.vlt.upload.filterPending ?? true,
    }

    const result = await uploadTransactions(
      {
        apiUrl: config.vlt.apiUrl,
        apiToken,
        region: config.vlt.region,
      },
      transactions,
      syncConfig,
      runtime.logger,
    )

    spinner.succeed("Upload complete")

    console.log("")
    console.log("Upload Results:")
    console.log(`  Imported: ${result.imported}`)
    console.log(`  Skipped: ${result.skipped}`)
    console.log(`  Pending Review: ${result.pendingReview}`)
    console.log(`  Failed: ${result.failed}`)

    if (result.failed > 0) {
      console.log("")
      console.log("Some transactions failed to import. Check VLT for details.")
    }

    success("Import completed!")
  } catch (err) {
    spinner.fail("Upload failed")
    const errorMessage =
      err && typeof err === "object" && "humanReadable" in err
        ? (err as { humanReadable: { message: string } }).humanReadable.message
        : err instanceof Error
          ? err.message
          : String(err)
    console.error(`  ${errorMessage}`)
    throw err
  }
}

/**
 * Import command definition
 */
export const importCommand: CliCommand = {
  name: "import",
  description: "Import transactions from CSV file",
  arguments: "<file>",
  options: [
    {
      flags: "-p, --parser <name>",
      description: "Parser to use (auto-detect if not specified)",
    },
    {
      flags: "-a, --account <id>",
      description: "Target account ID for uploads",
    },
    {
      flags: "-d, --dry-run",
      description: "Parse only, do not upload",
    },
  ],
  handler: (context, args) =>
    runImport(context, args as {
      file?: string
      parser?: string
      account?: string
      dryRun?: boolean
    }),
}
