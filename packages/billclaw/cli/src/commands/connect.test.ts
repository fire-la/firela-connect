/**
 * Tests for connect command
 *
 * Tests the unified connect command entry point and subcommand registration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { connectCommand, registerConnectSubcommands } from "./connect.js"
import { Command } from "commander"

// Mock the dynamic imports in action handlers
vi.mock("./connect/plaid.js", () => ({
  runPlaidConnect: vi.fn(),
}))

vi.mock("./connect/gmail.js", () => ({
  runGmailConnect: vi.fn(),
}))

vi.mock("./connect/status.js", () => ({
  runConnectStatus: vi.fn(),
}))

vi.mock("../runtime/context.js", () => ({
  createRuntimeContext: vi.fn(() => ({
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    config: {
      getConfig: vi.fn().mockResolvedValue({
        version: 1,
        accounts: [],
        storage: { path: "~/.firela/billclaw" },
      }),
    },
  })),
}))

describe("connect command", () => {
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
      expect(connectCommand.name).toBe("connect")
    })

    it("should have a description", () => {
      expect(connectCommand.description).toBeDefined()
      expect(connectCommand.description.length).toBeGreaterThan(0)
    })

    it("should have arguments defined", () => {
      expect(connectCommand.arguments).toBe("[provider]")
    })

    it("should have a handler function", () => {
      expect(connectCommand.handler).toBeDefined()
      expect(typeof connectCommand.handler).toBe("function")
    })
  })

  describe("subcommand registration", () => {
    it("should register plaid subcommand", () => {
      const program = new Command()
      registerConnectSubcommands(program)

      const connectCmd = program.commands.find((cmd) => cmd.name() === "connect")
      expect(connectCmd).toBeDefined()

      const plaidCmd = connectCmd?.commands.find((cmd) => cmd.name() === "plaid")
      expect(plaidCmd).toBeDefined()
      expect(plaidCmd?.description()).toContain("Plaid")
    })

    it("should register gmail subcommand", () => {
      const program = new Command()
      registerConnectSubcommands(program)

      const connectCmd = program.commands.find((cmd) => cmd.name() === "connect")
      const gmailCmd = connectCmd?.commands.find((cmd) => cmd.name() === "gmail")
      expect(gmailCmd).toBeDefined()
      expect(gmailCmd?.description()).toContain("Gmail")
    })

    it("should register status subcommand", () => {
      const program = new Command()
      registerConnectSubcommands(program)

      const connectCmd = program.commands.find((cmd) => cmd.name() === "connect")
      const statusCmd = connectCmd?.commands.find((cmd) => cmd.name() === "status")
      expect(statusCmd).toBeDefined()
      expect(statusCmd?.description()).toContain("status")
    })

    it("should have correct options for plaid subcommand", () => {
      const program = new Command()
      registerConnectSubcommands(program)

      const connectCmd = program.commands.find((cmd) => cmd.name() === "connect")
      const plaidCmd = connectCmd?.commands.find((cmd) => cmd.name() === "plaid")
      const options = plaidCmd?.options || []

      expect(options.some((opt) => opt.long === "--name")).toBe(true)
      expect(options.some((opt) => opt.long === "--timeout")).toBe(true)
    })

    it("should have correct options for gmail subcommand", () => {
      const program = new Command()
      registerConnectSubcommands(program)

      const connectCmd = program.commands.find((cmd) => cmd.name() === "connect")
      const gmailCmd = connectCmd?.commands.find((cmd) => cmd.name() === "gmail")
      const options = gmailCmd?.options || []

      expect(options.some((opt) => opt.long === "--email")).toBe(true)
      expect(options.some((opt) => opt.long === "--timeout")).toBe(true)
    })
  })

  describe("handler", () => {
    it("should execute without error", async () => {
      const mockContext = {
        runtime: {
          logger: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
          },
          config: {
            getConfig: vi.fn().mockResolvedValue({
              version: 1,
              accounts: [],
            }),
          },
        },
        program: new Command(),
      }

      // Handler should not throw
      await expect(connectCommand.handler(mockContext as any)).resolves.toBeUndefined()
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
