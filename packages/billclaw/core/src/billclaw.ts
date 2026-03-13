/**
 * BillClaw - Main class for financial data import
 *
 * This class provides the primary API for interacting with BillClaw.
 * It is framework-agnostic and can be used by any adapter (CLI, OpenClaw, etc.).
 */

import type { AccountConfig } from "./models/config.js"
import type { Logger, UserError } from "./errors/errors.js"
import type { RuntimeContext, ConfigProvider } from "./runtime/types.js"
import type { Transaction, SyncState } from "./storage/transaction-storage.js"
import type {
  PlaidSyncResult,
  PlaidConfig,
  PlaidAccount,
} from "./sources/plaid/plaid-sync.js"
import type {
  GmailFetchResult,
  GmailConfig,
  GmailAccount,
} from "./sources/gmail/gmail-fetch.js"
import type { SyncResult } from "./sync/sync-service.js"
import { createUserError, ERROR_CODES, ErrorCategory } from "./errors/errors.js"

// Storage
import {
  readTransactions,
  readSyncStates,
  initializeStorage,
} from "./storage/transaction-storage.js"

// Sync
import { syncDueAccounts } from "./sync/sync-service.js"

// Sources
import { syncPlaidAccounts } from "./sources/plaid/plaid-sync.js"
import { fetchGmailBills } from "./sources/gmail/gmail-fetch.js"

// Exporters
import {
  exportStorageToBeancount,
  exportStorageToLedger,
} from "./exporters/index.js"

/**
 * Check if an OAuth token is expired or about to expire
 *
 * @param expiryIso - Token expiry time as ISO string
 * @param bufferSeconds - Buffer time in seconds before expiry (default: 300 = 5 minutes)
 * @returns true if token is expired or will expire within buffer time
 */
export function isTokenExpired(
  expiryIso: string | undefined,
  bufferSeconds: number = 300,
): boolean {
  if (!expiryIso) {
    // No expiry time means token doesn't expire
    return false
  }

  const expiryTime = new Date(expiryIso).getTime()
  const now = Date.now()
  const bufferMs = bufferSeconds * 1000

  return now >= expiryTime - bufferMs
}

/**
 * BillClaw - Main class for financial data import
 */
export class Billclaw {
  private readonly context: RuntimeContext

  constructor(context: RuntimeContext) {
    this.context = context
  }

  /**
   * Get the logger
   */
  get logger(): Logger {
    return this.context.logger
  }

  /**
   * Get the config provider
   */
  get config(): ConfigProvider {
    return this.context.config
  }

  // ==================== Storage ====================

  /**
   * Initialize the storage directory structure
   */
  async initializeStorage(): Promise<void> {
    const storageConfig = await this.context.config.getStorageConfig()
    await initializeStorage(storageConfig)
    this.logger.info?.("Storage initialized")
  }

  /**
   * Get all registered accounts
   */
  async getAccounts(): Promise<any[]> {
    const config = await this.context.config.getConfig()
    return config.accounts || []
  }

  /**
   * Get transactions for an account and month
   */
  async getTransactions(
    accountId: string,
    year: number,
    month: number,
  ): Promise<Transaction[]> {
    const storageConfig = await this.context.config.getStorageConfig()
    return readTransactions(accountId, year, month, storageConfig)
  }

  /**
   * Get sync states for an account
   */
  async getSyncStates(accountId: string): Promise<SyncState[]> {
    const storageConfig = await this.context.config.getStorageConfig()
    return readSyncStates(accountId, storageConfig)
  }

  // ==================== Sync ====================

