/**
 * Tests for setup command
 *
 * Tests the interactive setup wizard for connecting accounts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { setupCommand } from "./setup.js"
import { createMockCliContext } from "../__tests__/test-utils.js"

// Mock inquirer
vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn(),
  },
}))

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

// Mock @firela/billclaw-core/errors - must use factory function without external refs
vi.mock("@firela/billclaw-core/errors", () => ({
  parseWebhookError: vi.fn((err) => ({
    type: "UserError",
    errorCode: "WEBHOOK_SETUP_FAILED",
    category: "webhook",
    severity: "error",
    recoverable: true,
    humanReadable: {
      title: "Webhook Setup Failed",
      message: String(err),
      suggestions: ["Try again"],
    },
  })),
  logError: vi.fn(),
  formatError: vi.fn((err) => err.humanReadable?.title || "Error"),
}))

// Mock @firela/billclaw-core/webhook - must use factory function without external refs
vi.mock("@firela/billclaw-core/webhook", () => ({
  setupWebhookReceiver: vi.fn().mockResolvedValue({
    success: true,
    config: { mode: "auto" },
  }),
}))

// Mock @firela/billclaw-core - must use factory function without external refs
vi.mock("@firela/billclaw-core", () => ({
  readAccountRegistry: vi.fn().mockResolvedValue([]),
  writeAccountRegistry: vi.fn().mockResolvedValue(undefined),
  getStorageDir: vi.fn().mockResolvedValue("/tmp/test-storage"),
  updateConfig: vi.fn().mockResolvedValue(undefined),
}))

import inquirer from "inquirer"
import * as fs from "node:fs/promises"
import {
  readAccountRegistry,
  writeAccountRegistry,
  getStorageDir,
} from "@firela/billclaw-core"
import { setupWebhookReceiver } from "@firela/billclaw-core/webhook"

describe("setup command", () => {
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
      expect(setupCommand.name).toBe("setup")
    })

    it("should have a description", () => {
      expect(setupCommand.description).toBeDefined()
      expect(setupCommand.description.length).toBeGreaterThan(0)
    })

    it("should have aliases", () => {
      expect(setupCommand.aliases).toContain("init")
    })

    it("should have a handler function", () => {
      expect(setupCommand.handler).toBeDefined()
      expect(typeof setupCommand.handler).toBe("function")
    })
  })

  describe("plaid setup", () => {
    it("should setup plaid account with valid inputs", async () => {
      // Mock inquirer to select plaid and provide credentials
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({
          accountType: "plaid",
        })
        .mockResolvedValueOnce({
          clientId: "test-client-id",
          secret: "test-secret",
          environment: "sandbox",
        })

      vi.mocked(readAccountRegistry).mockResolvedValueOnce([])
      vi.mocked(writeAccountRegistry).mockResolvedValueOnce(undefined)
      vi.mocked(getStorageDir).mockResolvedValueOnce("/tmp/test-storage")
      vi.mocked(fs.mkdir).mockResolvedValueOnce(undefined)
      vi.mocked(fs.writeFile).mockResolvedValueOnce(undefined)

      const context = createMockCliContext()
      await setupCommand.handler(context)

      // Verify account registry was updated
      expect(writeAccountRegistry).toHaveBeenCalled()
      const registryCall = vi.mocked(writeAccountRegistry).mock.calls[0]
      expect(registryCall[0]).toHaveLength(1)
      expect(registryCall[0][0].type).toBe("plaid")

      // Verify credentials file was written
      expect(fs.writeFile).toHaveBeenCalled()
    })

    it("should append to existing accounts", async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({
          accountType: "plaid",
        })
        .mockResolvedValueOnce({
          clientId: "test-client-id",
          secret: "test-secret",
          environment: "sandbox",
        })

      vi.mocked(readAccountRegistry).mockResolvedValueOnce([
        { id: "existing-1", type: "plaid", name: "Existing", createdAt: "2024-01-01" },
      ])
      vi.mocked(writeAccountRegistry).mockResolvedValueOnce(undefined)
      vi.mocked(getStorageDir).mockResolvedValueOnce("/tmp/test-storage")
      vi.mocked(fs.mkdir).mockResolvedValueOnce(undefined)
      vi.mocked(fs.writeFile).mockResolvedValueOnce(undefined)

      const context = createMockCliContext()
      await setupCommand.handler(context)

      const registryCall = vi.mocked(writeAccountRegistry).mock.calls[0]
      expect(registryCall[0]).toHaveLength(2)
    })
  })

  describe("gmail setup", () => {
    it("should inform user to use connect command for relay-only mode", async () => {
      vi.mocked(inquirer.prompt).mockResolvedValueOnce({
        accountType: "gmail",
      })

      const context = createMockCliContext()
      await setupCommand.handler(context)

      // Gmail setup no longer writes account files (relay-only mode)
      expect(writeAccountRegistry).not.toHaveBeenCalled()
    })
  })

  describe("gocardless setup", () => {
    it("should setup gocardless account with valid inputs", async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({
          accountType: "gocardless",
        })
        .mockResolvedValueOnce({
          clientId: "test-client-id",
          secret: "test-secret",
          environment: "sandbox",
        })

      vi.mocked(readAccountRegistry).mockResolvedValueOnce([])
      vi.mocked(writeAccountRegistry).mockResolvedValueOnce(undefined)
      vi.mocked(getStorageDir).mockResolvedValueOnce("/tmp/test-storage")
      vi.mocked(fs.mkdir).mockResolvedValueOnce(undefined)
      vi.mocked(fs.writeFile).mockResolvedValueOnce(undefined)

      const context = createMockCliContext()
      await setupCommand.handler(context)

      expect(writeAccountRegistry).toHaveBeenCalled()
      const registryCall = vi.mocked(writeAccountRegistry).mock.calls[0]
      expect(registryCall[0][0].type).toBe("gocardless")
    })
  })

  describe("webhook setup", () => {
    it("should setup webhook in auto mode", async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({
          accountType: "webhook",
        })
        .mockResolvedValueOnce({
          enableWebhook: true,
          mode: "auto",
        })

      vi.mocked(setupWebhookReceiver).mockResolvedValueOnce({
        success: true,
        config: { mode: "auto" },
      })

      const context = createMockCliContext()
      await setupCommand.handler(context)

      expect(setupWebhookReceiver).toHaveBeenCalled()
    })

    it("should handle webhook disabled", async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({
          accountType: "webhook",
        })
        .mockResolvedValueOnce({
          enableWebhook: false,
        })

      const context = createMockCliContext()
      await setupCommand.handler(context)

      // Should not call setupWebhookReceiver when disabled
      expect(setupWebhookReceiver).not.toHaveBeenCalled()
    })
  })

  describe("error handling", () => {
    it("should handle file system errors gracefully", async () => {
      vi.mocked(inquirer.prompt)
        .mockResolvedValueOnce({
          accountType: "plaid",
        })
        .mockResolvedValueOnce({
          clientId: "test-client-id",
          secret: "test-secret",
          environment: "sandbox",
        })

      vi.mocked(readAccountRegistry).mockRejectedValueOnce(new Error("FS error"))

      const context = createMockCliContext()

      // The command should throw on error
      await expect(setupCommand.handler(context)).rejects.toThrow()
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
