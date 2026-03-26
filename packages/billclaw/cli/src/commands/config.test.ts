/**
 * Tests for config command
 *
 * Tests the config command for managing plugin configuration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { configCommand } from "./config.js"
import {
  createMockCliContext,
  MockConfigProvider,
} from "../__tests__/test-utils.js"
import type { BillclawConfig } from "@firela/billclaw-core"

// Mock relay-config utilities
vi.mock("../utils/relay-config.js", () => ({
  validateRelayConnection: vi.fn(),
  classifyRelayError: vi.fn(),
  STARTUP_HEALTH_CHECK_TIMEOUT: 3000,
}))

import {
  validateRelayConnection,
  classifyRelayError
} from "../utils/relay-config.js"

/**
 * Create a mock CliContext with saveConfig support for config tests
 */
function createMockCliContextWithSave(configOverrides?: Partial<BillclawConfig>) {
  const config = new MockConfigProvider(configOverrides)
  // Add saveConfig method to the mock
  ;(config as any).saveConfig = vi.fn().mockResolvedValue(undefined)

  return {
    runtime: {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
      config: config as any,
    },
    program: {
      commands: [],
    } as any,
  }
}

describe("config command", () => {
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
      expect(configCommand.name).toBe("config")
    })

    it("should have a description", () => {
      expect(configCommand.description).toBeDefined()
      expect(configCommand.description.length).toBeGreaterThan(0)
    })

    it("should have options defined", () => {
      expect(configCommand.options).toBeDefined()
      expect(configCommand.options?.length).toBeGreaterThan(0)
    })

    it("should have list option", () => {
      const listOption = configCommand.options?.find((opt) =>
        opt.flags.includes("--list"),
      )
      expect(listOption).toBeDefined()
    })

    it("should have key option", () => {
      const keyOption = configCommand.options?.find((opt) =>
        opt.flags.includes("--key"),
      )
      expect(keyOption).toBeDefined()
    })

    it("should have value option", () => {
      const valueOption = configCommand.options?.find((opt) =>
        opt.flags.includes("--value"),
      )
      expect(valueOption).toBeDefined()
    })

    it("should have a handler function", () => {
      expect(configCommand.handler).toBeDefined()
      expect(typeof configCommand.handler).toBe("function")
    })
  })

  describe("list config", () => {
    it("should list all config when list flag is true", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
        sync: {
          defaultFrequency: "daily",
          retryOnFailure: true,
          maxRetries: 3,
        },
      }

      const context = createMockCliContext(config)
      await configCommand.handler(context, { list: true })

      // Should output JSON
      expect(mockConsole.output.some((line) => line.includes("version"))).toBe(true)
    })

    it("should list all config when no args provided", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
      }

      const context = createMockCliContext(config)
      await configCommand.handler(context, {})

      expect(mockConsole.output.some((line) => line.includes("version"))).toBe(true)
    })
  })

  describe("get config", () => {
    it("should get a top-level config value", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
      }

      const context = createMockCliContext(config)
      await configCommand.handler(context, { key: "version" })

      expect(mockConsole.output.some((line) => line.includes("1"))).toBe(true)
    })

    it("should get a nested config value using dot notation", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
      }

      const context = createMockCliContext(config)
      await configCommand.handler(context, { key: "storage.path" })

      expect(
        mockConsole.output.some((line) => line.includes("~/.firela/billclaw")),
      ).toBe(true)
    })

    it("should display message for non-existent key", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
      }

      const context = createMockCliContext(config)
      await configCommand.handler(context, { key: "nonexistent.key" })

      expect(
        mockConsole.output.some((line) => line.includes("not found")),
      ).toBe(true)
    })

    it("should display object as JSON for nested values", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
      }

      const context = createMockCliContext(config)
      await configCommand.handler(context, { key: "storage.encryption" })

      expect(
        mockConsole.output.some((line) => line.includes("enabled")),
      ).toBe(true)
    })
  })

  describe("set config", () => {
    it("should set a config value", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
      }

      const context = createMockCliContextWithSave(config)
      await configCommand.handler(context, { key: "sync.defaultFrequency", value: "hourly" })

      expect(
        mockConsole.output.some((line) => line.includes("updated")),
      ).toBe(true)
    })

    it("should parse JSON values", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
      }

      const context = createMockCliContextWithSave(config)
      await configCommand.handler(context, { key: "sync.maxRetries", value: "5" })

      // Should parse "5" as number 5
      expect(
        mockConsole.output.some((line) => line.includes("updated")),
      ).toBe(true)
    })

    it("should handle string values", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
      }

      const context = createMockCliContextWithSave(config)
      await configCommand.handler(context, { key: "storage.path", value: "/custom/path" })

      expect(
        mockConsole.output.some((line) => line.includes("updated")),
      ).toBe(true)
    })

    it("should create nested objects if they don't exist", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
      }

      const context = createMockCliContextWithSave(config)
      await configCommand.handler(context, { key: "custom.nested.value", value: "test" })

      expect(
        mockConsole.output.some((line) => line.includes("updated")),
      ).toBe(true)
    })
  })

  describe("handler", () => {
    it("should call handler with correct args", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
      }

      const context = createMockCliContext(config)
      await configCommand.handler(context, { list: true })

      expect(mockConsole.output.some((line) => line.includes("version"))).toBe(true)
    })
  })

  describe("relay configuration display", () => {
    it("should display Relay Configuration section when list is true", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
      }

      vi.mocked(validateRelayConnection).mockResolvedValue({
        available: false,
        error: "Not configured",
      })

      const context = createMockCliContext(config)
      await configCommand.handler(context, { list: true })

      expect(mockConsole.output.some((line) => line.includes("Relay Configuration"))).toBe(true)
    })

    it("should display Not configured when no relay set", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
      }

      vi.mocked(validateRelayConnection).mockResolvedValue({
        available: false,
        error: "Not configured",
      })

      const context = createMockCliContext(config)
      await configCommand.handler(context, { list: true })

      expect(mockConsole.output.some((line) => line.includes("Not configured"))).toBe(true)
    })

    it("should display relay URL and masked API key when configured", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
        relay: {
          url: "https://relay.firela.io",
          apiKey: "test-api-key-12345678",
          timeout: 30000,
          maxRetries: 3,
        },
      }

      vi.mocked(validateRelayConnection).mockResolvedValue({
        available: true,
        latency: 150,
      })

      const context = createMockCliContext(config)
      await configCommand.handler(context, { list: true })

      // Check URL is displayed
      expect(mockConsole.output.some((line) => line.includes("https://relay.firela.io"))).toBe(true)
      // Check API key is masked (showing first 4 and last 4 chars)
      expect(mockConsole.output.some((line) => line.includes("test..."))).toBe(true)
    })

    it("should display Connected status when health check passes", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
        relay: {
          url: "https://relay.firela.io",
          apiKey: "test-api-key",
          timeout: 30000,
          maxRetries: 3,
        },
      }

      vi.mocked(validateRelayConnection).mockResolvedValue({
        available: true,
        latency: 150,
      })

      const context = createMockCliContext(config)
      await configCommand.handler(context, { list: true })

      expect(mockConsole.output.some((line) => line.includes("Connected"))).toBe(true)
    })

    it("should display Failed status with error guidance when health check fails", async () => {
      const config: BillclawConfig = {
        version: 1,
        accounts: [],
        webhooks: [],
        storage: {
          path: "~/.firela/billclaw",
          format: "json",
          encryption: { enabled: false },
        },
        relay: {
          url: "https://invalid.relay.io",
          apiKey: "invalid-key",
          timeout: 30000,
          maxRetries: 3,
        },
      }

      vi.mocked(validateRelayConnection).mockResolvedValue({
        available: false,
        error: "Connection refused",
      })
      vi.mocked(classifyRelayError).mockReturnValue({
        category: "network",
        message: "Connection failed: Connection refused",
        action: "Check your network connection",
      })

      const context = createMockCliContext(config)
      await configCommand.handler(context, { list: true })

      expect(classifyRelayError).toHaveBeenCalled()
      expect(mockConsole.output.some((line) => line.includes("Failed"))).toBe(true)
    })

    it("should have --verbose option", () => {
      const verboseOption = configCommand.options?.find((opt) =>
        opt.flags.includes("--verbose"),
      )
      expect(verboseOption).toBeDefined()
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
