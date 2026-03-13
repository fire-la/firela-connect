/**
 * Webhook endpoint tests
 *
 * Tests for webhook endpoints (health check and Plaid webhook receiver)
 * Note: Webhook endpoints do NOT require JWT authentication
 */

import { describe, it, expect, beforeAll } from "vitest"
import { SELF } from "cloudflare:test"
import { warmUp } from "./setup"

describe("Webhook Endpoints", () => {
  beforeAll(async () => {
    // Warm up worker to avoid cold start issues
    await warmUp()
  })

  describe("GET /webhook/health", () => {
    it("should return webhook status", async () => {
      const response = await SELF.fetch("http://localhost/webhook/health")

      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        status: string
        service: string
      }
      expect(body.status).toBe("ok")
      expect(body.service).toBe("billclaw-webhook")
    })
  })

  describe("POST /webhook/plaid", () => {
    it("should reject webhook without JWT verification header", async () => {
      // Webhook endpoints use JWT-based verification (Plaid-Verification header)
      // Without the JWT header, verification fails - this is expected behavior
      const response = await SELF.fetch("http://localhost/webhook/plaid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhook_type: "TRANSACTIONS",
          webhook_code: "INITIAL_UPDATE",
          item_id: "test-item-id",
          new_transactions: 10,
        }),
      })

      // Should return 200 (webhook endpoint always returns 200)
      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        received: boolean
        type: string
        itemId: string
        error?: string
      }

      // JWT verification requires Plaid-Verification header (not Plaid-Signature)
      // This is the correct behavior - webhook verification fails without the JWT
      expect(body.received).toBe(false)
      expect(body.error).toBe("Missing Plaid-Verification header")
    })

    it("should handle missing webhook data gracefully", async () => {
      const response = await SELF.fetch("http://localhost/webhook/plaid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      // Should return 200 but with received: false due to missing required fields
      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        received: boolean
        error?: string
      }
      expect(body.received).toBe(false)
    })
  })
})
