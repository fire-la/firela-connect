/**
 * Health endpoint tests
 *
 * Tests for GET /health and GET / endpoints
 * These are public endpoints that don't require authentication
 */

import { describe, it, expect, beforeAll } from "vitest"
import { SELF } from "cloudflare:test"
import { warmUp } from "./setup"

describe("Health Endpoints", () => {
  beforeAll(async () => {
    // Warm up worker to avoid cold start issues
    await warmUp()
  })

  describe("GET /health", () => {
    it("should return 200 with status ok", async () => {
      const response = await SELF.fetch("http://localhost/health")
      expect(response.status).toBe(200)

      const body = (await response.json()) as { status: string; service: string; version: string }
      expect(body.status).toBe("ok")
      expect(body.service).toBe("billclaw-worker")
      expect(body.version).toBeDefined()
    })
  })

  describe("GET /", () => {
    it("should return 200 with service info", async () => {
      const response = await SELF.fetch("http://localhost/")
      expect(response.status).toBe(200)

      const body = (await response.json()) as {
        service: string
        version: string
        description: string
        endpoints: Record<string, unknown>
      }
      expect(body.service).toBe("BillClaw Worker")
      expect(body.endpoints).toBeDefined()

      expect(body.endpoints.health).toBe("/health")
      expect(body.endpoints.auth).toMatchObject({
        setup: "/auth/setup",
        verify: "/auth/verify",
        status: "/auth/status",
      })
      expect(body.endpoints.oauth).toMatchObject({
        plaid: {
          linkToken: "/api/oauth/plaid/link-token",
          exchange: "/api/oauth/plaid/exchange",
        },
      })
      expect(body.endpoints.webhook).toMatchObject({
        plaid: "/webhook/plaid",
        health: "/webhook/health",
      })
    })
  })
})
