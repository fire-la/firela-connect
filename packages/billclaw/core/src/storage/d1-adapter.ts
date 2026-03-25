/**
 * D1StorageAdapter - Cloudflare D1 database implementation of StorageAdapter
 *
 * This adapter enables BillClaw to run on Cloudflare Workers using D1
 * as the storage backend instead of the local file system.
 *
 * @packageDocumentation
 */

import type {
  StorageAdapter,
  StorageCapabilities,
  Transaction,
  SyncState,
  AccountRegistry,
  RelayTokenStorage,
} from "./types.js"

/**
 * D1Database type from @cloudflare/workers-types
 *
 * Note: We use a minimal interface to avoid importing Cloudflare types
 * which would add unnecessary dependencies for non-Workers environments.
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(query: string): Promise<D1Result>
  dump(): Promise<ArrayBuffer>
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  run(): Promise<D1Result>
  all<T = unknown>(): Promise<D1Result<T>>
  raw<T = unknown>(): Promise<T[]>
}

export interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  error?: string
  meta?: {
    duration: number
    changes: number
    last_row_id: number
    rows_read: number
    rows_written: number
  }
}

/**
 * D1 row types for database results
 */
interface D1TransactionRow {
  id: string
  account_id: string
  date: string
  amount: number
  currency: string
  merchant_name: string | null
  category: string | null
  payment_channel: string | null
  pending: number
  plaid_transaction_id: string
  created_at: string
}

interface D1SyncStateRow {
  sync_id: string
  account_id: string
  started_at: string
  completed_at: string | null
  status: string
  transactions_added: number
  transactions_updated: number
  cursor: string | null
  error: string | null
  requires_reauth: number
}

interface D1AccountRow {
  id: string
  type: string
  name: string
  plaid_access_token: string | null
  plaid_item_id: string | null
  gmail_email: string | null
  gmail_refresh_token: string | null
  created_at: string
  last_sync: string | null
}

/**
 * D1StorageAdapter options
 */
export interface D1StorageAdapterOptions {
  /**
   * D1 database binding
   */
  db: D1Database
}

/**
 * D1 database storage adapter for Cloudflare Workers
 *
 * Uses D1 SQL API for all storage operations. Unlike FileStorageAdapter,
 * D1StorageAdapter supports transactions and does not require file locking.
 *
 * @example
 * ```typescript
 * // In Cloudflare Worker
 * const storage = new D1StorageAdapter({ db: env.DB })
 * await storage.initialize()
 *
 * const transactions = await storage.getTransactions('account-1', 2024, 1)
 * ```
 */
