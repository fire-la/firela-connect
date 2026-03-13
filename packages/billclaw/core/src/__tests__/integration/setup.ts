/**
 * Integration test infrastructure for BillClaw
 *
 * Provides shared utilities for integration tests:
 * - Temp directory management with automatic cleanup
 * - Mock server helpers
 * - Test fixtures for Plaid/Gmail responses
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import { vi } from "vitest"
import type { RuntimeContext, ConfigProvider } from "../../runtime/types.js"
import type { Logger } from "../../errors/errors.js"
import type { BillclawConfig, StorageConfig } from "../../models/config.js"
import type { Transaction } from "../../storage/transaction-storage.js"

/**
 * Integration test helper class
 */
export class IntegrationTestHelpers {
  tempDir: string = ""
  private createdDirs: string[] = []

  /**
   * Setup temp directory - call in beforeEach
   */
  async setupTempDir(prefix: string = "billclaw-test"): Promise<string> {
    this.tempDir = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(this.tempDir, { recursive: true })
    this.createdDirs.push(this.tempDir)
    return this.tempDir
  }

  /**
   * Cleanup all temp directories - call in afterEach
   */
  async cleanup(): Promise<void> {
    for (const dir of this.createdDirs) {
      try {
        await fs.rm(dir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup errors
      }
    }
    this.createdDirs = []
    this.tempDir = ""
  }

  /**
   * Get storage config pointing to temp directory
   */
  getStorageConfig(): StorageConfig {
    return {
      path: this.tempDir,
      format: "json",
      encryption: { enabled: false },
    }
  }

  /**
   * Create a mock runtime context for testing
   */
  createMockContext(config: Partial<BillclawConfig> = {}): RuntimeContext {
    const mockLogger: Logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }

    const storageConfig = this.getStorageConfig()

    const fullConfig: BillclawConfig = {
      version: 1,
      accounts: config.accounts || [],
      webhooks: config.webhooks || [],
      storage: storageConfig,
      sync: config.sync || {
        defaultFrequency: "daily",
        retryOnFailure: true,
        maxRetries: 3,
      },
      plaid: config.plaid || {
        environment: "sandbox",
      },
      gmail: config.gmail || {
        senderWhitelist: [],
        keywords: ["invoice", "statement", "bill due", "receipt", "payment due"],
        confidenceThreshold: 0.5,
        requireAmount: false,
        requireDate: false,
      },
      connect: config.connect || {
        port: 4456,
        host: "localhost",
      },
      export: config.export || {
        format: "beancount",
        outputPath: "~/.firela/billclaw/exports",
        filePrefix: "transactions",
        includePending: false,
        currencyColumn: true,
      },
      ...config,
    }

    const mockConfigProvider: ConfigProvider = {
      getConfig: async () => fullConfig,
      getStorageConfig: async () => storageConfig,
      updateAccount: async () => {},
      getAccount: async () => null,
      updateConfig: async () => {},
    }

    return {
      logger: mockLogger,
      config: mockConfigProvider,
    }
  }

  /**
   * Create test transaction fixture
   */
  createTestTransaction(overrides: Partial<Transaction> = {}): Transaction {
    return {
      transactionId: `txn-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      accountId: "test-account",
      date: new Date().toISOString().split("T")[0],
      amount: -2500, // $25.00 in cents (expense)
      currency: "USD",
      category: ["Food and Drink", "Restaurants"],
      merchantName: "Test Merchant",
      paymentChannel: "in_store",
      pending: false,
      plaidTransactionId: `plaid-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...overrides,
    }
  }

  /**
   * Create multiple test transactions
   */
  createTestTransactions(count: number, overrides: Partial<Transaction> = {}): Transaction[] {
    const transactions: Transaction[] = []
    for (let i = 0; i < count; i++) {
      transactions.push(
        this.createTestTransaction({
          transactionId: `txn-${i}`,
          plaidTransactionId: `plaid-${i}`,
          amount: -(1000 * (i + 1)), // Different amounts
          date: new Date(Date.now() - i * 86400000).toISOString().split("T")[0], // Different dates
          ...overrides,
        })
      )
    }
    return transactions
  }

