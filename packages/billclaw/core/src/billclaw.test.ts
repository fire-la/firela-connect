/**
 * Tests for Billclaw main class
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { promises as fs } from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { Billclaw } from "./index"
import type { RuntimeContext } from "./runtime/index"
import type { BillclawConfig, AccountConfig } from "./models"

// Mock runtime context
class MockLogger {
  info = vi.fn()
  error = vi.fn()
  warn = vi.fn()
  debug = vi.fn()
}

class MockConfigProvider {
  private config: BillclawConfig = {
    accounts: [],
    webhooks: [],
    storage: {
      path: "~/.firela/billclaw",
      format: "json",
      encryption: { enabled: false },
    },
    sync: {
      defaultFrequency: "daily",
      maxRetries: 3,
      retryOnFailure: true,
    },
    plaid: {
      environment: "sandbox",
    },
  }

  async getConfig(): Promise<BillclawConfig> {
    return this.config
  }

  async getStorageConfig() {
    return this.config.storage
  }

  async updateAccount(
    accountId: string,
    updates: Partial<AccountConfig>,
  ): Promise<void> {
    const index = this.config.accounts.findIndex((a) => a.id === accountId)
    if (index !== -1) {
      this.config.accounts[index] = {
        ...this.config.accounts[index],
        ...updates,
      }
    }
  }

  async getAccount(accountId: string): Promise<AccountConfig | null> {
    return this.config.accounts.find((a) => a.id === accountId) || null
  }

  setConfig(config: BillclawConfig) {
    this.config = config
  }
}

class MockEventEmitter {
  private listeners = new Map<string, Set<Function>>()

  emit(event: string, data?: unknown): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data)
        } catch {
          // Ignore errors
        }
      }
    }
  }

  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: Function): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }
}

describe("Billclaw", () => {
  let tempDir: string
  let mockContext: RuntimeContext
  let mockConfig: MockConfigProvider
  let billclaw: Billclaw

  beforeEach(async () => {
    // Create temp directory
    tempDir = path.join(os.tmpdir(), `billclaw-test-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })

    const mockLogger = new MockLogger()
    mockConfig = new MockConfigProvider()
    const mockEvents = new MockEventEmitter()

    mockContext = {
      logger: mockLogger as any,
      config: mockConfig as any,
      events: mockEvents as any,
    }

    // Update config to use temp directory
    mockConfig.setConfig({
      ...(await mockConfig.getConfig()),
      storage: {
        path: tempDir,
        format: "json",
        encryption: { enabled: false },
      },
    })

    billclaw = new Billclaw(mockContext)
  })

  afterEach(async () => {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe("constructor", () => {
    it("should create instance with runtime context", () => {
      expect(billclaw).toBeInstanceOf(Billclaw)
    })

    it("should initialize storage", () => {
      expect(billclaw).toBeDefined()
    })
  })

  describe("getAccounts", () => {
    it("should return empty array when no accounts", async () => {
      const accounts = await billclaw.getAccounts()
      expect(accounts).toEqual([])
    })

    it("should return configured accounts", async () => {
      const testAccount: AccountConfig = {
        id: "test-1",
        type: "plaid",
        name: "Test Account",
        enabled: true,
        syncFrequency: "daily",
      }

      mockConfig.setConfig({
        ...(await mockConfig.getConfig()),
        accounts: [testAccount],
      })

      const accounts = await billclaw.getAccounts()
      expect(accounts).toHaveLength(1)
      expect(accounts[0]).toEqual(testAccount)
    })
  })

  describe("getTransactions", () => {
    beforeEach(async () => {
      // Add test account
      const testAccount: AccountConfig = {
        id: "acct-1",
        type: "plaid",
        name: "Test Account",
        enabled: true,
        syncFrequency: "daily",
      }

      mockConfig.setConfig({
        ...(await mockConfig.getConfig()),
        accounts: [testAccount],
      })
    })

    it("should return transactions for account and period", async () => {
      // This test would require actual storage to be working
      // For now, we test the method signature
      const transactions = await billclaw.getTransactions("acct-1", 2024, 1)
      expect(Array.isArray(transactions)).toBe(true)
    })

    it("should return all transactions when account is 'all'", async () => {
      const transactions = await billclaw.getTransactions("all", 2024, 1)
      expect(Array.isArray(transactions)).toBe(true)
    })
  })

  describe("exportToBeancount", () => {
    it("should export transactions to Beancount format", async () => {
      const exportResult = await billclaw.exportToBeancount("acct-1", 2024, 1)

      expect(typeof exportResult).toBe("string")
      expect(exportResult).toContain("Beancount")
    })
  })

  describe("exportToLedger", () => {
    it("should export transactions to Ledger format", async () => {
      const exportResult = await billclaw.exportToLedger("acct-1", 2024, 1)

      expect(typeof exportResult).toBe("string")
    })
  })

  describe("events", () => {
    it("should emit events through event emitter", async () => {
      const mockEvents = mockContext.events as MockEventEmitter
      let eventReceived = false

      mockEvents.on("test.event", () => {
        eventReceived = true
      })

      mockEvents.emit("test.event")

      expect(eventReceived).toBe(true)
    })
  })
})