export class D1StorageAdapter
  implements StorageAdapter, RelayTokenStorage
{
  private db: D1Database

  constructor(options: D1StorageAdapterOptions) {
    this.db = options.db
  }

  /**
   * Get the storage capabilities for this adapter
   */
  getCapabilities(): StorageCapabilities {
    return {
      supportsLocking: false, // D1 uses transactions, not file locking
      supportsTransactions: true,
      supportsStreaming: false,
    }
  }

  // StorageAdapter implementation

  async initialize(): Promise<void> {
    // Read and execute the schema
    // In production, schema should be applied via D1 migrations
    // This method is provided for development/testing purposes
    const schema = this.getSchema()
    await this.db.exec(schema)
  }

  /**
   * Get the D1 schema SQL
   *
   * This returns the schema that should be applied to the D1 database.
   * In production, use wrangler d1 migrations instead.
   */
  private getSchema(): string {
    // Embedded schema for development/testing
    // See d1-schema.sql for the canonical version
    return `
      -- Accounts table
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        plaid_access_token TEXT,
        plaid_item_id TEXT,
        gmail_email TEXT,
        gmail_refresh_token TEXT,
        created_at TEXT NOT NULL,
        last_sync TEXT
      );

      -- Transactions table
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        date TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        merchant_name TEXT,
        category TEXT,
        payment_channel TEXT,
        pending INTEGER NOT NULL DEFAULT 0,
        plaid_transaction_id TEXT UNIQUE,
        created_at TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      -- Sync state table
      CREATE TABLE IF NOT EXISTS sync_state (
        sync_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL,
        transactions_added INTEGER NOT NULL DEFAULT 0,
        transactions_updated INTEGER NOT NULL DEFAULT 0,
        cursor TEXT,
        error TEXT,
        requires_reauth INTEGER DEFAULT 0,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date);
      CREATE INDEX IF NOT EXISTS idx_sync_state_account_id ON sync_state(account_id);
      CREATE INDEX IF NOT EXISTS idx_sync_state_started_at ON sync_state(started_at);
    `
  }

  // ============================================================================
  // Transaction Operations
  // ============================================================================

  async getTransactions(
    accountId: string,
    year: number,
    month: number,
  ): Promise<Transaction[]> {
    // Calculate date range for the month
    const startDate = `${year}-${month.toString().padStart(2, "0")}-01`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const endDate = `${nextYear}-${nextMonth.toString().padStart(2, "0")}-01`

    const result = await this.db
      .prepare(
        `SELECT * FROM transactions
         WHERE account_id = ? AND date >= ? AND date < ?
         ORDER BY date DESC`,
      )
      .bind(accountId, startDate, endDate)
      .all<D1TransactionRow>()

    return result.results.map(this.mapTransactionRow)
  }

  async saveTransactions(
    accountId: string,
    _year: number,
    _month: number,
    transactions: Transaction[],
  ): Promise<void> {
    if (transactions.length === 0) return

    // Delete existing transactions for this account in the date range
    const dates = transactions.map((t) => t.date)
    const minDate = dates.sort()[0]
    const maxDate = dates.sort()[dates.length - 1]

    await this.db
      .prepare(
        `DELETE FROM transactions
         WHERE account_id = ? AND date >= ? AND date <= ?`,
      )
      .bind(accountId, minDate, maxDate)
      .run()

    // Insert new transactions
    const statements = transactions.map((txn) =>
      this.db
        .prepare(
          `INSERT INTO transactions
           (id, account_id, date, amount, currency, merchant_name, category,
            payment_channel, pending, plaid_transaction_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          txn.transactionId,
          txn.accountId,
          txn.date,
          txn.amount,
          txn.currency,
          txn.merchantName || null,
          txn.category ? JSON.stringify(txn.category) : null,
          txn.paymentChannel || null,
          txn.pending ? 1 : 0,
          txn.plaidTransactionId,
          txn.createdAt,
        ),
    )

    await this.db.batch(statements)
  }

  async appendTransactions(
    _accountId: string,
    _year: number,
    _month: number,
    transactions: Transaction[],
  ): Promise<{ added: number; updated: number }> {
    if (transactions.length === 0) {
      return { added: 0, updated: 0 }
    }

    let added = 0
    let updated = 0

    // Process each transaction with upsert logic
    for (const txn of transactions) {
      // Check if transaction exists
      const existing = await this.db
        .prepare(
          `SELECT id FROM transactions WHERE plaid_transaction_id = ?`,
        )
        .bind(txn.plaidTransactionId)
        .first()

      if (existing) {
        // Update existing transaction
        await this.db
          .prepare(
            `UPDATE transactions SET
             date = ?, amount = ?, currency = ?, merchant_name = ?,
             category = ?, payment_channel = ?, pending = ?
             WHERE plaid_transaction_id = ?`,
          )
          .bind(
            txn.date,
            txn.amount,
            txn.currency,
            txn.merchantName || null,
            txn.category ? JSON.stringify(txn.category) : null,
            txn.paymentChannel || null,
            txn.pending ? 1 : 0,
            txn.plaidTransactionId,
          )
          .run()
        updated++
      } else {
        // Insert new transaction
        await this.db
          .prepare(
            `INSERT INTO transactions
             (id, account_id, date, amount, currency, merchant_name, category,
              payment_channel, pending, plaid_transaction_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            txn.transactionId,
            txn.accountId,
            txn.date,
            txn.amount,
            txn.currency,
            txn.merchantName || null,
            txn.category ? JSON.stringify(txn.category) : null,
            txn.paymentChannel || null,
            txn.pending ? 1 : 0,
            txn.plaidTransactionId,
            txn.createdAt,
          )
          .run()
        added++
      }
    }

    return { added, updated }
  }

  // ============================================================================
  // Sync State Operations
  // ============================================================================

  async getSyncStates(accountId: string): Promise<SyncState[]> {
    const result = await this.db
      .prepare(
        `SELECT * FROM sync_state
         WHERE account_id = ?
         ORDER BY started_at DESC`,
      )
      .bind(accountId)
      .all<D1SyncStateRow>()

    return result.results.map(this.mapSyncStateRow)
  }

  async getLatestSyncState(accountId: string): Promise<SyncState | null> {
    const row = await this.db
      .prepare(
        `SELECT * FROM sync_state
         WHERE account_id = ?
         ORDER BY started_at DESC
         LIMIT 1`,
      )
      .bind(accountId)
      .first<D1SyncStateRow>()

    return row ? this.mapSyncStateRow(row) : null
  }

  async saveSyncState(state: SyncState): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO sync_state
         (sync_id, account_id, started_at, completed_at, status,
          transactions_added, transactions_updated, cursor, error, requires_reauth)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        state.syncId,
        state.accountId,
        state.startedAt,
        state.completedAt || null,
        state.status,
        state.transactionsAdded,
        state.transactionsUpdated,
        state.cursor || null,
        state.error || null,
        state.requiresReauth ? 1 : 0,
      )
      .run()
  }

  // ============================================================================
  // Account Operations
  // ============================================================================

  async getAccounts(): Promise<AccountRegistry[]> {
    const result = await this.db
      .prepare(`SELECT * FROM accounts ORDER BY created_at`)
      .all<D1AccountRow>()

    return result.results.map(this.mapAccountRow)
  }

  async getAccount(accountId: string): Promise<AccountRegistry | null> {
    const row = await this.db
      .prepare(`SELECT * FROM accounts WHERE id = ?`)
      .bind(accountId)
      .first<D1AccountRow>()

    return row ? this.mapAccountRow(row) : null
  }

  async saveAccount(account: AccountRegistry): Promise<void> {
    // Get existing account to preserve Plaid/Gmail fields
    const existing = await this.db
      .prepare(`SELECT * FROM accounts WHERE id = ?`)
      .bind(account.id)
      .first<D1AccountRow>()

    // Use UPSERT pattern with INSERT OR REPLACE
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO accounts
         (id, type, name, plaid_access_token, plaid_item_id,
          gmail_email, gmail_refresh_token, created_at, last_sync)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        account.id,
        account.type,
        account.name,
        existing?.plaid_access_token || null,
        existing?.plaid_item_id || null,
        existing?.gmail_email || null,
        existing?.gmail_refresh_token || null,
        account.createdAt,
        account.lastSync || null,
      )
      .run()
  }

  async deleteAccount(accountId: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM accounts WHERE id = ?`)
      .bind(accountId)
      .run()
  }

  // ============================================================================
  // Relay Token Operations
  // ============================================================================

  /**
   * Store relay access token for a provider
   *
   * Tokens are stored in D1 relay_tokens table.
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
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO relay_tokens (provider, account_id, token, updated_at)
         VALUES (?, ?, ?, datetime('now'))`,
      )
      .bind(provider, accountId, token)
      .run()
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
    const result = await this.db
      .prepare(
        `SELECT token FROM relay_tokens WHERE provider = ? AND account_id = ?`,
      )
      .bind(provider, accountId)
      .first<{ token: string }>()

    return result?.token ?? null
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
    await this.db
      .prepare(
        `DELETE FROM relay_tokens WHERE provider = ? AND account_id = ?`,
      )
      .bind(provider, accountId)
      .run()
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Map a D1 transaction row to Transaction type
   */
  private mapTransactionRow(row: D1TransactionRow): Transaction {
    return {
      transactionId: row.id,
      accountId: row.account_id,
      date: row.date,
      amount: row.amount,
      currency: row.currency,
      merchantName: row.merchant_name || "",
      category: row.category ? JSON.parse(row.category) : [],
      paymentChannel: row.payment_channel || "",
      pending: row.pending === 1,
      plaidTransactionId: row.plaid_transaction_id,
      createdAt: row.created_at,
    }
  }

  /**
   * Map a D1 sync state row to SyncState type
   */
  private mapSyncStateRow(row: D1SyncStateRow): SyncState {
    return {
      syncId: row.sync_id,
      accountId: row.account_id,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      status: row.status as "running" | "completed" | "failed",
      transactionsAdded: row.transactions_added,
      transactionsUpdated: row.transactions_updated,
      cursor: row.cursor || "",
      error: row.error || undefined,
      requiresReauth: row.requires_reauth === 1,
    }
  }

  /**
   * Map a D1 account row to AccountRegistry type
   */
  private mapAccountRow(row: D1AccountRow): AccountRegistry {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      createdAt: row.created_at,
      lastSync: row.last_sync || undefined,
    }
  }
}

/**
 * Create a D1StorageAdapter with the given database binding
 *
 * @param db - D1 database binding from Cloudflare Worker environment
 * @returns D1StorageAdapter instance
 */
export function createD1StorageAdapter(db: D1Database): D1StorageAdapter {
  return new D1StorageAdapter({ db })
}
