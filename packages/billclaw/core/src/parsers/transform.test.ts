/**
 * Tests for Transform Utility
 *
 * Note: We test transformParsedTransactions by creating mock RawTransaction
 * objects. Since Decimal is only a type export from @firela/parser-core,
 * we create mock objects that implement the Decimal interface (toNumber method).
 */

import { describe, it, expect } from "vitest"
import { transformParsedTransactions, type TransformOptions } from "./transform.js"
import type { RawTransaction } from "@firela/parser-core"

// Minimal Decimal-like type for testing
// This mimics the parts of the Decimal interface that transformParsedTransactions uses
interface MockDecimal {
  toNumber(): number
}

// Create a mock Decimal from a number or string
function mockDecimal(value: number | string): MockDecimal {
  const num = typeof value === "string" ? parseFloat(value) : value
  return {
    toNumber: () => num,
  }
}

describe("transformParsedTransactions", () => {
  // Helper to create mock raw transaction
  function createMockTransaction(overrides: Partial<RawTransaction<unknown>> = {}): RawTransaction<unknown> {
    return {
      date: new Date("2024-03-15"),
      amount: mockDecimal("-88.50") as unknown as RawTransaction["amount"],
      currency: "CNY",
      payee: "Test Merchant",
      description: "Test transaction description",
      category: undefined,
      metadata: { id: "test-txn-123" },
      ...overrides,
    }
  }

  const defaultOptions: TransformOptions = {
    accountId: "test-account-id",
    pending: false,
  }

  describe("basic transformation", () => {
    it("should transform single transaction", () => {
      const transactions = [createMockTransaction()]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result).toHaveLength(1)
      expect(result[0].account_id).toBe("test-account-id")
    })

    it("should transform multiple transactions", () => {
      const transactions = [
        createMockTransaction({ metadata: { id: "txn-1" } }),
        createMockTransaction({ metadata: { id: "txn-2" } }),
        createMockTransaction({ metadata: { id: "txn-3" } }),
      ]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result).toHaveLength(3)
    })
  })

  describe("field mapping", () => {
    it("should map amount correctly", () => {
      const transactions = [createMockTransaction({ amount: mockDecimal("-100.00") as unknown as RawTransaction["amount"] })]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result[0].amount).toBe(-100)
    })

    it("should map currency to iso_currency_code", () => {
      const transactions = [createMockTransaction({ currency: "USD" })]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result[0].iso_currency_code).toBe("USD")
    })

    it("should map date correctly", () => {
      const testDate = new Date("2024-01-15T10:30:00.000Z")
      const transactions = [createMockTransaction({ date: testDate })]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result[0].date).toBe("2024-01-15")
    })

    it("should map payee to merchant_name", () => {
      const transactions = [createMockTransaction({ payee: "Amazon" })]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result[0].merchant_name).toBe("Amazon")
    })

    it("should map description to name", () => {
      const transactions = [createMockTransaction({ description: "Test description" })]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result[0].name).toBe("Test description")
    })

    it("should fallback to payee for name when description is empty", () => {
      const transactions = [createMockTransaction({ description: "", payee: "Payee Name" })]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result[0].name).toBe("Payee Name")
    })

    it("should generate transaction_id from metadata.id", () => {
      const transactions = [createMockTransaction({ metadata: { id: "my-custom-id" } })]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result[0].transaction_id).toBe("my-custom-id")
    })
  })

  describe("account_id handling", () => {
    it("should use accountId from options", () => {
      const transactions = [createMockTransaction()]
      const options: TransformOptions = { accountId: "custom-account" }
      const result = transformParsedTransactions(transactions, options)

      expect(result[0].account_id).toBe("custom-account")
    })
  })

  describe("pending flag", () => {
    it("should set pending to false by default", () => {
      const transactions = [createMockTransaction()]
      const result = transformParsedTransactions(transactions, { accountId: "test" })

      expect(result[0].pending).toBe(false)
    })

    it("should respect pending option", () => {
      const transactions = [createMockTransaction()]
      const result = transformParsedTransactions(transactions, { accountId: "test", pending: true })

      expect(result[0].pending).toBe(true)
    })
  })

  describe("optional fields", () => {
    it("should set category to undefined", () => {
      const transactions = [createMockTransaction()]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result[0].category).toBeUndefined()
    })

    it("should set payment_channel to undefined", () => {
      const transactions = [createMockTransaction()]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result[0].payment_channel).toBeUndefined()
    })
  })

  describe("edge cases", () => {
    it("should handle empty transactions array", () => {
      const result = transformParsedTransactions([], defaultOptions)
      expect(result).toHaveLength(0)
    })

    it("should handle zero amount", () => {
      const transactions = [createMockTransaction({ amount: mockDecimal("0") as unknown as RawTransaction["amount"] })]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result[0].amount).toBe(0)
    })

    it("should handle very small amounts", () => {
      const transactions = [createMockTransaction({ amount: mockDecimal("0.01") as unknown as RawTransaction["amount"] })]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result[0].amount).toBe(0.01)
    })

    it("should handle very large amounts", () => {
      const transactions = [createMockTransaction({ amount: mockDecimal("9999999.99") as unknown as RawTransaction["amount"] })]
      const result = transformParsedTransactions(transactions, defaultOptions)

      expect(result[0].amount).toBe(9999999.99)
    })
  })
})
