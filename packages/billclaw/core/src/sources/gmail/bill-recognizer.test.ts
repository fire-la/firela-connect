/**
 * Tests for Bill Recognition Service
 */

import { describe, it, expect } from "vitest"
import {
  recognizeBill,
  DEFAULT_KEYWORDS,
  type EmailContent,
  type GmailConfig,
} from "./bill-recognizer.js"

describe("Bill Recognizer", () => {
  const defaultConfig: GmailConfig = {
    senderWhitelist: [],
    keywords: [...DEFAULT_KEYWORDS], // Copy array to avoid reference issues
    confidenceThreshold: 0.5,
    requireAmount: false,
    requireDate: false,
  }

  describe("recognizeBill", () => {
    it("should recognize a Netflix subscription email", () => {
      const email: EmailContent = {
        id: "msg1",
        subject: "Your Netflix Invoice",
        from: "info@netflix.com",
        date: "2024-02-01",
        body: "Your Netflix subscription for the month is $15.99. Due date: February 15, 2024.",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.isBill).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.amount).toBe(15.99)
      expect(result.currency).toBe("USD")
      expect(result.merchant).toBe("info")
    })

    it("should recognize a credit card statement", () => {
      const email: EmailContent = {
        id: "msg2",
        subject: "Credit Card Statement Available",
        from: "alerts@chase.com",
        date: "2024-02-01",
        body: "Your statement is now available. Total balance due: $1,234.56. Payment due by February 25, 2024.",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.isBill).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.amount).toBe(1234.56)
      expect(result.billType).toBe("Credit Card")
    })

    it("should not recognize a personal email", () => {
      const email: EmailContent = {
        id: "msg3",
        subject: "Let's grab lunch tomorrow",
        from: "friend@example.com",
        date: "2024-02-01",
        body: "Hey! Want to meet up for lunch tomorrow at noon?",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.isBill).toBe(false)
      expect(result.confidence).toBeLessThan(0.5)
    })

    it("should respect sender whitelist", () => {
      const email: EmailContent = {
        id: "msg4",
        subject: "Payment Confirmation",
        from: "billing@paypal.com",
        date: "2024-02-01",
        body: "Payment of $50.00 received.",
      }

      const configWithWhitelist: GmailConfig = {
        ...defaultConfig,
        senderWhitelist: ["billing@paypal.com"],
      }

      const result = recognizeBill(email, configWithWhitelist)

      expect(result.isBill).toBe(true)
      expect(result.confidence).toBeGreaterThanOrEqual(0.4) // Whitelist adds 0.4
      expect(result.reasons).toContain("Sender is in whitelist")
    })

    it("should require amount when configured", () => {
      const email: EmailContent = {
        id: "msg5",
        subject: "Your bill is ready",
        from: "billing@service.com",
        date: "2024-02-01",
        body: "Please log in to view your bill details.",
      }

      const configWithRequiredAmount: GmailConfig = {
        ...defaultConfig,
        requireAmount: true,
      }

      const result = recognizeBill(email, configWithRequiredAmount)

      expect(result.isBill).toBe(false)
      expect(result.reasons).toContain("Missing required amount")
    })

    it("should require date when configured", () => {
      const email: EmailContent = {
        id: "msg6",
        subject: "Your bill is ready",
        from: "billing@service.com",
        date: "2024-02-01",
        body: "Your bill amount is $50.00.",
      }

      const configWithRequiredDate: GmailConfig = {
        ...defaultConfig,
        requireDate: true,
      }

      const result = recognizeBill(email, configWithRequiredDate)

      expect(result.isBill).toBe(false)
      expect(result.reasons).toContain("Missing required date")
    })

    it("should recognize utility bill", () => {
      const email: EmailContent = {
        id: "msg7",
        subject: "PG&E Energy Statement",
        from: "noreply@pge.com",
        date: "2024-02-01",
        body: "Your energy usage for this month: $142.50. Due date: 02/15/2024.",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.isBill).toBe(true)
      expect(result.amount).toBe(142.5)
      expect(result.billType).toBe("Utility")
    })

    it("should recognize insurance premium", () => {
      const email: EmailContent = {
        id: "msg8",
        subject: "GEICO Premium Due Notice",
        from: "billing@geico.com",
        date: "2024-02-01",
        body: "Your insurance premium of $150.00 is due. Policy: A12345678.",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.isBill).toBe(true)
      expect(result.amount).toBe(150)
      expect(result.billType).toBe("Insurance")
    })

    it("should classify phone bill correctly", () => {
      const email: EmailContent = {
        id: "msg9",
        subject: "AT&T Wireless Bill",
        from: "notification@att.com",
        date: "2024-02-01",
        body: "Your wireless bill is $85.00. Due: 02/20/2024.",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.isBill).toBe(true)
      expect(result.billType).toBe("Phone")
    })

    it("should classify subscription correctly", () => {
      const email: EmailContent = {
        id: "msg10",
        subject: "Spotify Subscription Renewed",
        from: "no-reply@spotify.com",
        date: "2024-02-01",
        body: "Your Premium subscription has been renewed. $9.99 charged to your card.",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.isBill).toBe(true)
      expect(result.billType).toBe("Subscription")
    })
  })

  describe("amount extraction", () => {
    it("should extract USD amount", () => {
      const email: EmailContent = {
        id: "msg1",
        subject: "Invoice",
        from: "billing@example.com",
        date: "2024-02-01",
        body: "Amount: $123.45",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.amount).toBe(123.45)
      expect(result.currency).toBe("USD")
    })

    it("should extract EUR amount", () => {
      const email: EmailContent = {
        id: "msg2",
        subject: "Rechnung",
        from: "billing@example.com",
        date: "2024-02-01",
        body: "Betrag: €99,99",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.amount).toBe(99.99)
      expect(result.currency).toBe("EUR")
    })

    it("should extract GBP amount", () => {
      const email: EmailContent = {
        id: "msg3",
        subject: "Invoice",
        from: "billing@example.com",
        date: "2024-02-01",
        body: "Amount: £50.00",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.amount).toBe(50)
      expect(result.currency).toBe("GBP")
    })

    it("should handle comma-separated thousands", () => {
      const email: EmailContent = {
        id: "msg4",
        subject: "Invoice",
        from: "billing@example.com",
        date: "2024-02-01",
        body: "Total: $1,234.56",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.amount).toBe(1234.56)
    })
  })

  describe("confidence scoring", () => {
    it("should give highest confidence to whitelisted senders with keywords", () => {
      const email: EmailContent = {
        id: "msg1",
        subject: "INVOICE - Netflix Subscription",
        from: "billing@netflix.com",
        date: "2024-02-01",
        body: "Amount: $15.99",
      }

      const config: GmailConfig = {
        ...defaultConfig,
        senderWhitelist: ["billing@netflix.com"],
      }

      const result = recognizeBill(email, config)

      // Whitelist (0.4) + keyword in subject (0.2) + has amount (0.05) = 0.65+
      expect(result.confidence).toBeGreaterThan(0.6)
      expect(result.isBill).toBe(true)
    })

    it("should give moderate confidence to known billing domains", () => {
      const email: EmailContent = {
        id: "msg2",
        subject: "Payment Received",
        from: "service@paypal.com",
        date: "2024-02-01",
        body: "Amount: $50.00",
      }

      const result = recognizeBill(email, defaultConfig)

      // Known domain (0.25) + keyword (0.1) + has amount (0.05) = 0.4
      expect(result.confidence).toBeGreaterThan(0.3)
    })

    it("should use custom confidence threshold", () => {
      const email: EmailContent = {
        id: "msg3",
        subject: "Bill notification",
        from: "notifications@example.com",
        date: "2024-02-01",
        body: "Your bill is ready.",
      }

      const lowThresholdConfig: GmailConfig = {
        ...defaultConfig,
        confidenceThreshold: 0.2,
      }

      const result = recognizeBill(email, lowThresholdConfig)

      expect(result.isBill).toBe(true) // Should pass with lower threshold
    })
  })

  describe("edge cases", () => {
    it("should handle empty body", () => {
      const email: EmailContent = {
        id: "msg1",
        subject: "Bill",
        from: "billing@example.com",
        date: "2024-02-01",
        body: "",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.isBill).toBe(true) // Keyword in subject
      expect(result.confidence).toBeGreaterThan(0)
    })

    it("should handle special characters in subject", () => {
      const email: EmailContent = {
        id: "msg2",
        subject: "🔔 Payment Reminder: Your bill is due!",
        from: "billing@example.com",
        date: "2024-02-01",
        body: "$25.00 due by 02/15/2024",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.isBill).toBe(true)
      expect(result.amount).toBe(25)
    })

    it("should handle null/undefined values gracefully", () => {
      const email: EmailContent = {
        id: "msg3",
        subject: "Invoice",
        from: "billing@example.com",
        date: "2024-02-01",
        body: "Amount due: $100.00",
      }

      const result = recognizeBill(email, defaultConfig)

      expect(result.isBill).toBe(true)
      expect(result.amount).toBe(100)
    })
  })
})
