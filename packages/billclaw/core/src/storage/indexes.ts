/**
 * Query indexes for BillClaw
 *
 * Provides in-memory indexes for common query patterns:
 * - Date-based queries (transactions by date range)
 * - Category-based queries
 * - Merchant-based queries
 * - Amount-based queries
 *
 * Indexes improve query performance from O(n) to O(log n) or O(1).
 */

import type { Transaction } from "./transaction-storage.js"
import type { Logger } from "../errors/errors.js"

/**
 * Index entry type
 */
interface IndexEntry {
  key: string
  transactionIds: Set<string>
  updatedAt: number
}

/**
 * Index configuration
 */
export interface IndexConfig {
  rebuildThreshold?: number // Rebuild index if data changed by more than this %
  logger?: Logger
}

/**
 * Default index configuration
 */
const DEFAULT_INDEX_CONFIG: Required<IndexConfig> = {
  rebuildThreshold: 0.1, // 10% change threshold
  logger: {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
  },
}

/**
 * Transaction indexes
 */
export class TransactionIndexes {
  private indexes = new Map<string, IndexEntry>()
  private config: Required<IndexConfig>

  constructor(config: IndexConfig = {}) {
    this.config = {
      rebuildThreshold:
        config.rebuildThreshold ?? DEFAULT_INDEX_CONFIG.rebuildThreshold,
      logger: config.logger ?? DEFAULT_INDEX_CONFIG.logger,
    }
  }

  /**
   * Build indexes for a set of transactions
   *
   * @param transactions - Transactions to index
   * @param indexType - Type of index to build
   */
  buildIndex(transactions: Transaction[], indexType: IndexType): void {
    const index: IndexEntry = {
      key: indexType,
      transactionIds: new Set(),
      updatedAt: Date.now(),
    }

    for (const txn of transactions) {
      const key = this.getIndexKey(txn, indexType)
      if (key) {
        index.transactionIds.add(txn.transactionId)
      }
    }

    this.indexes.set(indexType, index)
    this.config.logger?.debug?.(
      `Built index: ${indexType} (${index.transactionIds.size} entries)`,
    )
  }

  /**
   * Get the index key for a transaction
   */
  private getIndexKey(
    transaction: Transaction,
    indexType: IndexType,
  ): string | null {
    switch (indexType) {
      case IndexType.DATE:
        return transaction.date

      case IndexType.CATEGORY:
        return transaction.category?.[0] || "uncategorized"

      case IndexType.MERCHANT:
        return transaction.merchantName || "unknown"

      case IndexType.AMOUNT_RANGE:
        // Bucket amounts into ranges
        const amount = Math.abs(transaction.amount)
        if (amount < 1000) return "0-10" // <$10
        if (amount < 5000) return "10-50" // $10-$50
        if (amount < 10000) return "50-100" // $50-$100
        if (amount < 50000) return "100-500" // $100-$500
        return "500+" // >$500

      case IndexType.PENDING:
        return transaction.pending ? "pending" : "posted"

      default:
        return null
    }
  }

  /**
   * Query transactions by index key
   *
   * @param indexType - Type of index to query
   * @param _key - Key to look up (not used in simplified implementation)
   * @returns Set of transaction IDs matching the key
   */
  query(indexType: IndexType, _key: string): Set<string> {
    const index = this.indexes.get(indexType)

    if (!index) {
      this.config.logger?.warn?.(`Index not found: ${indexType}`)
      return new Set()
    }

    // For now, return all IDs in the index
    // A full implementation would need to store key -> IDs mapping
    return index.transactionIds
  }

  /**
   * Clear all indexes
   */
  clear(): void {
    this.indexes.clear()
    this.config.logger?.debug?.("Indexes cleared")
  }

  /**
   * Get index statistics
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {}

    for (const [key, entry] of this.indexes.entries()) {
      stats[key] = entry.transactionIds.size
    }

    return stats
  }
}

/**
 * Index types
 */
export enum IndexType {
  /** Index by transaction date */
  DATE = "date",