  /**
   * Sync provider interface - implemented by adapters
   */
  async syncAccount(accountId: string): Promise<SyncResult> {
    const config = await this.context.config.getConfig()
    const account = config.accounts.find((a) => a.id === accountId)

    if (!account) {
      const notFoundError: UserError = createUserError(
        ERROR_CODES.CONFIG_INVALID,
        ErrorCategory.CONFIG,
        "error",
        false,
        {
          title: "Account Not Found",
          message: `Account with ID "${accountId}" was not found in the configuration.`,
          suggestions: [
            "Verify the account ID is correct",
            "Check that the account exists in your configuration",
            "Run setup to add the account if needed",
          ],
        },
        [],
        { accountId },
      )
      return {
        accountId,
        success: false,
        transactionsAdded: 0,
        transactionsUpdated: 0,
        errors: [notFoundError],
      }
    }

    switch (account.type) {
      case "plaid":
        return await this.syncPlaidAccount(account)

      case "gmail":
        return await this.syncGmailAccount(account)

      default:
        const unsupportedTypeError: UserError = createUserError(
          ERROR_CODES.CONFIG_INVALID,
          ErrorCategory.CONFIG,
          "error",
          false,
          {
            title: "Unsupported Account Type",
            message: `Account type "${account.type}" is not supported.`,
            suggestions: [
              "Supported account types are: plaid, gmail",
              "Update your configuration to use a supported account type",
            ],
          },
          [],
          { accountId },
        )
        return {
          accountId,
          success: false,
          transactionsAdded: 0,
          transactionsUpdated: 0,
          errors: [unsupportedTypeError],
        }
    }
  }

  /**
   * Sync all accounts that are due
   */
  async syncDueAccounts(): Promise<SyncResult[]> {
    const config = await this.context.config.getConfig()
    return syncDueAccounts(config.accounts, this, this.logger)
  }

  // ==================== Plaid ====================

  /**
   * Sync Plaid accounts
   */
  async syncPlaid(accountIds?: string[]): Promise<PlaidSyncResult[]> {
    const config = await this.context.config.getConfig()
    const storageConfig = await this.context.config.getStorageConfig()

    const plaidConfig: PlaidConfig = {
      clientId: config.plaid.clientId || process.env.PLAID_CLIENT_ID || "",
      secret: config.plaid.secret || process.env.PLAID_SECRET || "",
      environment: config.plaid.environment || "sandbox",
    }

    const accounts: PlaidAccount[] = config.accounts
      .filter((a) => a.type === "plaid" && a.enabled && a.plaidAccessToken)
      .filter((a) => !accountIds || accountIds.includes(a.id))
      .map((a) => ({
        id: a.id,
        plaidAccessToken: a.plaidAccessToken!,
      }))

    if (accounts.length === 0) {
      this.logger.warn?.("No enabled Plaid accounts found")
      return []
    }

    return syncPlaidAccounts(
      accounts,
      plaidConfig,
      storageConfig,
      this.logger,
      config.webhooks || [],
    )
  }

  /**
   * Sync a single Plaid account
   */
  private async syncPlaidAccount(account: AccountConfig): Promise<SyncResult> {
    const results = await this.syncPlaid([account.id])
    const result = results[0]

    return {
      accountId: result.accountId,
      success: result.success,
      transactionsAdded: result.transactionsAdded,
      transactionsUpdated: result.transactionsUpdated,
      errors: result.errors,
    }
  }

  // ==================== Gmail ====================

