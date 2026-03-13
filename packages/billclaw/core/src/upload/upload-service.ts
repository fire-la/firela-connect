/**
 * Upload service for IGN integration
 *
 * Orchestrates the upload flow from BillClaw transactions to IGN.
 * Handles loading, transformation, upload, and status tracking.
 *
 * Key principle: Local data is ALWAYS preserved, even on upload failure.
 *
 * Authentication:
 * - Uses IgnAuthManager for automatic JWT token management
 * - User provides accessToken (from Firela Vault app) in config
 * - JWT token is cached in keychain and auto-refreshed
 *
 * @packageDocumentation
 */

import type { CredentialStore } from "../credentials/store.js"
import type { Logger } from "../errors/errors.js"
import type { IgnConfig, StorageConfig } from "../models/config.js"
import type { Transaction } from "../storage/transaction-storage.js"
import type { IgnUploadResult, ProviderSyncConfig } from "./ign-client.js"
import { IgnAuthManager } from "./ign-auth.js"
import { uploadTransactions } from "./ign-client.js"
import { transformTransactionsToPlaidFormat } from "./transform.js"
import { UploadStatusStore, type IgnUploadStatus } from "./upload-status.js"
import { parseIgnError, createUserError, ERROR_CODES, ErrorCategory } from "../errors/errors.js"
import { getStorageDir } from "../storage/transaction-storage.js"
import * as fs from "node:fs/promises"
import * as path from "node:path"

/**
 * Result of upload operation
 */
export interface UploadServiceResult {
  /** Account ID */
  accountId: string
  /** Whether upload succeeded */
  success: boolean
  /** Upload result from IGN (if successful) */
  result?: IgnUploadResult
  /** Error message (if failed) */
  error?: string
  /** Number of transactions uploaded */
  transactionsUploaded: number
}

/**
 * Options for upload operation
 */
export interface UploadOptions {
  /** Only upload transactions from last N days (default: 30) */
  days?: number
  /** Dry run - preview without uploading */
  dryRun?: boolean
}

/**
 * Upload service for IGN integration
 *
 * Coordinates the upload flow:
 * 1. Check IGN configuration
 * 2. Load transactions from storage
 * 3. Transform to Plaid format
 * 4. Upload to IGN
 * 5. Store upload status
 *
 * On upload failure, local data is always preserved.
 *
 * @example
 * ```typescript
 * const credentialStore = await createCredentialStore({ strategy: CredentialStrategy.KEYCHAIN })
 * const service = new UploadService(ignConfig, storageConfig, credentialStore, logger)
 *
 * if (await service.shouldUpload()) {
 *   const result = await service.uploadAccountTransactions('account-123')
 *   console.log(`Uploaded: ${result.result?.imported} imported`)
 * }
 * ```
 */
export class UploadService {
  private readonly statusStore: UploadStatusStore
  private readonly authManager: IgnAuthManager

  constructor(
    private readonly ignConfig: IgnConfig,
    private readonly storageConfig: StorageConfig | undefined,
    credentialStore: CredentialStore,
    private readonly logger: Logger,
  ) {
    this.statusStore = new UploadStatusStore(storageConfig)
    this.authManager = new IgnAuthManager(ignConfig, credentialStore, logger)
  }

  /**
   * Check if upload is enabled and configured
   *
   * @returns true if upload should proceed
   */
  async shouldUpload(): Promise<boolean> {
    // Check if IGN is configured (accessToken required for auth)
    if (!this.ignConfig.accessToken) {
      this.logger.debug?.("Firela Vault upload disabled: no access token configured")
      return false
    }

    // Check if upload is enabled
    if (!this.ignConfig.upload) {
      this.logger.debug?.("Firela Vault upload disabled: no upload configuration")
      return false
    }

    // Check upload mode
    if (this.ignConfig.upload.mode === "disabled") {
      this.logger.debug?.("Firela Vault upload disabled: mode is 'disabled'")
      return false
    }

    return true
  }

  /**
   * Start background token refresh
   *
   * Keeps the JWT token valid for long-running processes.
   * Call stopBackgroundRefresh() when done.
   */
  startBackgroundRefresh(): void {
    this.authManager.startBackgroundRefresh()
  }

  /**
   * Stop background token refresh
   */
  stopBackgroundRefresh(): void {
    this.authManager.stopBackgroundRefresh()
  }