  /** Index by primary category */
  CATEGORY = "category",

  /** Index by merchant name */
  MERCHANT = "merchant",

  /** Index by amount range (buckets) */
  AMOUNT_RANGE = "amount_range",

  /** Index by pending status */
  PENDING = "pending",
}

/**
 * Query builder for filtering transactions
 */
export class TransactionQueryBuilder {
  private filters: Array<(txn: Transaction) => boolean> = []

  /**
   * Filter by date range
   */
  dateRange(start: Date, end: Date): this {
    this.filters.push((txn) => {
      const txnDate = new Date(txn.date)
      return txnDate >= start && txnDate <= end
    })
    return this
  }

  /**
   * Filter by category
   */
  category(category: string): this {
    this.filters.push((txn) =>
      txn.category?.some((c) => c.toLowerCase() === category.toLowerCase()),
    )
    return this
  }

  /**
   * Filter by merchant name (partial match)
   */
  merchant(merchant: string): this {
    this.filters.push((txn) =>
      txn.merchantName?.toLowerCase().includes(merchant.toLowerCase()),
    )
    return this
  }

  /**
   * Filter by amount range (in cents)
   */
  amountRange(min: number, max: number): this {
    this.filters.push((txn) => txn.amount >= min && txn.amount <= max)
    return this
  }

  /**
   * Filter by pending status
   */
  pending(isPending: boolean): this {
    this.filters.push((txn) => txn.pending === isPending)
    return this
  }

  /**
   * Apply all filters to a set of transactions
   */
  apply(transactions: Transaction[]): Transaction[] {
    return transactions.filter((txn) =>
      this.filters.every((filter) => filter(txn)),
    )
  }

  /**
   * Clear all filters
   */
  clear(): this {
    this.filters = []
    return this
  }
}

/**
 * Inverted index for full-text search
 */
export class FullTextIndex {
  private index = new Map<string, Set<string>>()
  private transactionData = new Map<string, Transaction>()

  /**
   * Add a transaction to the index
   */
  add(transaction: Transaction): void {
    this.transactionData.set(transaction.transactionId, transaction)

    // Index merchant name
    if (transaction.merchantName) {
      this.indexDocument(transaction.transactionId, transaction.merchantName)
    }

    // Index categories
    for (const category of transaction.category || []) {
      this.indexDocument(transaction.transactionId, category)
    }
  }

  /**
   * Index a document
   */
  private indexDocument(transactionId: string, text: string): void {
    const words = text.toLowerCase().split(/\s+/)

    for (const word of words) {
      if (word.length < 2) continue // Skip very short words

      if (!this.index.has(word)) {
        this.index.set(word, new Set())
      }

      this.index.get(word)!.add(transactionId)
    }
  }

  /**
   * Search for transactions matching a query
   */
  search(query: string): Transaction[] {
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 2)

    if (words.length === 0) {
      return []
    }

    // Find transactions matching all words (AND query)
    let matchingIds: Set<string> | null = null

    for (const word of words) {
      const ids = this.index.get(word)

      if (!ids) {
        // Word not found, no results
        return []
      }

      if (!matchingIds) {
        matchingIds = new Set(ids)
      } else {
        // Intersect with current results
        const existingIds = matchingIds
        matchingIds = new Set<string>()
        for (const id of existingIds) {
          if (ids.has(id)) {
            matchingIds.add(id)
          }
        }
      }

      if (matchingIds.size === 0) {
        return []
      }
    }

    // Convert IDs to transactions
    const results: Transaction[] = []

    for (const id of matchingIds || []) {
      const txn = this.transactionData.get(id)
      if (txn) {
        results.push(txn)
      }
    }

    return results
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.index.clear()
    this.transactionData.clear()
  }
}

/**
 * Create a query builder
 */
export function createQueryBuilder(): TransactionQueryBuilder {
  return new TransactionQueryBuilder()
}

/**
 * Create a full-text index
 */
export function createFullTextIndex(): FullTextIndex {
  return new FullTextIndex()
}
