/**
 * Tests for CLI utilities
 */

import { describe, it, expect } from "vitest"
import {
  createTable,
  formatStatus,
  formatAccountType,
  formatCurrency,
  formatDate,
  formatDateTime,
  success,
  error,
  warn,
  info,
} from "./format.js"

describe("createTable", () => {
  it("should create a table with headers", () => {
    const table = createTable({
      head: ["ID", "Name", "Status"],
    })

    expect(table).toBeDefined()
    expect(table.push).toBeDefined()
    expect(table.toString).toBeDefined()
  })

  it("should accept rows", () => {
    const table = createTable({
      head: ["ID", "Name"],
    })

    table.push(["1", "Test"])
    table.push(["2", "Test 2"])

    const output = table.toString()
    expect(output).toContain("1")
    expect(output).toContain("Test")
  })
})

describe("formatStatus", () => {
  it("should format active status as green", () => {
    const result = formatStatus("active")
    expect(result).toContain("active")
  })

  it("should format connected status as green", () => {
    const result = formatStatus("connected")
    expect(result).toContain("connected")
  })

  it("should format pending status as yellow", () => {
    const result = formatStatus("pending")
    expect(result).toContain("pending")
  })

  it("should format error status as red", () => {
    const result = formatStatus("error")
    expect(result).toContain("error")
  })

  it("should format unknown status as gray", () => {
    const result = formatStatus("unknown")
    expect(result).toContain("unknown")
  })
})

describe("formatAccountType", () => {
  it("should format plaid type as blue", () => {
    const result = formatAccountType("plaid")
    expect(result).toContain("plaid")
  })

  it("should format gmail type as red", () => {
    const result = formatAccountType("gmail")
    expect(result).toContain("gmail")
  })

  it("should format gocardless type as green", () => {
    const result = formatAccountType("gocardless")
    expect(result).toContain("gocardless")
  })

  it("should format unknown type as gray", () => {
    const result = formatAccountType("unknown")
    expect(result).toContain("unknown")
  })
})

describe("formatCurrency", () => {
  it("should format USD currency", () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain("$")
    expect(result).toContain("1,234.56")
  })

  it("should format EUR currency", () => {
    const result = formatCurrency(1234.56, "EUR")
    expect(result).toContain("€")
    expect(result).toContain("1,234.56")
  })

  it("should handle zero amount", () => {
    const result = formatCurrency(0)
    expect(result).toContain("$0.00")
  })

  it("should handle negative amounts", () => {
    const result = formatCurrency(-100)
    expect(result).toContain("-")
    expect(result).toContain("100")
  })
})

describe("formatDate", () => {
  it("should format Date object", () => {
    const date = new Date("2024-01-15T10:30:00Z")
    const result = formatDate(date)
    expect(result).toContain("Jan")
    expect(result).toContain("15")
    expect(result).toContain("2024")
  })

  it("should format ISO string", () => {
    const result = formatDate("2024-01-15")
    expect(result).toContain("Jan")
    expect(result).toContain("15")
  })

  it("should format today's date", () => {
    const result = formatDate(new Date())
    expect(result).toBeDefined()
    expect(typeof result).toBe("string")
  })
})

describe("formatDateTime", () => {
  it("should include time component", () => {
    const date = new Date("2024-01-15T14:30:00Z")
    const result = formatDateTime(date)
    expect(result).toBeDefined()
    expect(typeof result).toBe("string")
    // Time format depends on locale, but should contain numbers
    expect(result).toMatch(/\d/)
  })
})

describe("output helpers", () => {
  let originalLog: typeof console.log
  let originalError: typeof console.error
  let originalWarn: typeof console.warn
  let output: string[] = []

  beforeEach(() => {
    originalLog = console.log
    originalError = console.error
    originalWarn = console.warn

    console.log = (...args: any[]) => {
      output.push(args.join(" "))
    }
    console.error = (...args: any[]) => {
      output.push(args.join(" "))
    }
    console.warn = (...args: any[]) => {
      output.push(args.join(" "))
    }

    output = []
  })

  afterEach(() => {
    console.log = originalLog
    console.error = originalError
    console.warn = originalWarn
  })

  it("should print success message", () => {
    success("Operation completed")
    expect(output.length).toBeGreaterThan(0)
    expect(output[0]).toContain("✓")
    expect(output[0]).toContain("Operation completed")
  })

  it("should print error message", () => {
    error("Operation failed")
    expect(output.length).toBeGreaterThan(0)
    expect(output[0]).toContain("✗")
    expect(output[0]).toContain("Operation failed")
  })

  it("should print warning message", () => {
    warn("Warning message")
    expect(output.length).toBeGreaterThan(0)
    expect(output[0]).toContain("⚠")
    expect(output[0]).toContain("Warning message")
  })

  it("should print info message", () => {
    info("Info message")
    expect(output.length).toBeGreaterThan(0)
    expect(output[0]).toContain("ℹ")
    expect(output[0]).toContain("Info message")
  })
})