  /**
   * Upload transactions for an account to IGN
   *
   * Flow:
   * 1. Check IGN config
   * 2. Load transactions from storage
   * 3. Filter by date (optional)
   * 4. Transform to Plaid format
   * 5. Upload to IGN
   * 6. Store upload status
   *
   * On failure: stores failed status, preserves local data, throws error.
   *
   * @param accountId - Account ID to upload
   * @param options - Upload options
   * @returns Upload result
   * @throws UserError if upload fails
   */
  async uploadAccountTransactions(
    accountId: string,
    options: UploadOptions = {},
  ): Promise<UploadServiceResult> {
    const { days = 30, dryRun = false } = options

    // 1. Check IGN config
    if (!this.ignConfig.accessToken) {
      throw createUserError(
        ERROR_CODES.IGN_AUTH_FAILED,
        ErrorCategory.IGN,
        "error",
        false,
        {
          title: "Firela Vault Not Configured",
          message: "Firela Vault access token is not configured. Please add your access token to the configuration.",
          suggestions: [
            "Add ign.accessToken to your configuration file",
            "Get your access token from the Firela Vault app",
          ],
        },
        [],
        { accountId },
      )
    }

    if (!this.ignConfig.upload) {
      throw createUserError(
        ERROR_CODES.CONFIG_INVALID,
        ErrorCategory.CONFIG,
        "error",
        false,
        {
          title: "Firela Vault Upload Not Configured",
          message: "Firela Vault upload configuration is missing. Please configure the upload settings.",
          suggestions: [
            "Add ign.upload to your configuration file",
            "Set sourceAccount, defaultExpenseAccount, and defaultIncomeAccount",
          ],
        },
        [],
        { accountId },
      )
    }

    this.logger.info?.(`Loading transactions for account ${accountId}...`)

    // 2. Load transactions from storage
    const transactions = await this.loadTransactions(accountId, days)

    if (transactions.length === 0) {
      this.logger.info?.(`No transactions found for account ${accountId}`)
      return {
        accountId,
        success: true,
        transactionsUploaded: 0,
        result: {
          imported: 0,
          skipped: 0,
          pendingReview: 0,
          failed: 0,
        },
      }
    }

    this.logger.info?.(
      `Found ${transactions.length} transactions for account ${accountId}`,
    )

    // 3. Dry run - preview without uploading
    if (dryRun) {
      const dates = transactions.map((t) => t.date).sort()
      this.logger.info?.(
        `Dry run: would upload ${transactions.length} transactions (${dates[0]} to ${dates[dates.length - 1]})`,
      )
      return {
        accountId,
        success: true,
        transactionsUploaded: transactions.length,
        result: {
          imported: 0,
          skipped: 0,
          pendingReview: 0,
          failed: 0,
        },
      }
    }

    // 4. Transform to Plaid format
    const plaidTransactions = transformTransactionsToPlaidFormat(transactions)

    // 5. Build ProviderSyncConfig from IGN config
    const syncConfig: ProviderSyncConfig = {
      sourceAccount: this.ignConfig.upload.sourceAccount,
      defaultCurrency: this.ignConfig.upload.defaultCurrency || "USD",
      defaultExpenseAccount:
        this.ignConfig.upload.defaultExpenseAccount || "Expenses:Unknown",
      defaultIncomeAccount:
        this.ignConfig.upload.defaultIncomeAccount || "Income:Unknown",
      filterPending: this.ignConfig.upload.filterPending ?? true,
    }

    // 6. Upload to IGN
    try {
      this.logger.info?.(
        `Uploading ${plaidTransactions.length} transactions to Firela Vault (${this.ignConfig.region})...`,
      )

      // Get valid JWT token (auto-refresh if needed)
      const apiToken = await this.authManager.ensureValidToken()

      const result = await uploadTransactions(
        {
          apiUrl: this.ignConfig.apiUrl,
          apiToken,
          region: this.ignConfig.region,
        },
        plaidTransactions,
        syncConfig,
        this.logger,
      )

      // 7. Store success status
      const status: IgnUploadStatus = {
        accountId,
        status: "success",
        lastUploadAt: new Date().toISOString(),
        lastUploadResult: result,
      }
      await this.statusStore.writeStatus(accountId, status)

      this.logger.info?.(
        `Firela Vault upload complete: ${result.imported} imported, ${result.skipped} skipped, ${result.pendingReview} pending review, ${result.failed} failed`,
      )

      return {
        accountId,
        success: true,
        result,
        transactionsUploaded: transactions.length,
      }
    } catch (error) {
      // On failure: store failed status, preserve local data, throw
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      const status: IgnUploadStatus = {
        accountId,
        status: "failed",
        lastUploadAt: new Date().toISOString(),
        errorMessage,
      }
      await this.statusStore.writeStatus(accountId, status)

      this.logger.error?.(
        `Firela Vault upload failed for account ${accountId}. Local data preserved:`,
        errorMessage,
      )

      // Parse and re-throw as UserError
      throw parseIgnError(
        error instanceof Error ? error : new Error(errorMessage),
        {
          region: this.ignConfig.region,
          endpoint: "/bean/import/provider/plaid/sync",
        },
      )
    }
  }

  /**
   * Load transactions for an account from storage
   *
   * Loads from all available month files and optionally filters by date.
   *
   * @param accountId - Account ID
   * @param days - Only load transactions from last N days (0 = all)
   * @returns Array of transactions
   */
  private async loadTransactions(
    accountId: string,
    days: number,
  ): Promise<Transaction[]> {
    const storagePath = await getStorageDir(this.storageConfig)
    const transactionsDir = path.join(storagePath, "transactions", accountId)

    const transactions: Transaction[] = []
    const cutoffDate =
      days > 0
        ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
        : null

    try {
      const years = await fs.readdir(transactionsDir)

      for (const year of years) {
        const yearPath = path.join(transactionsDir, year)
        const yearStat = await fs.stat(yearPath)

        if (!yearStat.isDirectory()) continue

        const months = await fs.readdir(yearPath)

        for (const month of months) {
          if (!month.endsWith(".json")) continue

          const monthPath = path.join(yearPath, month)
          const content = await fs.readFile(monthPath, "utf-8")
          const monthTransactions = JSON.parse(content) as Transaction[]

          // Filter by date if cutoff is set
          const filtered = cutoffDate
            ? monthTransactions.filter((t) => t.date >= cutoffDate)
            : monthTransactions

          transactions.push(...filtered)
        }
      }
    } catch (error) {
      // Directory doesn't exist or other error - return empty array
      this.logger.debug?.(
        `Could not load transactions for account ${accountId}:`,
        error,
      )
      return []
    }

    // Sort by date descending
    transactions.sort((a, b) => b.date.localeCompare(a.date))

    return transactions
  }

  /**
   * Get upload status for an account
   *
   * @param accountId - Account ID
   * @returns Upload status or null if not found
   */
  async getUploadStatus(accountId: string): Promise<IgnUploadStatus | null> {
    return this.statusStore.readStatus(accountId)
  }
}
