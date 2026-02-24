/**
 * Tests for Gmail OAuth routes
 *
 * Tests the HTTP endpoints for Gmail OAuth 2.0 flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import request from "supertest"
import express from "express"
import { gmailRouter } from "./gmail.js"

// Mock @firela/billclaw-core
vi.mock("@firela/billclaw-core", () => ({
  gmailOAuthHandler: vi.fn(),
  ConfigManager: {
    getInstance: vi.fn(() => ({
      getServiceConfig: vi.fn().mockResolvedValue({
        clientId: "test-client-id",
        clientSecret: "test-secret",
        redirectUri: "http://localhost:4456/oauth/gmail/callback",
      }),
    })),
  },
}))

// Mock @firela/billclaw-core/errors
vi.mock("@firela/billclaw-core/errors", () => ({
  logError: vi.fn(),
  parseOauthError: vi.fn((err) => ({
    type: "UserError",
    errorCode: "GMAIL_ERROR",
    category: "oauth",
    severity: "error",
    recoverable: true,
    humanReadable: {
      title: "Gmail Error",
      message: err instanceof Error ? err.message : String(err),
      suggestions: ["Try again"],
    },
  })),
}))

import { gmailOAuthHandler, ConfigManager } from "@firela/billclaw-core"

describe("Gmail Routes", () => {
  let app: express.Application

  beforeEach(() => {
    vi.clearAllMocks()
    app = express()
    app.use(express.json())
    app.use("/oauth/gmail", gmailRouter)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("GET /oauth/gmail/authorize", () => {
    it("should return authorization URL on success", async () => {
      vi.mocked(gmailOAuthHandler).mockResolvedValueOnce({
        url: "https://accounts.google.com/o/oauth2/v2/auth?...",
        state: "state-123",
      })

      const response = await request(app).get("/oauth/gmail/authorize")

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.authUrl).toBeDefined()
      expect(response.body.state).toBe("state-123")
    })

    it("should pass redirectUri from query parameter", async () => {
      vi.mocked(gmailOAuthHandler).mockResolvedValueOnce({
        url: "https://accounts.google.com/o/oauth2/v2/auth?...",
        state: "state-123",
      })

      await request(app).get(
        "/oauth/gmail/authorize?redirectUri=http://localhost:3000/callback",
      )

      expect(gmailOAuthHandler).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          redirectUri: "http://localhost:3000/callback",
        }),
      )
    })

    it("should call ConfigManager to get Gmail config", async () => {
      vi.mocked(gmailOAuthHandler).mockResolvedValueOnce({
        url: "https://accounts.google.com/o/oauth2/v2/auth?...",
        state: "state-123",
      })

      await request(app).get("/oauth/gmail/authorize")

      expect(ConfigManager.getInstance).toHaveBeenCalled()
    })

    it("should return error response on failure", async () => {
      vi.mocked(gmailOAuthHandler).mockRejectedValueOnce(
        new Error("Gmail API error"),
      )

      const response = await request(app).get("/oauth/gmail/authorize")

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeDefined()
    })
  })

  describe("POST /oauth/gmail/exchange", () => {
    it("should exchange authorization code successfully", async () => {
      vi.mocked(gmailOAuthHandler).mockResolvedValueOnce({
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        accessToken: "access-token-123",
        refreshToken: "refresh-token-123",
        expiresIn: 3600,
      })

      const response = await request(app)
        .post("/oauth/gmail/exchange")
        .send({
          code: "auth-code-123",
          state: "state-123",
          redirectUri: "http://localhost:4456/oauth/gmail/callback",
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.accessToken).toBe("access-token-123")
      expect(response.body.refreshToken).toBe("refresh-token-123")
      expect(response.body.expiresIn).toBe(3600)
    })

    it("should return 400 when code is missing", async () => {
      const response = await request(app)
        .post("/oauth/gmail/exchange")
        .send({
          state: "state-123",
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeDefined()
    })

    it("should return 400 when state is missing", async () => {
      const response = await request(app)
        .post("/oauth/gmail/exchange")
        .send({
          code: "auth-code-123",
        })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeDefined()
    })

    it("should return 400 when both code and state are missing", async () => {
      const response = await request(app)
        .post("/oauth/gmail/exchange")
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
    })

    it("should call gmailOAuthHandler with correct parameters", async () => {
      vi.mocked(gmailOAuthHandler).mockResolvedValueOnce({
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        accessToken: "access-token-123",
        refreshToken: "refresh-token-123",
        expiresIn: 3600,
      })

      await request(app)
        .post("/oauth/gmail/exchange")
        .send({
          code: "auth-code-123",
          state: "state-123",
          redirectUri: "http://localhost:4456/callback",
        })

      expect(gmailOAuthHandler).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          code: "auth-code-123",
          state: "state-123",
          redirectUri: "http://localhost:4456/callback",
        }),
      )
    })

    it("should return error response on exchange failure", async () => {
      vi.mocked(gmailOAuthHandler).mockRejectedValueOnce(
        new Error("Invalid authorization code"),
      )

      const response = await request(app)
        .post("/oauth/gmail/exchange")
        .send({
          code: "invalid-code",
          state: "state-123",
        })

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeDefined()
    })
  })
})
