/**
 * JWT Authentication Middleware Tests
 *
 * Verifies that auth middleware correctly protects API routes
 * and allows public routes through. Addresses GitHub Issue #6
 * (OAuth middleware ordering).
 */
import { describe, it, expect } from "vitest"
import { Hono } from "hono"

import { authMiddleware } from "./auth.js"
import type { Env } from "../index.js"

/**
 * Create a minimal Hono app with authMiddleware applied to /api/*
 * mirroring the production setup in server/index.ts
 */
function createTestApp(envOverrides?: Partial<Env>) {
  type TestEnv = { Bindings: Env }
  const app = new Hono<TestEnv>()

  const testEnv: Env = {
    DB: {} as D1Database,
    CONFIG: {} as KVNamespace,
    PLAID_CLIENT_ID: "test-client-id",
    PLAID_SECRET: "test-secret",
    PLAID_ENV: "sandbox",
    PLAID_WEBHOOK_SECRET: "test-webhook-secret",
    JWT_SECRET: "test-jwt-secret-for-testing",
    ...envOverrides,
  }

  app.use("*", async (c, next) => {
    // @ts-expect-error - Setting env for testing
    c.env = testEnv
    await next()
  })

  // Apply auth middleware to /api/* — same as production
  app.use("/api/*", authMiddleware)

  // Public routes (no auth required)
  app.get("/health", (c) => c.json({ status: "ok" }))
  app.post("/auth/setup", (c) => c.json({ success: true }))
  app.post("/webhook/plaid", (c) => c.json({ received: true }))

  // Protected API routes
  app.get("/api/oauth/plaid/link-token", (c) =>
    c.json({ success: true, linkToken: "link-sandbox-123" }),
  )
  app.post("/api/oauth/plaid/exchange", (c) =>
    c.json({ success: true, accessToken: "access-123" }),
  )
  app.get("/api/accounts", (c) => c.json({ accounts: [] }))
  app.get("/api/config", (c) => c.json({ config: {} }))

  return app
}

describe("authMiddleware", () => {
  describe("public routes (no auth required)", () => {
    const app = createTestApp()

    it("should allow /health without auth", async () => {
      const res = await app.request("/health")
      expect(res.status).toBe(200)
    })

    it("should allow /auth/* without auth", async () => {
      const res = await app.request("/auth/setup", { method: "POST" })
      expect(res.status).toBe(200)
    })

    it("should allow /webhook/* without auth", async () => {
      const res = await app.request("/webhook/plaid", { method: "POST" })
      expect(res.status).toBe(200)
    })
  })

  describe("protected API routes (auth required)", () => {
    const app = createTestApp()

    it("should return 401 for /api/oauth/plaid/link-token without token", async () => {
      const res = await app.request("/api/oauth/plaid/link-token")
      expect(res.status).toBe(401)
      const json = (await res.json()) as { errorCode: string }
      expect(json.errorCode).toBe("AUTH_MISSING")
    })

    it("should return 401 for /api/oauth/plaid/exchange without token", async () => {
      const res = await app.request("/api/oauth/plaid/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken: "test" }),
      })
      expect(res.status).toBe(401)
      const json = (await res.json()) as { errorCode: string }
      expect(json.errorCode).toBe("AUTH_MISSING")
    })

    it("should return 401 for /api/accounts without token", async () => {
      const res = await app.request("/api/accounts")
      expect(res.status).toBe(401)
    })

    it("should return 401 with invalid Bearer token", async () => {
      const res = await app.request("/api/oauth/plaid/link-token", {
        headers: { Authorization: "Bearer invalid-token" },
      })
      expect(res.status).toBe(401)
      const json = (await res.json()) as { errorCode: string }
      expect(json.errorCode).toBe("AUTH_INVALID")
    })
  })

  describe("without JWT_SECRET configured (auto-generates from KV)", () => {
    it("should return 401 when JWT_SECRET is empty (auto-generated secret protects routes)", async () => {
      const app = createTestApp({
        JWT_SECRET: "",
        CONFIG: {
          get: async () => null,
          put: async () => undefined,
        } as unknown as KVNamespace,
      })

      const res = await app.request("/api/oauth/plaid/link-token")
      // JWT_SECRET is auto-generated from KV, so routes are still protected
      expect(res.status).toBe(401)
    })
  })
})
