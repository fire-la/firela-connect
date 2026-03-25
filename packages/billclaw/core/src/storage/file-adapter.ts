/**
 * FileStorageAdapter - File system implementation of StorageAdapter
 *
 * Wraps existing file-based storage functions for backward compatibility.
 * Used as the default storage adapter for CLI and Node.js environments.
 *
 * @packageDocumentation
 */

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import type { StorageConfig } from "../models/config.js"
import type {
  StorageAdapter,
  StorageCapabilities,
  Transaction,
  SyncState,
  AccountRegistry,
  RelayTokenStorage,
} from "./types.js"
import {
  initializeStorage,
  readTransactions,
  writeTransactions,
  appendTransactions as fileAppendTransactions,
  readSyncStates,
  writeSyncState,
  readAccountRegistry,
  writeAccountRegistry,
} from "./transaction-storage.js"

/**
 * FileStorageAdapter configuration options
 */
export interface FileStorageAdapterOptions {
  /**
   * Storage configuration (path, format, etc.)
   */
  config?: StorageConfig
}

/**
 * File-based storage adapter using the local file system
 *
 * Uses JSON files for storage:
 * - `accounts.json` - Account registry
 * - `transactions/{accountId}/{year}/{month}.json` - Monthly transaction files
 * - `sync/{accountId}/{syncId}.json` - Sync state files
 * - `tokens/{provider}-{accountId}.json` - Relay token files
 *
 * @example
 * ```typescript
 * const storage = new FileStorageAdapter({ config: storageConfig })
 * await storage.initialize()
 *
 * const transactions = await storage.getTransactions('account-1', 2024, 1)
 * await storage.saveTransactions('account-1', 2024, 1, [...transactions, newTxn])
 * ```
 */
export class FileStorageAdapter
  implements StorageAdapter, RelayTokenStorage
{
  private config?: StorageConfig

  constructor(options: FileStorageAdapterOptions = {}) {
    this.config = options.config
  }

  /**
   * Get the storage capabilities for this adapter
   */
  getCapabilities(): StorageCapabilities {
    return {
      supportsLocking: true,
      supportsTransactions: false,
      supportsStreaming: true,
    }
  }

  // StorageAdapter implementation

  async initialize(): Promise<void> {
    await initializeStorage(this.config)
  }

  async getTransactions(
    accountId: string,
    year: number,
    month: number,
  ): Promise<Transaction[]> {
    return readTransactions(accountId, year, month, this.config)
  }

  async saveTransactions(
    accountId: string,
    year: number,
    month: number,
    transactions: Transaction[],
  ): Promise<void> {
    await writeTransactions(accountId, year, month, transactions, this.config)
  }

  async appendTransactions(
    accountId: string,
    year: number,
    month: number,
    transactions: Transaction[],
  ): Promise<{ added: number; updated: number }> {
    return fileAppendTransactions(
      accountId,
      year,
      month,
      transactions,
      this.config,
    )
  }

  async getSyncStates(accountId: string): Promise<SyncState[]> {
    return readSyncStates(accountId, this.config)
  }

  async getLatestSyncState(accountId: string): Promise<SyncState | null> {
    const states = await this.getSyncStates(accountId)
    if (states.length === 0) {
      return null
    }

    // States are already sorted by startedAt descending from readSyncStates
    return states[0]
  }

  async saveSyncState(state: SyncState): Promise<void> {
    await writeSyncState(state, this.config)
  }

  async getAccounts(): Promise<AccountRegistry[]> {
    return readAccountRegistry(this.config)
  }

  async getAccount(accountId: string): Promise<AccountRegistry | null> {
    const accounts = await this.getAccounts()
    return accounts.find((a) => a.id === accountId) || null
  }

  async saveAccount(account: AccountRegistry): Promise<void> {
    const accounts = await this.getAccounts()
    const existingIndex = accounts.findIndex((a) => a.id === account.id)

    if (existingIndex >= 0) {
      // Update existing account
      accounts[existingIndex] = account
    } else {
      // Add new account
      accounts.push(account)
    }

    await writeAccountRegistry(accounts, this.config)
  }

  async deleteAccount(accountId: string): Promise<void> {
    const accounts = await this.getAccounts()
    const filtered = accounts.filter((a) => a.id !== accountId)

    if (filtered.length !== accounts.length) {
      await writeAccountRegistry(filtered, this.config)
    }
  }

  // ============================================================================
  // Relay Token Operations
  // ============================================================================

  /**
   * Get the path to the tokens directory
   */
  private getTokensPath(): string {
    const basePath = this.config?.path ?? ".firela"
    return path.join(basePath, "tokens")
  }

  /**
   * Get the path to a specific token file
   */
  private getTokenFile(provider: string, accountId: string): string {
    return path.join(this.getTokensPath(), `${provider}-${accountId}.json`)
  }

  /**
   * Store relay access token for a provider
   *
   * Tokens are stored in ~/.firela/tokens/ directory with restricted permissions.
   * Note: Encryption at rest is deferred to security hardening phase.
   *
   * @param provider - Provider name (plaid, gocardless)
   * @param accountId - Account identifier
   * @param token - Access token to store
   */
  async storeRelayToken(
    provider: "plaid" | "gocardless",
    accountId: string,
    token: string,
  ): Promise<void> {
    // Ensure tokens directory exists with restricted permissions
    const tokensDir = this.getTokensPath()
    await mkdir(tokensDir, { recursive: true, mode: 0o700 })

    // Write token file with restricted permissions
    const tokenFile = this.getTokenFile(provider, accountId)
    await writeFile(
      tokenFile,
      JSON.stringify({ token, updatedAt: new Date().toISOString() }),
      { mode: 0o600 }, // Owner read/write only
    )
  }

  /**
   * Retrieve relay access token for a provider
   *
   * @param provider - Provider name
   * @param accountId - Account identifier
   * @returns Token or null if not found
   */
  async getRelayToken(
    provider: "plaid" | "gocardless",
    accountId: string,
  ): Promise<string | null> {
    try {
      const tokenFile = this.getTokenFile(provider, accountId)
      const data = await readFile(tokenFile, "utf-8")
      const parsed = JSON.parse(data) as { token: string }
      return parsed.token
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null
      }
      throw error
    }
  }

  /**
   * Delete relay access token
   *
   * @param provider - Provider name
   * @param accountId - Account identifier
   */
  async deleteRelayToken(
    provider: "plaid" | "gocardless",
    accountId: string,
  ): Promise<void> {
    const tokenFile = this.getTokenFile(provider, accountId)
    try {
      await unlink(tokenFile)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
      }
    }
  }
}

/**
 * Create a FileStorageAdapter with the given configuration
 *
 * @param config - Storage configuration
 * @returns FileStorageAdapter instance
 */
export function createFileStorageAdapter(
  config?: StorageConfig,
): FileStorageAdapter {
  return new FileStorageAdapter({ config })
}
