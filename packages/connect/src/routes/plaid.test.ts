/**
 * Tests for Plaid OAuth routes
 *
 * Tests the HTTP endpoints for Plaid Link OAuth flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import request from "supertest"
import express from "express"
import { plaidRouter } from "./plaid.js"

// Mock @firela/billclaw-core
vi.mock("@firela/billclaw-core", () => ({
  plaidOAuthHandler: vi.fn(),
  ConfigManager: {
    getInstance: vi.fn(() => ({
      getServiceConfig: vi.fn().mockResolvedValue({
        clientId: "test-client-id",
        secret: "test-secret",
        environment: "sandbox",
      }),
    })),
  },
}))

// Mock @firela/billclaw-core/errors
vi.mock("@firela/billclaw-core/errors", () => ({
  logError: vi.fn(),
  parseOauthError: vi.fn((err) => ({
    type: "UserError",
    errorCode: "PLAID_ERROR",
    category: "oauth",
    severity: "error",
    recoverable: true,
    humanReadable: {
      title: "Plaid Error",
      message: err instanceof Error ? err.message : String(err),
      suggestions: ["Try again"],
    },
  })),
}))

import { plaidOAuthHandler, ConfigManager } from "@firela/billclaw-core"

describe("Plaid Routes", () => {
  let app: express.Application

  beforeEach(() => {
    vi.clearAllMocks()
    app = express()
    app.use(express.json())
    app.use("/oauth/plaid", plaidRouter)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("GET /oauth/plaid/link-token", () => {
    it("should return link token on success", async () => {
      vi.mocked(plaidOAuthHandler).mockResolvedValueOnce({
        token: "link-sandbox-123",
        url: "https://cdn.plaid.com/link/v2/stable/link.html",
      })

      const response = await request(app).get("/oauth/plaid/link-token")

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.linkToken).toBe("link-sandbox-123")
      expect(response.body.plaidUrl).toBeDefined()
    })

    it("should call ConfigManager to get Plaid config", async () => {
      vi.mocked(plaidOAuthHandler).mockResolvedValueOnce({
        token: "link-sandbox-123",
        url: "https://cdn.plaid.com/link/v2/stable/link.html",
      })

      await request(app).get("/oauth/plaid/link-token")

      expect(ConfigManager.getInstance).toHaveBeenCalled()
    })

    it("should return error response on failure", async () => {
      vi.mocked(plaidOAuthHandler).mockRejectedValueOnce(
        new Error("Plaid API error"),
      )

      const response = await request(app).get("/oauth/plaid/link-token")

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeDefined()
    })
  })

  describe("POST /oauth/plaid/exchange", () => {
    it("should exchange public token successfully", async () => {
      vi.mocked(plaidOAuthHandler).mockResolvedValueOnce({
        url: "https://cdn.plaid.com/link/v2/stable/link.html",
        accessToken: "access-sandbox-123",
        itemId: "item-123",
      })

      const response = await request(app)
        .post("/oauth/plaid/exchange")
        .send({
          publicToken: "public-sandbox-123",
          accountId: "account-123",
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.accessToken).toBe("access-sandbox-123")
      expect(response.body.itemId).toBe("item-123")
    })

    it("should return 400 when publicToken is missing", async () => {
      const response = await request(app)
        .post("/oauth/plaid/exchange")
        .send({
          accountId: "account-123",
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain("publicToken")
    })

    it("should call plaidOAuthHandler with public token and account id", async () => {
      vi.mocked(plaidOAuthHandler).mockResolvedValueOnce({
        url: "https://cdn.plaid.com/link/v2/stable/link.html",
        accessToken: "access-sandbox-123",
        itemId: "item-123",
      })

      await request(app)
        .post("/oauth/plaid/exchange")
        .send({
          publicToken: "public-sandbox-123",
          accountId: "account-123",
        })

      expect(plaidOAuthHandler).toHaveBeenCalledWith(
        expect.any(Object),
        "public-sandbox-123",
        "account-123",
      )
    })

    it("should return error response on exchange failure", async () => {
      vi.mocked(plaidOAuthHandler).mockRejectedValueOnce(
        new Error("Invalid public token"),
      )

      const response = await request(app)
        .post("/oauth/plaid/exchange")
        .send({
          publicToken: "invalid-token",
        })

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeDefined()
    })

    it("should handle missing body gracefully", async () => {
      const response = await request(app).post("/oauth/plaid/exchange").send({})

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })
  })
})
