/**
 * Tests for Import command
 *
 * @module @firela/billclaw-cli
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { importCommand } from "./import.js"
import type { CliRuntimeContext } from "../runtime/context.js"

// Mock dependencies
vi.mock("node:fs")
vi.mock("../utils/progress.js")
vi.mock("../utils/format.js")
vi.mock("@firela/billclaw-core")

describe("importCommand", () => {
  describe("command definition", () => {
    it("should have correct name", () => {
      expect(importCommand.name).toBe("import")
    })

    it("should have description", () => {
      expect(importCommand.description).toBeDefined()
      expect(importCommand.description.length).toBeGreaterThan(0)
    })

    it("should have file argument", () => {
      expect(importCommand.arguments).toBe("<file>")
    })

    it("should have expected options", () => {
      const optionFlags = importCommand.options?.map((o) => o.flags) || []
      expect(optionFlags).toContain("-p, --parser <name>")
      expect(optionFlags).toContain("-a, --account <id>")
      expect(optionFlags).toContain("-d, --dry-run")
    })

    it("should have handler function", () => {
      expect(importCommand.handler).toBeDefined()
      expect(typeof importCommand.handler).toBe("function")
    })
  })
})

describe("runImport", () => {
  let mockContext: { runtime: CliRuntimeContext; program: unknown }
  let mockRuntime: Partial<CliRuntimeContext>

  beforeEach(() => {
    vi.clearAllMocks()

    mockRuntime = {
      config: {
        getConfig: vi.fn().mockResolvedValue({
          ign: {
            accessToken: "test-token",
            apiUrl: "http://localhost:3000",
            region: "us",
            upload: {
              sourceAccount: "Assets:Bank",
              defaultCurrency: "USD",
              defaultExpenseAccount: "Expenses:Unknown",
              defaultIncomeAccount: "Income:Unknown",
            },
          },
        }),
        getStorageConfig: vi.fn().mockResolvedValue({ storagePath: "/tmp/test" }),
      },
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }

    mockContext = {
      runtime: mockRuntime as CliRuntimeContext,
      program: {} as unknown,
    }
  })

  it("should validate command structure", () => {
    // Check command structure is correct
    expect(importCommand).toMatchObject({
      name: "import",
      description: expect.any(String),
      arguments: "<file>",
      options: expect.arrayContaining([
        expect.objectContaining({ flags: expect.stringContaining("parser") }),
        expect.objectContaining({ flags: expect.stringContaining("account") }),
        expect.objectContaining({ flags: expect.stringContaining("dry-run") }),
      ]),
      handler: expect.any(Function),
    })
  })

  it("should have correct option descriptions", () => {
    const parserOption = importCommand.options?.find((o) => o.flags.includes("parser"))
    expect(parserOption?.description).toContain("auto-detect")

    const accountOption = importCommand.options?.find((o) => o.flags.includes("account"))
    expect(accountOption?.description).toContain("account")

    const dryRunOption = importCommand.options?.find((o) => o.flags.includes("dry-run"))
    expect(dryRunOption?.description).toContain("upload")
  })
})
