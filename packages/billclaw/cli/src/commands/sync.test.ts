/**
 * Tests for sync command
 *
 * Tests manual transaction sync from configured accounts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { syncCommand } from "./sync.js"
import {
  createMockCliContext,
  createMockAccount,
} from "../__tests__/test-utils.js"

// Mock Spinner - must return proper chainable methods
const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
}

vi.mock("../utils/progress.js", () => ({
  Spinner: vi.fn(() => mockSpinner),
}))

// Mock format utilities
vi.mock("../utils/format.js", () => ({
  success: vi.fn(),
  formatStatus: vi.fn((status) => status),
  formatError: vi.fn((err) => err.humanReadable?.title || String(err)),
}))

// Mock @firela/billclaw-core
vi.mock("@firela/billclaw-core", () => ({
  Billclaw: vi.fn(),
  formatError: vi.fn((err) => err.humanReadable?.title || String(err)),
}))

import { Billclaw } from "@firela/billclaw-core"

describe("sync command", () => {
  let mockBillclawInstance: {
    getAccounts: ReturnType<typeof vi.fn>
    syncPlaid: ReturnType<typeof vi.fn>
    syncGmail: ReturnType<typeof vi.fn>
    syncAccount: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset spinner mocks
    mockSpinner.start.mockReturnThis()
    mockSpinner.succeed.mockReturnThis()
    mockSpinner.fail.mockReturnThis()

    // Create mock Billclaw instance
    mockBillclawInstance = {
      getAccounts: vi.fn(),
      syncPlaid: vi.fn(),
      syncGmail: vi.fn(),
      syncAccount: vi.fn(),
    }

    // Mock Billclaw constructor to return our mock instance
    vi.mocked(Billclaw).mockImplementation(() => mockBillclawInstance as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("command definition", () => {
    it("should have correct command name", () => {
      expect(syncCommand.name).toBe("sync")
    })

    it("should have a description", () => {
      expect(syncCommand.description).toBeDefined()
      expect(syncCommand.description.length).toBeGreaterThan(0)
    })

    it("should have aliases", () => {
      expect(syncCommand.aliases).toContain("pull")
    })

    it("should have options", () => {
      expect(syncCommand.options).toBeDefined()
      expect(syncCommand.options?.length).toBeGreaterThan(0)
    })

    it("should have a handler function", () => {
      expect(syncCommand.handler).toBeDefined()
      expect(typeof syncCommand.handler).toBe("function")
    })
  })

  describe("sync all accounts", () => {
    it("should sync all accounts when no account ID specified", async () => {
      const plaidAccount = createMockAccount({ id: "plaid-1", type: "plaid" })
      const gmailAccount = createMockAccount({ id: "gmail-1", type: "gmail" })

      mockBillclawInstance.getAccounts.mockResolvedValue([plaidAccount, gmailAccount])
      mockBillclawInstance.syncPlaid.mockResolvedValue([
        { accountId: "plaid-1", transactionsAdded: 5, transactionsUpdated: 2, errors: [] },
      ])
      mockBillclawInstance.syncGmail.mockResolvedValue([
        { accountId: "gmail-1", transactionsAdded: 3, transactionsUpdated: 1, errors: [] },
      ])

      const context = createMockCliContext()
      await syncCommand.handler(context, {})

      expect(Billclaw).toHaveBeenCalled()
      expect(mockBillclawInstance.getAccounts).toHaveBeenCalled()
      expect(mockBillclawInstance.syncPlaid).toHaveBeenCalledWith(["plaid-1"])
      expect(mockBillclawInstance.syncGmail).toHaveBeenCalledWith(["gmail-1"])
    })

    it("should sync GoCardless accounts alongside plaid and gmail", async () => {
      const plaidAccount = createMockAccount({ id: "plaid-1", type: "plaid" })
      const gocardlessAccount = createMockAccount({ id: "gocardless-1", type: "gocardless" })

      mockBillclawInstance.getAccounts.mockResolvedValue([plaidAccount, gocardlessAccount])
      mockBillclawInstance.syncPlaid.mockResolvedValue([
        { accountId: "plaid-1", transactionsAdded: 5, transactionsUpdated: 2, errors: [] },
      ])
      mockBillclawInstance.syncAccount.mockResolvedValue({
        accountId: "gocardless-1",
        success: true,
        transactionsAdded: 3,
        transactionsUpdated: 1,
        errors: [],
      })

      const context = createMockCliContext()
      await syncCommand.handler(context, {})

      expect(mockBillclawInstance.syncPlaid).toHaveBeenCalledWith(["plaid-1"])
      expect(mockBillclawInstance.syncAccount).toHaveBeenCalledWith("gocardless-1")
    })

    it("should handle no accounts configured", async () => {
      mockBillclawInstance.getAccounts.mockResolvedValue([])

      const context = createMockCliContext()
      await syncCommand.handler(context, {})

      expect(mockBillclawInstance.getAccounts).toHaveBeenCalled()
      // Should not call sync methods when no accounts
      expect(mockBillclawInstance.syncPlaid).not.toHaveBeenCalled()
      expect(mockBillclawInstance.syncGmail).not.toHaveBeenCalled()
    })
  })

  describe("sync single account", () => {
    it("should sync GoCardless account via syncAccount", async () => {
      const account = createMockAccount({ id: "gocardless-1", type: "gocardless" })

      mockBillclawInstance.getAccounts.mockResolvedValue([account])
      mockBillclawInstance.syncAccount.mockResolvedValue({
        accountId: "gocardless-1",
        success: true,
        transactionsAdded: 7,
        transactionsUpdated: 3,
        errors: [],
      })

      const context = createMockCliContext()
      await syncCommand.handler(context, { account: "gocardless-1" })

      expect(mockBillclawInstance.syncAccount).toHaveBeenCalledWith("gocardless-1")
    })

    it("should sync a specific account by ID", async () => {
      const account = createMockAccount({ id: "plaid-1", type: "plaid" })

      mockBillclawInstance.getAccounts.mockResolvedValue([account])
      mockBillclawInstance.syncPlaid.mockResolvedValue([
        { accountId: "plaid-1", transactionsAdded: 10, transactionsUpdated: 5, errors: [] },
      ])

      const context = createMockCliContext()
      await syncCommand.handler(context, { account: "plaid-1" })

      expect(mockBillclawInstance.syncPlaid).toHaveBeenCalledWith(["plaid-1"])
    })

    it("should handle account not found", async () => {
      mockBillclawInstance.getAccounts.mockResolvedValue([
        createMockAccount({ id: "other-account", type: "plaid" }),
      ])

      const context = createMockCliContext()
      await syncCommand.handler(context, { account: "nonexistent" })

      // Should not sync if account not found
      expect(mockBillclawInstance.syncPlaid).not.toHaveBeenCalled()
      expect(mockBillclawInstance.syncGmail).not.toHaveBeenCalled()
    })

    it("should sync Gmail account by ID", async () => {
      const account = createMockAccount({ id: "gmail-1", type: "gmail" })

      mockBillclawInstance.getAccounts.mockResolvedValue([account])
      mockBillclawInstance.syncGmail.mockResolvedValue([
        { accountId: "gmail-1", transactionsAdded: 5, transactionsUpdated: 3, errors: [] },
      ])

      const context = createMockCliContext()
      await syncCommand.handler(context, { account: "gmail-1" })

      expect(mockBillclawInstance.syncGmail).toHaveBeenCalledWith(["gmail-1"])
    })
  })

  describe("sync results", () => {
    it("should track added and updated transactions", async () => {
      const account = createMockAccount({ id: "plaid-1", type: "plaid" })

      mockBillclawInstance.getAccounts.mockResolvedValue([account])
      mockBillclawInstance.syncPlaid.mockResolvedValue([
        {
          accountId: "plaid-1",
          transactionsAdded: 10,
          transactionsUpdated: 5,
          errors: [],
        },
      ])

      const context = createMockCliContext()
      await syncCommand.handler(context, { account: "plaid-1" })

      expect(mockBillclawInstance.syncPlaid).toHaveBeenCalled()
    })

    it("should handle sync errors", async () => {
      const account = createMockAccount({ id: "plaid-1", type: "plaid" })

      mockBillclawInstance.getAccounts.mockResolvedValue([account])
      mockBillclawInstance.syncPlaid.mockResolvedValue([
        {
          accountId: "plaid-1",
          transactionsAdded: 0,
          transactionsUpdated: 0,
          errors: [
            {
              type: "UserError",
              errorCode: "PLAID_API_ERROR",
              humanReadable: { title: "API Error", message: "Test error", suggestions: [] },
            },
          ],
        },
      ])

      const context = createMockCliContext()
      await syncCommand.handler(context, { account: "plaid-1" })

      expect(mockBillclawInstance.syncPlaid).toHaveBeenCalled()
    })

    it("should handle sync exceptions", async () => {
      const account = createMockAccount({ id: "plaid-1", type: "plaid" })

      mockBillclawInstance.getAccounts.mockResolvedValue([account])
      mockBillclawInstance.syncPlaid.mockRejectedValue(new Error("Sync failed"))

      const context = createMockCliContext()

      // Should throw on sync failure
      await expect(
        syncCommand.handler(context, { account: "plaid-1" }),
      ).rejects.toThrow("Sync failed")
    })
  })

  describe("unknown account type", () => {
    it("should not throw for gocardless account type", async () => {
      const account = createMockAccount({ id: "gocardless-1", type: "gocardless" })

      mockBillclawInstance.getAccounts.mockResolvedValue([account])
      mockBillclawInstance.syncAccount.mockResolvedValue({
        accountId: "gocardless-1",
        success: true,
        transactionsAdded: 0,
        transactionsUpdated: 0,
        errors: [],
      })

      const context = createMockCliContext()
      // Should NOT throw "Unknown account type" for gocardless
      await expect(
        syncCommand.handler(context, { account: "gocardless-1" }),
      ).resolves.not.toThrow()
    })

    it("should throw for unknown account type", async () => {
      const account = createMockAccount({ id: "unknown-1", type: "unknown" as any })

      mockBillclawInstance.getAccounts.mockResolvedValue([account])

      const context = createMockCliContext()

      // Should throw for unknown type
      await expect(
        syncCommand.handler(context, { account: "unknown-1" }),
      ).rejects.toThrow("Unknown account type")
    })
  })
})
