/**
 * Integration test for sync flow
 *
 * Tests the complete path from TransactionStorage through sync operations.
 * Uses temp directories for file system operations.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { IntegrationTestHelpers } from "./setup.js"
import {
  readTransactions,
  writeTransactions,
  appendTransactions,
  readSyncStates,
  writeSyncState,
  initializeStorage,
  type Transaction,
  type SyncState,
} from "../../storage/transaction-storage.js"
import {
  deduplicateTransactions,
} from "../../storage/transaction-storage.js"

describe("Sync Flow Integration", () => {
  const helpers = new IntegrationTestHelpers()

  beforeEach(async () => {
    await helpers.setupTempDir("billclaw-sync-test")
  })

  afterEach(async () => {
    await helpers.cleanup()
  })

  describe("Transaction Storage", () => {
    it("should initialize storage directory structure", async () => {
      await initializeStorage(helpers.getStorageConfig())

      expect(await helpers.tempFileExists("accounts.json")).toBe(false) // Not created until write
      expect(await helpers.tempFileExists("transactions")).toBe(true)
      expect(await helpers.tempFileExists("sync")).toBe(true)
    })

    it("should write and read transactions for a month", async () => {
      const accountId = "test-plaid-account"
      const year = 2026
      const month = 2
      const transactions = helpers.createTestTransactions(3, { accountId })

      await writeTransactions(accountId, year, month, transactions, helpers.getStorageConfig())

      const read = await readTransactions(accountId, year, month, helpers.getStorageConfig())

      expect(read).toHaveLength(3)
      expect(read[0].accountId).toBe(accountId)
    })

    it("should append transactions with deduplication", async () => {
      const accountId = "test-plaid-account"
      const year = 2026
      const month = 2

      // Initial transactions with explicit transactionIds
      const initialTxns = [
        helpers.createTestTransaction({ transactionId: "txn-0", plaidTransactionId: "plaid-0", accountId }),
        helpers.createTestTransaction({ transactionId: "txn-1", plaidTransactionId: "plaid-1", accountId }),
        helpers.createTestTransaction({ transactionId: "txn-2", plaidTransactionId: "plaid-2", accountId }),
      ]
      await appendTransactions(accountId, year, month, initialTxns, helpers.getStorageConfig())

      // Append more transactions (some duplicates by transactionId)
      const moreTxns = [
        // Duplicate (same transactionId as first - this WILL update)
        helpers.createTestTransaction({
          transactionId: "txn-0", // Same transactionId as first
          plaidTransactionId: "plaid-0",
          accountId,
          amount: -9999, // Different amount to verify update
        }),
        // New transaction
        helpers.createTestTransaction({
          transactionId: "txn-new",
          plaidTransactionId: "plaid-new",
          accountId,
        }),
      ]

      const result = await appendTransactions(accountId, year, month, moreTxns, helpers.getStorageConfig())

      expect(result.added).toBe(1) // Only the new one
      expect(result.updated).toBe(1) // The duplicate was updated

      const allTxns = await readTransactions(accountId, year, month, helpers.getStorageConfig())
      expect(allTxns).toHaveLength(4)

      // Verify the duplicate was updated
      const updatedTxn = allTxns.find((t) => t.transactionId === "txn-0")
      expect(updatedTxn?.amount).toBe(-9999)
    })

    it("should sort transactions by date descending after append", async () => {
      const accountId = "test-plaid-account"
      const year = 2026
      const month = 2

      const transactions = [
        helpers.createTestTransaction({
          transactionId: "txn-1",
          date: "2026-02-01",
          accountId,
        }),
        helpers.createTestTransaction({
          transactionId: "txn-2",
          date: "2026-02-15",
          accountId,
        }),
        helpers.createTestTransaction({
          transactionId: "txn-3",
          date: "2026-02-10",
          accountId,
        }),
      ]

      // Use appendTransactions for sorting behavior
      await appendTransactions(accountId, year, month, transactions, helpers.getStorageConfig())

      const read = await readTransactions(accountId, year, month, helpers.getStorageConfig())

      // Should be sorted descending (appendTransactions sorts)
      expect(read[0].date).toBe("2026-02-15")
      expect(read[1].date).toBe("2026-02-10")
      expect(read[2].date).toBe("2026-02-01")
    })
  })

  describe("Sync State Persistence", () => {
    it("should write and read sync state", async () => {
      const state: SyncState = {
        syncId: "sync-123",
        accountId: "test-account",
        startedAt: new Date().toISOString(),
        status: "completed",
        transactionsAdded: 5,
        transactionsUpdated: 2,
        cursor: "cursor-token-abc",
      }

      await writeSyncState(state, helpers.getStorageConfig())

      const states = await readSyncStates("test-account", helpers.getStorageConfig())

      expect(states).toHaveLength(1)
      expect(states[0].syncId).toBe("sync-123")
      expect(states[0].cursor).toBe("cursor-token-abc")
    })

    it("should track multiple sync states sorted by startedAt descending", async () => {
      const accountId = "test-account"

      // Write multiple sync states
      for (let i = 0; i < 3; i++) {
        const state: SyncState = {
          syncId: `sync-${i}`,
          accountId,
          startedAt: new Date(Date.now() - i * 1000).toISOString(),
          status: "completed",
          transactionsAdded: i + 1,
          transactionsUpdated: 0,
          cursor: `cursor-${i}`,
        }
        await writeSyncState(state, helpers.getStorageConfig())
      }

      const states = await readSyncStates(accountId, helpers.getStorageConfig())

      expect(states).toHaveLength(3)
      // Most recent first
      expect(states[0].syncId).toBe("sync-0")
      expect(states[2].syncId).toBe("sync-2")
    })
  })

  describe("Transaction Deduplication", () => {
    it("should keep all transactions within time window regardless of key", async () => {
      const accountId = "test-account"
      const now = Date.now()

      // All transactions within 24 hour window - all will be kept
      // even with same plaidTransactionId because they're recent
      const transactions: Transaction[] = [
        helpers.createTestTransaction({
          transactionId: "txn-1",
          accountId,
          plaidTransactionId: "plaid-abc",
          date: new Date(now - 1 * 60 * 60 * 1000).toISOString().split("T")[0], // 1 hour ago
        }),
        helpers.createTestTransaction({
          transactionId: "txn-2",
          accountId,
          plaidTransactionId: "plaid-abc", // Same plaid ID but within window
          date: new Date(now - 2 * 60 * 60 * 1000).toISOString().split("T")[0], // 2 hours ago
        }),
        helpers.createTestTransaction({
          transactionId: "txn-3",
          accountId,
          plaidTransactionId: "plaid-xyz",
          date: new Date(now - 3 * 60 * 60 * 1000).toISOString().split("T")[0],
        }),
      ]

      const deduped = deduplicateTransactions(transactions, 24)

      // All kept because they're within the 24 hour window
      expect(deduped.length).toBe(3)
    })

    it("should deduplicate old transactions by key", async () => {
      const accountId = "test-account"
      const now = Date.now()

      // Old transactions (outside 24 hour window) with same key
      const oldDate1 = new Date(now - 48 * 60 * 60 * 1000).toISOString().split("T")[0] // 48 hours ago
      const oldDate2 = new Date(now - 49 * 60 * 60 * 1000).toISOString().split("T")[0] // 49 hours ago

      const transactions: Transaction[] = [
        helpers.createTestTransaction({
          transactionId: "txn-old1",
          accountId,
          plaidTransactionId: "plaid-abc",
          date: oldDate1,
        }),
        // Same key, also outside window - should be deduplicated
        helpers.createTestTransaction({
          transactionId: "txn-old2",
          accountId,
          plaidTransactionId: "plaid-abc",
          date: oldDate2,
        }),
        // Different key, outside window - should be kept
        helpers.createTestTransaction({
          transactionId: "txn-old3",
          accountId,
          plaidTransactionId: "plaid-xyz",
          date: oldDate1,
        }),
      ]

      const deduped = deduplicateTransactions(transactions, 24)

      // Should have 2: first plaid-abc + plaid-xyz (deduplicated old)
      expect(deduped.length).toBe(2)
      expect(deduped.find((t) => t.plaidTransactionId === "plaid-xyz")).toBeDefined()
    })

    it("should keep transactions outside deduplication window with different keys", async () => {
      const accountId = "test-account"
      const now = Date.now()
      const oldDate = new Date(now - 48 * 60 * 60 * 1000).toISOString().split("T")[0] // 48 hours ago

      const transactions: Transaction[] = [
        helpers.createTestTransaction({
          transactionId: "txn-old",
          accountId,
          plaidTransactionId: "plaid-abc",
          date: oldDate,
        }),
        // Different key
        helpers.createTestTransaction({
          transactionId: "txn-new",
          accountId,
          plaidTransactionId: "plaid-xyz",
          date: new Date().toISOString().split("T")[0],
        }),
      ]

      const deduped = deduplicateTransactions(transactions, 24)

      // Both kept because different keys
      expect(deduped.length).toBe(2)
    })
  })

  describe("End-to-End Sync Simulation", () => {
    it("should simulate a complete sync flow", async () => {
      const accountId = "plaid-sync-account"
      const year = 2026
      const month = 2

      // 1. Initialize storage
      await initializeStorage(helpers.getStorageConfig())

      // 2. Simulate sync start
      const syncState: SyncState = {
        syncId: `sync-${Date.now()}`,
        accountId,
        startedAt: new Date().toISOString(),
        status: "running",
        transactionsAdded: 0,
        transactionsUpdated: 0,
        cursor: "",
      }
      await writeSyncState(syncState, helpers.getStorageConfig())

      // 3. Simulate fetching transactions from Plaid
      const plaidTransactions = helpers.createTestTransactions(5, { accountId })

      // 4. Store transactions
      const result = await appendTransactions(accountId, year, month, plaidTransactions, helpers.getStorageConfig())

      // 5. Update sync state as completed
      syncState.status = "completed"
      syncState.completedAt = new Date().toISOString()
      syncState.transactionsAdded = result.added
      syncState.transactionsUpdated = result.updated
      syncState.cursor = "next-cursor-token"
      await writeSyncState(syncState, helpers.getStorageConfig())

      // Verify final state
      const storedTxns = await readTransactions(accountId, year, month, helpers.getStorageConfig())
      expect(storedTxns).toHaveLength(5)

      const syncStates = await readSyncStates(accountId, helpers.getStorageConfig())
      expect(syncStates[0].status).toBe("completed")
      expect(syncStates[0].transactionsAdded).toBe(5)
    })

    it("should handle incremental sync with cursor", async () => {
      const accountId = "plaid-incremental"
      const year = 2026
      const month = 2

      // First sync
      await initializeStorage(helpers.getStorageConfig())
      const firstSync: SyncState = {
        syncId: "sync-1",
        accountId,
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date(Date.now() - 3500000).toISOString(),
        status: "completed",
        transactionsAdded: 3,
        transactionsUpdated: 0,
        cursor: "cursor-after-first-sync",
      }
      await writeSyncState(firstSync, helpers.getStorageConfig())

      // First batch with unique transactionIds
      const firstTxns = [
        helpers.createTestTransaction({ transactionId: "first-0", plaidTransactionId: "plaid-first-0", accountId }),
        helpers.createTestTransaction({ transactionId: "first-1", plaidTransactionId: "plaid-first-1", accountId }),
        helpers.createTestTransaction({ transactionId: "first-2", plaidTransactionId: "plaid-first-2", accountId }),
      ]
      await appendTransactions(accountId, year, month, firstTxns, helpers.getStorageConfig())

      // Second sync (incremental)
      const secondSync: SyncState = {
        syncId: "sync-2",
        accountId,
        startedAt: new Date().toISOString(),
        status: "running",
        transactionsAdded: 0,
        transactionsUpdated: 0,
        cursor: "cursor-after-first-sync", // Start from previous cursor
      }

      // New transactions from incremental sync with unique transactionIds
      const newTxns = [
        helpers.createTestTransaction({ transactionId: "second-0", plaidTransactionId: "plaid-second-0", accountId }),
        helpers.createTestTransaction({ transactionId: "second-1", plaidTransactionId: "plaid-second-1", accountId }),
      ]
      const result = await appendTransactions(accountId, year, month, newTxns, helpers.getStorageConfig())

      secondSync.status = "completed"
      secondSync.completedAt = new Date().toISOString()
      secondSync.transactionsAdded = result.added
      secondSync.cursor = "cursor-after-second-sync"
      await writeSyncState(secondSync, helpers.getStorageConfig())

      // Verify
      const allTxns = await readTransactions(accountId, year, month, helpers.getStorageConfig())
      expect(allTxns).toHaveLength(5)

      const states = await readSyncStates(accountId, helpers.getStorageConfig())
      expect(states).toHaveLength(2)
      expect(states[0].cursor).toBe("cursor-after-second-sync")
    })
  })
})