  /**
   * Sync Gmail accounts
   */
  async syncGmail(
    accountIds?: string[],
    days: number = 30,
  ): Promise<GmailFetchResult[]> {
    const config = await this.context.config.getConfig()
    const storageConfig = await this.context.config.getStorageConfig()

    const gmailConfig: GmailConfig = config.gmail || {
      senderWhitelist: [],
      keywords: ["invoice", "statement", "bill due", "receipt", "payment due"],
      confidenceThreshold: 0.5,
      requireAmount: false,
      requireDate: false,
    }

    const accounts: GmailAccount[] = config.accounts
      .filter((a) => a.type === "gmail" && a.enabled)
      .filter((a) => !accountIds || accountIds.includes(a.id))
      .map((a) => ({
        id: a.id,
        gmailEmailAddress: a.gmailEmailAddress || "",
      }))

    if (accounts.length === 0) {
      this.logger.warn?.("No enabled Gmail accounts found")
      return []
    }

    const results: GmailFetchResult[] = []

    for (const account of accounts) {
      // Get access token from account config
      const accountConfig = config.accounts.find((a) => a.id === account.id)
      const accessToken = accountConfig?.gmailAccessToken
      const tokenExpiry = accountConfig?.gmailTokenExpiry

      if (!accessToken) {
        this.logger.warn?.(
          `No access token found for Gmail account ${account.id}. Please run OAuth setup first.`,
        )
        const noTokenError: UserError = createUserError(
          ERROR_CODES.GMAIL_AUTH_FAILED,
          ErrorCategory.GMAIL_AUTH,
          "error",
          true,
          {
            title: "No OAuth Access Token Found",
            message: `No OAuth access token was found for Gmail account ${account.id}.`,
            suggestions: [
              "Run OAuth setup first to authenticate with Gmail",
              "Ensure the account is properly configured",
            ],
          },
          [{ type: "oauth_reauth", tool: "gmail_oauth", params: { accountId: account.id } }],
          { accountId: account.id },
        )
        results.push({
          accountId: account.id,
          success: false,
          emailsProcessed: 0,
          billsExtracted: 0,
          transactionsAdded: 0,
          transactionsUpdated: 0,
          errors: [noTokenError],
        })
        continue
      }

      // Check if token is expired (with 5 minute buffer)
      if (isTokenExpired(tokenExpiry, 300)) {
        this.logger.warn?.(
          `Access token expired for Gmail account ${account.id}. Please refresh the token.`,
        )
        const tokenExpiredError: UserError = createUserError(
          ERROR_CODES.GMAIL_AUTH_FAILED,
          ErrorCategory.GMAIL_AUTH,
          "error",
          true,
          {
            title: "Gmail Access Token Expired",
            message: `The access token for Gmail account ${account.id} has expired.`,
            suggestions: [
              "Refresh the token using OAuth refresh flow",
              "Run setup again to re-authenticate with Gmail",
            ],
          },
          [{ type: "oauth_reauth", tool: "gmail_oauth", params: { accountId: account.id } }],
          { accountId: account.id },
        )
        results.push({
          accountId: account.id,
          success: false,
          emailsProcessed: 0,
          billsExtracted: 0,
          transactionsAdded: 0,
          transactionsUpdated: 0,
          errors: [tokenExpiredError],
        })
        continue
      }

      const result = await fetchGmailBills(
        account,
        days,
        gmailConfig,
        storageConfig,
        this.logger,
        accessToken,
      )
      results.push(result)
    }

    return results
  }

  /**
   * Sync a single Gmail account
   */
  private async syncGmailAccount(account: AccountConfig): Promise<SyncResult> {
    const results = await this.syncGmail([account.id])
    const result = results[0]

    return {
      accountId: result.accountId,
      success: result.success,
      transactionsAdded: result.transactionsAdded,
      transactionsUpdated: result.transactionsUpdated,
      errors: result.errors,
    }
  }

  // ==================== Exporters ====================

  /**
   * Export transactions to Beancount format
   */
  async exportToBeancount(
    accountId: string,
    year: number,
    month: number,
    options?: Partial<any>,
  ): Promise<string> {
    const storageConfig = await this.context.config.getStorageConfig()
    return exportStorageToBeancount(
      accountId,
      year,
      month,
      storageConfig,
      options,
    )
  }

  /**
   * Export transactions to Ledger format
   */
  async exportToLedger(
    accountId: string,
    year: number,
    month: number,
    options?: Partial<any>,
  ): Promise<string> {
    const storageConfig = await this.context.config.getStorageConfig()
    return exportStorageToLedger(accountId, year, month, storageConfig, options)
  }
}
