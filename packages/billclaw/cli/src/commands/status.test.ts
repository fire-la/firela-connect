/**
 * Tests for status command
 *
 * Tests the status command that displays account and sync information.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { statusCommand } from "./status.js"
import {
  createMockCliContext,
} from "../__tests__/test-utils.js"

// Mock @firela/billclaw-core
vi.mock("@firela/billclaw-core", () => ({
  Billclaw: vi.fn().mockImplementation(() => ({
    getAccounts: vi.fn().mockResolvedValue([]),
    getSyncStates: vi.fn().mockResolvedValue([]),
  })),
  getStorageDir: vi.fn().mockResolvedValue("/tmp/test-storage"),
}))

// Mock node:fs/promises
vi.mock("node:fs/promises", () => ({
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ size: 1024 }),
  readFile: vi.fn().mockResolvedValue("[]"),
}))

// Mock node:path
vi.mock("node:path", () => ({
  join: vi.fn((...args) => args.join("/")),
}))

import { Billclaw } from "@firela/billclaw-core"

describe("status command", () => {
  let mockConsole: {
    output: string[]
    restore: () => void
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockConsole = captureConsole()
  })

  afterEach(() => {
    mockConsole.restore()
    vi.restoreAllMocks()
  })

  describe("command definition", () => {
    it("should have correct command name", () => {
      expect(statusCommand.name).toBe("status")
    })

    it("should have a description", () => {
      expect(statusCommand.description).toBeDefined()
      expect(statusCommand.description.length).toBeGreaterThan(0)
    })

    it("should have a handler function", () => {
      expect(statusCommand.handler).toBeDefined()
      expect(typeof statusCommand.handler).toBe("function")
    })
  })

  describe("no accounts configured", () => {
    it("should display message when no accounts are configured", async () => {
      const mockBillclaw = {
        getAccounts: vi.fn().mockResolvedValue([]),
        getSyncStates: vi.fn().mockResolvedValue([]),
      }
      vi.mocked(Billclaw).mockImplementation(() => mockBillclaw as any)

      const context = createMockCliContext()
      await statusCommand.handler(context)

      expect(mockConsole.output.some((line) => line.includes("No accounts configured"))).toBe(true)
    })

    it("should suggest running setup when no accounts exist", async () => {
      const mockBillclaw = {
        getAccounts: vi.fn().mockResolvedValue([]),
        getSyncStates: vi.fn().mockResolvedValue([]),
      }
      vi.mocked(Billclaw).mockImplementation(() => mockBillclaw as any)

      const context = createMockCliContext()
      await statusCommand.handler(context)

      expect(mockConsole.output.some((line) => line.includes("setup"))).toBe(true)
    })
  })

  describe("with configured accounts", () => {
    it("should display account information", async () => {
      const mockBillclaw = {
        getAccounts: vi.fn().mockResolvedValue([
          {
            id: "plaid-123",
            type: "plaid",
            name: "TestBank",
            enabled: true,
            lastSync: "2024-01-15T10:00:00Z",
            lastStatus: "success",
          },
        ]),
        getSyncStates: vi.fn().mockResolvedValue([]),
      }
      vi.mocked(Billclaw).mockImplementation(() => mockBillclaw as any)

      const context = createMockCliContext()
      await statusCommand.handler(context)

      // Should display account ID in the accounts table
      expect(mockConsole.output.some((line) => line.includes("plaid-123"))).toBe(true)
    })

    it("should display storage statistics", async () => {
      const mockBillclaw = {
        getAccounts: vi.fn().mockResolvedValue([
          {
            id: "plaid-123",
            type: "plaid",
            name: "Test Bank",
            enabled: true,
          },
        ]),
        getSyncStates: vi.fn().mockResolvedValue([]),
      }
      vi.mocked(Billclaw).mockImplementation(() => mockBillclaw as any)

      const context = createMockCliContext()
      await statusCommand.handler(context)

      expect(mockConsole.output.some((line) => line.includes("Storage Statistics"))).toBe(true)
    })

    it("should display summary with enabled/disabled counts", async () => {
      const mockBillclaw = {
        getAccounts: vi.fn().mockResolvedValue([
          { id: "acc-1", type: "plaid", name: "Active", enabled: true },
          { id: "acc-2", type: "gmail", name: "Inactive", enabled: false },
        ]),
        getSyncStates: vi.fn().mockResolvedValue([]),
      }
      vi.mocked(Billclaw).mockImplementation(() => mockBillclaw as any)

      const context = createMockCliContext()
      await statusCommand.handler(context)

      expect(mockConsole.output.some((line) => line.includes("Total accounts: 2"))).toBe(true)
      expect(mockConsole.output.some((line) => line.includes("Enabled: 1"))).toBe(true)
      expect(mockConsole.output.some((line) => line.includes("Disabled: 1"))).toBe(true)
    })

    it("should show warning for accounts requiring re-auth", async () => {
      const mockBillclaw = {
        getAccounts: vi.fn().mockResolvedValue([
          {
            id: "acc-1",
            type: "plaid",
            name: "Needs Auth",
            enabled: true,
            requiresReauth: true,
          },
        ]),
        getSyncStates: vi.fn().mockResolvedValue([]),
      }
      vi.mocked(Billclaw).mockImplementation(() => mockBillclaw as any)

      const context = createMockCliContext()
      await statusCommand.handler(context)

      expect(
        mockConsole.output.some((line) => line.includes("re-auth")),
      ).toBe(true)
    })
  })

  describe("sync history", () => {
    it("should display recent sync results", async () => {
      const mockBillclaw = {
        getAccounts: vi.fn().mockResolvedValue([
          { id: "acc-1", type: "plaid", name: "Test" },
        ]),
        getSyncStates: vi.fn().mockResolvedValue([
          {
            id: "sync-1",
            accountId: "acc-1",
            startedAt: "2024-01-15T10:00:00Z",
            completedAt: "2024-01-15T10:05:00Z",
            status: "completed",
            transactionsAdded: 10,
            transactionsUpdated: 5,
          },
        ]),
      }
      vi.mocked(Billclaw).mockImplementation(() => mockBillclaw as any)

      const context = createMockCliContext()
      await statusCommand.handler(context)

      expect(mockConsole.output.some((line) => line.includes("Recent Sync Results"))).toBe(true)
    })

    it("should show message when no sync history exists", async () => {
      const mockBillclaw = {
        getAccounts: vi.fn().mockResolvedValue([
          { id: "acc-1", type: "plaid", name: "Test" },
        ]),
        getSyncStates: vi.fn().mockResolvedValue([]),
      }
      vi.mocked(Billclaw).mockImplementation(() => mockBillclaw as any)

      const context = createMockCliContext()
      await statusCommand.handler(context)

      expect(
        mockConsole.output.some((line) => line.includes("No sync history")),
      ).toBe(true)
    })
  })
})

/**
 * Helper to capture console output
 */
function captureConsole() {
  const output: string[] = []
  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn

  console.log = (...args: unknown[]) => {
    output.push(args.join(" "))
  }
  console.error = (...args: unknown[]) => {
    output.push(args.join(" "))
  }
  console.warn = (...args: unknown[]) => {
    output.push(args.join(" "))
  }

  return {
    output,
    restore: () => {
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
    },
  }
}
