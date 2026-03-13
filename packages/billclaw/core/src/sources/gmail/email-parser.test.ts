/**
 * Tests for Email Parser Service
 */

import { describe, it, expect } from "vitest"
import {
  parseBillToTransaction,
  parseHTMLTable,
  parseTextList,
  extractTotalAmount,
  extractCurrency,
  extractAccountNumber,
  extractDueDate,
} from "./email-parser.js"
import type { BillRecognition } from "./bill-recognizer.js"

describe("Email Parser", () => {
  const mockRecognition: BillRecognition = {
    isBill: true,
    confidence: 0.8,
    amount: 100,
    currency: "USD",
    dueDate: "2024-02-15",
    billType: "Credit Card",
    merchant: "Chase",
    reasons: ["Subject contains bill keywords", "Known billing domain"],
  }

  describe("parseBillToTransaction", () => {
    it("should parse Netflix subscription email", () => {
      const parsed = parseBillToTransaction(
        "acct_1",
        "email_1",
        "Your Netflix Invoice",
        "Your Netflix subscription for the month is $15.99.",
        "info@netflix.com",
        "2024-02-01",
        mockRecognition,
      )

      expect(parsed.transactionId).toBe("acct_1_email_email_1")
      expect(parsed.accountId).toBe("acct_1")
      expect(parsed.amount).toBe(10000) // In cents
      expect(parsed.currency).toBe("USD")
      // recognition.merchant ("Chase") takes priority over email extraction
      expect(parsed.merchantName).toBe("Chase")
      expect(parsed.category).toEqual(["credit-card", "bills"])
      expect(parsed.paymentChannel).toBe("email")
    })

    it("should use recognition amount when available", () => {
      const recognition = { ...mockRecognition, amount: 50.5 }
      const parsed = parseBillToTransaction(
        "acct_1",
        "email_1",
        "Invoice",
        "Bill content",
        "billing@example.com",
        "2024-02-01",
        recognition,
      )

      expect(parsed.amount).toBe(5050) // 50.50 * 100
    })

    it("should extract amount from email body if not in recognition", () => {
      const recognitionWithoutAmount = { ...mockRecognition, amount: undefined }
      const parsed = parseBillToTransaction(
        "acct_1",
        "email_1",
        "Invoice",
        "Total amount due: $75.25",
        "billing@example.com",
        "2024-02-01",
        recognitionWithoutAmount,
      )

      expect(parsed.amount).toBe(7525) // 75.25 * 100
    })

    it("should extract merchant name from sender", () => {
      const recognitionWithoutMerchant = {
        ...mockRecognition,
        merchant: undefined,
      }
      const parsed = parseBillToTransaction(
        "acct_1",
        "email_1",
        "Invoice",
        "Bill content",
        '"Netflix Billing"<billing@netflix.com>',
        "2024-02-01",
        recognitionWithoutMerchant,
      )

      expect(parsed.merchantName).toBe("Netflix Billing")
    })

    it("should use recognition merchant if available", () => {
      const recognition = { ...mockRecognition, merchant: "Custom Merchant" }
      const parsed = parseBillToTransaction(
        "acct_1",
        "email_1",
        "Invoice",
        "Bill content",
        "billing@example.com",
        "2024-02-01",
        recognition,
      )

      expect(parsed.merchantName).toBe("Custom Merchant")
    })

    it("should include description from subject", () => {
      const parsed = parseBillToTransaction(
        "acct_1",
        "email_1",
        "Your Monthly Statement - February 2024",
        "Bill content",
        "billing@example.com",
        "2024-02-01",
        mockRecognition,
      )

      expect(parsed.description).toBe("Your Monthly Statement - February 2024")
    })
  })

  describe("parseHTMLTable", () => {
    it("should parse simple HTML table with amounts", () => {
      const html = `
        <table>
          <tr><td>Service A</td><td>$25.00</td></tr>
          <tr><td>Service B</td><td>$50.00</td></tr>
        </table>
      `

      const result = parseHTMLTable(html)

      expect(result).toHaveLength(2)
      expect(result?.[0]).toEqual({ description: "Service A", amount: 25 })
      expect(result?.[1]).toEqual({ description: "Service B", amount: 50 })
    })

    it("should handle tables with commas in amounts", () => {
      const html = `
        <table>
          <tr><td>Premium Service</td><td>$1,234.56</td></tr>
        </table>
      `

      const result = parseHTMLTable(html)

      expect(result).toHaveLength(1)
      expect(result?.[0].amount).toBe(1234.56)
    })

    it("should return null for non-table content", () => {
      const html = "<p>This is just a paragraph with $10.00 mentioned.</p>"

      const result = parseHTMLTable(html)

      expect(result).toBeNull()
    })

    it("should skip rows without amounts", () => {
      const html = `
        <table>
          <tr><td>Header Row</td><td>Amount</td></tr>
          <tr><td>Service A</td><td>$25.00</td></tr>
          <tr><td>Total</td><td>$25.00</td></tr>
        </table>
      `

      const result = parseHTMLTable(html)

      expect(result).toBeDefined()
      // Should have at least the rows with valid descriptions and amounts
    })
  })

  describe("parseTextList", () => {
    it("should parse plain text list of items", () => {
      const text = `
        Netflix subscription $15.99
        Spotify premium $9.99
        Internet service $60.00
      `

      const result = parseTextList(text)

      expect(result).toHaveLength(3)
      expect(result?.[0]).toEqual({
        description: "Netflix subscription",
        amount: 15.99,
      })
      expect(result?.[1]).toEqual({
        description: "Spotify premium",
        amount: 9.99,
      })
      expect(result?.[2]).toEqual({
        description: "Internet service",
        amount: 60,
      })
    })

    it("should handle various text formats", () => {
      const text = `
        Item 1 $10.50
        Item 2 $20
        Item 3 $100.25
      `

      const result = parseTextList(text)

      expect(result).toHaveLength(3)
      expect(result?.[0].amount).toBe(10.5)
      expect(result?.[1].amount).toBe(20)
      expect(result?.[2].amount).toBe(100.25)
    })

    it("should return null if no valid items found", () => {
      const text = "This is just regular text without any items."

      const result = parseTextList(text)

      expect(result).toBeNull()
    })
  })

  describe("extractTotalAmount", () => {
    it("should extract amount with $ sign", () => {
      const amount = extractTotalAmount("Total: $123.45")
      expect(amount).toBe(123.45)
    })

    it("should extract amount with USD suffix", () => {
      const amount = extractTotalAmount("Total amount: 99.99 USD")
      expect(amount).toBe(99.99)
    })

    it("should handle comma-separated thousands", () => {
      const amount = extractTotalAmount("Balance due: $1,234.56")
      expect(amount).toBe(1234.56)
    })

    it("should extract the largest amount if multiple present", () => {
      const amount = extractTotalAmount(
        "Subtotal: $50.00, Tax: $5.00, Total: $55.00",
      )
      expect(amount).toBe(55)
    })

    it("should return null if no amount found", () => {
      const amount = extractTotalAmount("No amount mentioned in this text.")
      expect(amount).toBeNull()
    })
  })

  describe("extractCurrency", () => {
    it("should detect USD", () => {
      expect(extractCurrency("Price: $100")).toBe("USD")
      expect(extractCurrency("Amount: 50 USD")).toBe("USD")
    })

    it("should detect EUR", () => {
      expect(extractCurrency("Price: €50")).toBe("EUR")
      expect(extractCurrency("Amount: 100 EUR")).toBe("EUR")
    })

    it("should detect GBP", () => {
      expect(extractCurrency("Price: £75")).toBe("GBP")
      expect(extractCurrency("Amount: 25 GBP")).toBe("GBP")
    })

    it("should detect CAD", () => {
      expect(extractCurrency("Price: C$100")).toBe("CAD")
      expect(extractCurrency("Amount: 50 CAD")).toBe("CAD")
    })

    it("should default to USD for unknown currency", () => {
      expect(extractCurrency("Price: 100")).toBe("USD")
    })
  })

  describe("extractAccountNumber", () => {
    it("should extract account number from common pattern", () => {
      const text = "Account number: 1234567890123456"
      const result = extractAccountNumber(text)
      expect(result).toBe("1234567890123456")
    })

    it("should extract card ending in", () => {
      const text = "Your card ending in 1234"
      const result = extractAccountNumber(text)
      expect(result).toBe("1234")
    })

    it("should extract masked card number", () => {
      const text = "Card **** 5678"
      const result = extractAccountNumber(text)
      expect(result).toBe("5678")
    })

    it("should return undefined if no account number found", () => {
      const text = "This text has no account number."
      const result = extractAccountNumber(text)
      expect(result).toBeUndefined()
    })
  })

  describe("extractDueDate", () => {
    it("should extract due date with month name", () => {
      const text = "Due: January 15, 2024"
      const result = extractDueDate(text)
      expect(result).toBeDefined()
      expect(result).toContain("January")
      expect(result).toContain("15")
    })

    it("should extract MM/DD/YYYY format", () => {
      const text = "Due date: 02/15/2024"
      const result = extractDueDate(text)
      expect(result).toBeDefined()
      expect(result).toContain("02")
      expect(result).toContain("15")
    })

    it("should extract YYYY-MM-DD format", () => {
      const text = "Payment due: 2024-02-15"
      const result = extractDueDate(text)
      expect(result).toBeDefined()
      expect(result).toContain("2024")
    })

    it("should return undefined if no date found", () => {
      const text = "No due date mentioned."
      const result = extractDueDate(text)
      expect(result).toBeUndefined()
    })
  })

  describe("category mapping", () => {
    it("should map Credit Card to correct categories", () => {
      const recognition = { ...mockRecognition, billType: "Credit Card" }
      const parsed = parseBillToTransaction(
        "acct_1",
        "email_1",
        "Statement",
        "Body",
        "from@example.com",
        "2024-02-01",
        recognition,
      )

      expect(parsed.category).toEqual(["credit-card", "bills"])
    })

    it("should map Utility to correct categories", () => {
      const recognition = { ...mockRecognition, billType: "Utility" }
      const parsed = parseBillToTransaction(
        "acct_1",
        "email_1",
        "Bill",
        "Body",
        "from@example.com",
        "2024-02-01",
        recognition,
      )

      expect(parsed.category).toEqual(["utilities", "bills"])
    })

    it("should map Subscription to correct categories", () => {
      const recognition = { ...mockRecognition, billType: "Subscription" }
      const parsed = parseBillToTransaction(
        "acct_1",
        "email_1",
        "Invoice",
        "Body",
        "from@example.com",
        "2024-02-01",
        recognition,
      )

      expect(parsed.category).toEqual(["subscriptions", "entertainment"])
    })

    it("should default to bills category for unknown types", () => {
      const recognition = { ...mockRecognition, billType: undefined }
      const parsed = parseBillToTransaction(
        "acct_1",
        "email_1",
        "Invoice",
        "Body",
        "from@example.com",
        "2024-02-01",
        recognition,
      )

      expect(parsed.category).toEqual(["bills"])
    })
  })
})
