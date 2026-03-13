/**
 * StorageAdapter interface and types for framework-independent storage
 *
 * This abstraction enables BillClaw core to run on both Node.js (file system)
 * and Cloudflare Workers (D1 database) through dependency injection.
 *
 * @packageDocumentation
 */

import type {
  Transaction,
  SyncState,
  AccountRegistry,
} from "./transaction-storage.js"

export type { Transaction, SyncState, AccountRegistry }

/**
 * StorageAdapter - Abstract interface for all storage operations
 *
 * Implementations:
 * - FileStorageAdapter: Node.js file system storage (default for CLI)
 * - D1StorageAdapter: Cloudflare D1 database storage (for Workers)
 *
 * Usage:
 * ```typescript
 * const storage = new FileStorageAdapter(config)
 * await storage.initialize()
 * const transactions = await storage.getTransactions(accountId, 2024, 1)
 * ```
 */
export interface StorageAdapter {
  /**
   * Initialize storage (create tables/directories)
   *
   * Called once when the adapter is first used.
   * For file storage: creates directory structure
   * For D1: creates tables if not exist
   */
  initialize(): Promise<void>

  // Transaction operations

  /**
   * Get transactions for a specific account and month
   *
   * @param accountId - The account identifier
   * @param year - Year (e.g., 2024)
   * @param month - Month (1-12)
   * @returns Array of transactions, empty if none exist
   */
  getTransactions(
    accountId: string,
    year: number,
    month: number,
  ): Promise<Transaction[]>

  /**
   * Save transactions for a specific account and month (upsert)
   *
   * @param accountId - The account identifier
   * @param year - Year (e.g., 2024)
   * @param month - Month (1-12)
   * @param transactions - Transactions to save
   */
  saveTransactions(
    accountId: string,
    year: number,
    month: number,
    transactions: Transaction[],
  ): Promise<void>

  /**
   * Append transactions with deduplication
   *
   * @param accountId - The account identifier
   * @param year - Year (e.g., 2024)
   * @param month - Month (1-12)
   * @param transactions - New transactions to append
   * @returns Count of added and updated transactions
   */
  appendTransactions(
    accountId: string,
    year: number,
    month: number,
    transactions: Transaction[],
  ): Promise<{ added: number; updated: number }>

  // Sync state operations

  /**
   * Get sync states for an account (ordered by start time descending)
   *
   * @param accountId - The account identifier
   * @returns Array of sync states, empty if none exist
   */
  getSyncStates(accountId: string): Promise<SyncState[]>

  /**
   * Get the latest sync state for an account
   *
   * @param accountId - The account identifier
   * @returns Latest sync state or null if none exist
   */
  getLatestSyncState(accountId: string): Promise<SyncState | null>

  /**
   * Save sync state
   *
   * @param state - Sync state to save
   */
  saveSyncState(state: SyncState): Promise<void>

  // Account registry operations

  /**
   * Get all registered accounts
   *
   * @returns Array of account registry entries
   */
  getAccounts(): Promise<AccountRegistry[]>

  /**
   * Get account by ID
   *
   * @param accountId - The account identifier
   * @returns Account registry entry or null if not found
   */
  getAccount(accountId: string): Promise<AccountRegistry | null>

  /**
   * Save account (register or update)
   *
   * @param account - Account registry entry to save
   */
  saveAccount(account: AccountRegistry): Promise<void>

  /**
   * Delete account
   *
   * @param accountId - The account identifier
   */
  deleteAccount(accountId: string): Promise<void>
}

/**
 * Storage adapter capabilities for feature detection
 */
export interface StorageCapabilities {
  /**
   * Whether the adapter supports file locking
   */
  supportsLocking: boolean

  /**
   * Whether the adapter supports transactions
   */
  supportsTransactions: boolean

  /**
   * Whether the adapter supports streaming
   */
  supportsStreaming: boolean
}

/**
 * Base storage adapter with common utilities
 *
 * Provides shared functionality for storage adapters.
 * Concrete implementations should extend this class.
 */
export abstract class BaseStorageAdapter implements StorageAdapter {
  abstract initialize(): Promise<void>
  abstract getTransactions(
    accountId: string,
    year: number,
    month: number,
  ): Promise<Transaction[]>
  abstract saveTransactions(
    accountId: string,
    year: number,
    month: number,
    transactions: Transaction[],
  ): Promise<void>
  abstract appendTransactions(
    accountId: string,
    year: number,
    month: number,
    transactions: Transaction[],
  ): Promise<{ added: number; updated: number }>
  abstract getSyncStates(accountId: string): Promise<SyncState[]>
  abstract getLatestSyncState(accountId: string): Promise<SyncState | null>
  abstract saveSyncState(state: SyncState): Promise<void>
  abstract getAccounts(): Promise<AccountRegistry[]>
  abstract getAccount(accountId: string): Promise<AccountRegistry | null>
  abstract saveAccount(account: AccountRegistry): Promise<void>
  abstract deleteAccount(accountId: string): Promise<void>

  /**
   * Get the capabilities of this storage adapter
   */
  abstract getCapabilities(): StorageCapabilities

  /**
   * Helper to deduplicate transactions within a time window
   */
  protected deduplicateTransactions(
    transactions: Transaction[],
    windowHours: number = 24,
  ): Transaction[] {
    const seen = new Set<string>()
    const windowStart = Date.now() - windowHours * 60 * 60 * 1000
    const result: Transaction[] = []

    // Sort by date ascending
    const sorted = [...transactions].sort((a, b) =>
      a.date.localeCompare(b.date),
    )

    for (const txn of sorted) {
      const key = `${txn.accountId}_${txn.plaidTransactionId}`
      const txnDate = new Date(txn.date).getTime()

      // Only include if not seen, or outside deduplication window
      if (!seen.has(key) || txnDate > windowStart) {
        seen.add(key)
        result.push(txn)
      }
    }

    return result
  }
}