  /**
   * Write transactions directly to storage (for seeding test data)
   */
  async seedTransactions(
    accountId: string,
    year: number,
    month: number,
    transactions: Transaction[]
  ): Promise<void> {
    const monthStr = month.toString().padStart(2, "0")
    const dirPath = path.join(this.tempDir, "transactions", accountId, `${year}`)
    const filePath = path.join(dirPath, `${monthStr}.json`)

    await fs.mkdir(dirPath, { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(transactions, null, 2), "utf-8")
  }

  /**
   * Read file from temp directory
   */
  async readTempFile(relativePath: string): Promise<string> {
    const filePath = path.join(this.tempDir, relativePath)
    return fs.readFile(filePath, "utf-8")
  }

  /**
   * Check if file exists in temp directory
   */
  async tempFileExists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.tempDir, relativePath))
      return true
    } catch {
      return false
    }
  }
}

/**
 * Plaid API mock fixtures
 */
export const PlaidFixtures = {
  /**
   * Mock successful transactions sync response
   */
  successfulSyncResponse: (transactions: Partial<Transaction>[] = []) => ({
    added: transactions.map((t, i) => ({
      transaction_id: t.plaidTransactionId || `plaid-txn-${i}`,
      account_id: t.accountId || "test-account",
      date: t.date || "2026-02-24",
      amount: (t.amount || -2500) / 100, // Convert cents to dollars
      iso_currency_code: t.currency || "USD",
      category: t.category || ["Food and Drink"],
      merchant_name: t.merchantName || "Test Merchant",
      payment_channel: t.paymentChannel || "in_store",
      pending: t.pending || false,
    })),
    modified: [],
    removed: [],
    next_cursor: "next-cursor-token",
    has_more: false,
  }),

  /**
   * Mock Plaid item (account) response
   */
  itemResponse: (itemId: string = "item-test") => ({
    item_id: itemId,
    institution_id: "ins_123",
    webhook: "",
    error: null,
    available_products: ["transactions"],
    billed_products: ["transactions"],
    products: ["transactions"],
  }),

  /**
   * Mock accounts response
   */
  accountsResponse: () => ({
    accounts: [
      {
        account_id: "acc-123",
        name: "Checking",
        type: "depository",
        subtype: "checking",
        balances: { available: 1000, current: 1000, currency: "USD" },
      },
    ],
  }),
}

/**
 * Gmail API mock fixtures
 */
export const GmailFixtures = {
  /**
   * Mock Gmail message list response
   */
  messageListResponse: (messageIds: string[] = ["msg-1", "msg-2"]) => ({
    messages: messageIds.map((id) => ({ id, threadId: id })),
    nextPageToken: null,
    resultSizeEstimate: messageIds.length,
  }),

  /**
   * Mock Gmail message response (bill email)
   */
  billMessageResponse: (
    messageId: string = "msg-1",
    subject: string = "Your Invoice #12345"
  ) => ({
    id: messageId,
    threadId: messageId,
    labelIds: ["INBOX"],
    snippet: "Your invoice for $49.99 is due...",
    payload: {
      headers: [
        { name: "Subject", value: subject },
        { name: "From", value: "billing@example.com" },
        { name: "Date", value: "Mon, 24 Feb 2026 10:00:00 +0000" },
      ],
      body: {
        data: Buffer.from(
          "Your invoice for $49.99 is due on March 1st, 2026."
        ).toString("base64"),
      },
    },
  }),
}

/**
 * Relay API mock fixtures
 */
export const RelayFixtures = {
  /**
   * Mock health check response (success)
   */
  healthCheckSuccess: () => ({
    status: "ok",
    version: "1.0.0",
  }),

  /**
   * Mock credential storage response
   */
  credentialStoredResponse: () => ({
    success: true,
    sessionId: "session-123",
  }),
}
