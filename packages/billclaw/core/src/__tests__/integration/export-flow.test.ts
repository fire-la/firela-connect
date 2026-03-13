/**
 * Integration test for export flow
 *
 * Tests the complete path from storage through exporters to file output.
 * Uses temp directories for file system operations.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { IntegrationTestHelpers } from "./setup.js"
import { exportToBeancount, transactionToBeancount } from "../../exporters/beancount.js"
import { exportToLedger, transactionToLedger } from "../../exporters/ledger.js"
import { readTransactions } from "../../storage/transaction-storage.js"

describe("Export Flow Integration", () => {
  const helpers = new IntegrationTestHelpers()

  beforeEach(async () => {
    await helpers.setupTempDir("billclaw-export-test")
  })

  afterEach(async () => {
    await helpers.cleanup()
  })

  describe("Beancount Export", () => {
    it("should format single transaction as beancount", async () => {
      const txn = helpers.createTestTransaction({
        date: "2026-02-24",
        merchantName: "Amazon",
        category: ["Shopping", "Electronics"],
        amount: -4999, // $49.99 expense
      })

      const output = transactionToBeancount(txn, {
        accountId: "test-account",
        year: 2026,
        month: 2,
      })

      expect(output).toContain("2026-02-24")
      expect(output).toContain("Amazon")
      expect(output).toContain("Shopping, Electronics") // narration
      expect(output).toContain("49.99 USD")
      expect(output).toContain("Expenses:Unknown") // Default account
      expect(output).toContain("Assets:Bank:Checking")
    })

    it("should format income transaction correctly", async () => {
      const txn = helpers.createTestTransaction({
        date: "2026-02-24",
        merchantName: "Employer Inc",
        category: ["Income", "Salary"],
        amount: 500000, // $5000.00 income (positive)
      })

      const output = transactionToBeancount(txn, {
        accountId: "test-account",
        year: 2026,
        month: 2,
      })

      // Income: Checking account receives money
      expect(output).toContain("Assets:Bank:Checking  5000.00 USD")
      expect(output).toContain("Expenses:Unknown")
    })

    it("should use custom account mappings", async () => {
      const txn = helpers.createTestTransaction({
        date: "2026-02-24",
        merchantName: "Uber Eats",
        category: ["Food and Drink", "Restaurants"],
        amount: -2500,
      })

      const output = transactionToBeancount(txn, {
        accountId: "test-account",
        year: 2026,
        month: 2,
        tagAccounts: {
          "Food and Drink": "Expenses:Food:Restaurants",
        },
      })

      expect(output).toContain("Expenses:Food:Restaurants")
    })

    it("should include tags when enabled", async () => {
      const txn = helpers.createTestTransaction({
        date: "2026-02-24",
        merchantName: "Test Merchant",
        paymentChannel: "in_store",
        pending: true,
      })

      const output = transactionToBeancount(txn, {
        accountId: "test-account",
        year: 2026,
        month: 2,
        includeTags: true,
      })

      expect(output).toContain("#plaid") // Non-email channel
      expect(output).toContain("#pending")
    })

    it("should export multiple transactions to beancount file", async () => {
      const accountId = "export-test-account"
      const year = 2026
      const month = 2

      // Seed transactions
      const transactions = helpers.createTestTransactions(5, { accountId })
      await helpers.seedTransactions(accountId, year, month, transactions)

      // Export
      const output = await exportToBeancount(transactions, {
        accountId,
        year,
        month,
      })

      // Verify file structure
      expect(output).toContain(";; Beancount export from BillClaw")
      expect(output).toContain(";; Account: export-test-account")
      expect(output).toContain(";; Period: 2026-02")

      // Verify all transactions present
      const lines = output.split("\n")
      const transactionLines = lines.filter((l) => l.match(/^\d{4}-\d{2}-\d{2}/))
      expect(transactionLines).toHaveLength(5)
    })

    it("should handle empty transaction list", async () => {
      const output = await exportToBeancount([], {
        accountId: "empty-account",
        year: 2026,
        month: 2,
      })

      expect(output).toContain(";; Beancount export from BillClaw")
      expect(output).toContain("; No transactions found")
    })
  })

  describe("Ledger Export", () => {
    it("should format single transaction as ledger", async () => {
      const txn = helpers.createTestTransaction({
        date: "2026-02-24",
        merchantName: "Starbucks",
        category: ["Food and Drink", "Coffee"],
        amount: -550, // $5.50 expense
      })

      const output = transactionToLedger(txn, {
        accountId: "test-account",
        year: 2026,
        month: 2,
      })

      expect(output).toContain("2026/02/24")
      expect(output).toContain("Starbucks")
      expect(output).toContain("$5.50")
      expect(output).toContain("Expenses:Unknown")
      expect(output).toContain("Assets:Bank:Checking")
    })

    it("should export multiple transactions to ledger file", async () => {
      const accountId = "ledger-test-account"
      const year = 2026
      const month = 2

      // Seed transactions
      const transactions = helpers.createTestTransactions(3, { accountId })
      await helpers.seedTransactions(accountId, year, month, transactions)

      // Export
      const output = await exportToLedger(transactions, {
        accountId,
        year,
        month,
      })

      // Verify file structure
      expect(output).toContain("; Ledger export from BillClaw")
      expect(output).toContain("; Account: ledger-test-account")

      // Count transaction headers (date lines)
      const lines = output.split("\n")
      const transactionLines = lines.filter((l) => l.match(/^\d{4}\/\d{2}\/\d{2}/))
      expect(transactionLines).toHaveLength(3)
    })
  })

  describe("End-to-End Export Flow", () => {
    it("should export stored transactions to beancount format", async () => {
      const accountId = "e2e-export-account"
      const year = 2026
      const month = 2

      // 1. Seed transactions in storage
      const transactions = [
        helpers.createTestTransaction({
          transactionId: "txn-1",
          accountId,
          date: "2026-02-15",
          merchantName: "Grocery Store",
          category: ["Groceries"],
          amount: -8999,
        }),
        helpers.createTestTransaction({
          transactionId: "txn-2",
          accountId,
          date: "2026-02-20",
          merchantName: "Gas Station",
          category: ["Gasoline"],
          amount: -4500,
        }),
        helpers.createTestTransaction({
          transactionId: "txn-3",
          accountId,
          date: "2026-02-22",
          merchantName: "Paycheck",
          category: ["Income", "Salary"],
          amount: 350000, // $3500 income
        }),
      ]
      await helpers.seedTransactions(accountId, year, month, transactions)

      // 2. Read from storage
      const stored = await readTransactions(accountId, year, month, helpers.getStorageConfig())
      expect(stored).toHaveLength(3)

      // 3. Export to Beancount
      const beancount = await exportToBeancount(stored, {
        accountId,
        year,
        month,
        tagAccounts: {
          Groceries: "Expenses:Food:Groceries",
          Gasoline: "Expenses:Transport:Fuel",
          Income: "Income:Salary",
        },
      })

      // 4. Verify export
      expect(beancount).toContain("Grocery Store")
      expect(beancount).toContain("Gas Station")
      expect(beancount).toContain("Paycheck")
      expect(beancount).toContain("Expenses:Food:Groceries")
      expect(beancount).toContain("Expenses:Transport:Fuel")
      expect(beancount).toContain("Income:Salary")

      // Verify amounts (convert cents to dollars)
      expect(beancount).toContain("89.99 USD") // Grocery
      expect(beancount).toContain("45.00 USD") // Gas
      expect(beancount).toContain("3500.00 USD") // Paycheck
    })

    it("should export stored transactions to ledger format", async () => {
      const accountId = "e2e-ledger-account"
      const year = 2026
      const month = 2

      // Seed transactions
      const transactions = helpers.createTestTransactions(2, { accountId })
      await helpers.seedTransactions(accountId, year, month, transactions)

      // Read and export
      const stored = await readTransactions(accountId, year, month, helpers.getStorageConfig())
      const ledger = await exportToLedger(stored, {
        accountId,
        year,
        month,
      })

      // Verify ledger format
      expect(ledger).toContain("; Ledger export from BillClaw")
      expect(ledger).toContain("$") // Dollar amounts
    })
  })

  describe("Export Edge Cases", () => {
    it("should handle transactions without category", async () => {
      const txn = helpers.createTestTransaction({
        merchantName: "Unknown Merchant",
        category: [],
        amount: -1000,
      })

      const output = transactionToBeancount(txn, {
        accountId: "test",
        year: 2026,
        month: 2,
      })

      // Should use default account
      expect(output).toContain("Expenses:Unknown")
    })

    it("should handle transactions without merchant name", async () => {
      const txn = helpers.createTestTransaction({
        merchantName: "",
        amount: -1000,
      })

      const output = transactionToBeancount(txn, {
        accountId: "test",
        year: 2026,
        month: 2,
      })

      // Should use "Unknown" as payee
      expect(output).toContain('"Unknown"')
    })

    it("should handle zero amount transaction", async () => {
      const txn = helpers.createTestTransaction({
        merchantName: "Zero Transaction",
        amount: 0,
      })

      const output = transactionToBeancount(txn, {
        accountId: "test",
        year: 2026,
        month: 2,
      })

      expect(output).toContain("0.00 USD")
    })
  })
})
