/**
 * Service Toggle Middleware Tests
 */
import { describe, it, expect, vi } from "vitest"
import { Hono } from "hono"

import { serviceToggleMiddleware } from "./service-toggle.js"
import type { Env } from "../index.js"

/**
 * Mock KV namespace for testing
 */
function createMockKV(initialState?: { billclaw: boolean; firelaBot: boolean }) {
  const store: Record<string, string> = initialState
    ? { "service-toggles": JSON.stringify(initialState) }
    : {}
  return {
    get: vi.fn(async (key: string, type: string) => {
      if (type === "json") {
        return store[key] ? JSON.parse(store[key]) : null
      }
      return store[key] || null
    }),
    put: vi.fn(async (key: string, value: string) => {
      store[key] = value
    }),
  }
}

/**
 * Create test Hono app with middleware
 */
function createTestApp(mockKV: ReturnType<typeof createMockKV>, envVars?: Partial<Env>) {
  type TestEnv = { Bindings: Env }
  const app = new Hono<TestEnv>()

  // Set up mock env in context variable
  const testEnv: Env = {
    DB: {} as D1Database,
    CONFIG: mockKV,
    PLAID_CLIENT_ID: "",
    PLAID_SECRET: "",
    PLAID_ENV: "sandbox",
    PLAID_WEBHOOK_SECRET: "",
    JWT_SECRET: "",
    BILLCLAW_ENABLED: "true",
    FIRELA_BOT_ENABLED: "true",
    ...envVars,
  }

  // Add env to context before middleware
  app.use("*", async (c, next) => {
    // @ts-expect-error - Setting env for testing
    c.env = testEnv
    await next()
  })

  // Add service toggle middleware
  app.use("*", serviceToggleMiddleware())

  // Test routes that should be protected
  app.get("/api/oauth/plaid/test", (c) => c.json({ success: true, route: "plaid" }))
  app.get("/api/oauth/gmail/test", (c) => c.json({ success: true, route: "gmail" }))
  app.get("/webhook/test", (c) => c.json({ success: true, route: "webhook" }))
  app.get("/api/bot/test", (c) => c.json({ success: true, route: "bot" }))

  // Routes that should never be blocked
  app.get("/health", (c) => c.json({ status: "ok" }))
  app.get("/api", (c) => c.json({ service: "api" }))
  app.get("/api/services", (c) => c.json({ services: [] }))

  return app
}

describe("serviceToggleMiddleware", () => {
  describe("with all services enabled (default)", () => {
    it("should allow access to protected routes", async () => {
      const mockKV = createMockKV()
      const app = createTestApp(mockKV)

      const res = await app.request("/api/oauth/plaid/test")

      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json).toEqual({ success: true, route: "plaid" })
    })

    it("should allow access to exempt routes", async () => {
      const mockKV = createMockKV({ billclaw: false, firelaBot: false })
      const app = createTestApp(mockKV)

      // Health endpoint should always work
      const res = await app.request("/health")

      expect(res.status).toBe(200)
    })
  })

  describe("with billclaw disabled", () => {
    it("should block /api/oauth/plaid routes", async () => {
      const mockKV = createMockKV({ billclaw: false, firelaBot: true })
      const app = createTestApp(mockKV)

      const res = await app.request("/api/oauth/plaid/test")

      expect(res.status).toBe(503)
      const json = (await res.json()) as { success: boolean; error: string; errorCode: string }
      expect(json.success).toBe(false)
      expect(json.errorCode).toBe("SERVICE_DISABLED")
    })

    it("should block /webhook routes", async () => {
      const mockKV = createMockKV({ billclaw: false, firelaBot: true })
      const app = createTestApp(mockKV)

      const res = await app.request("/webhook/test")

      expect(res.status).toBe(503)
    })
  })

  describe("with firelaBot disabled", () => {
    it("should block /api/bot routes", async () => {
      const mockKV = createMockKV({ billclaw: true, firelaBot: false })
      const app = createTestApp(mockKV)

      const res = await app.request("/api/bot/test")

      expect(res.status).toBe(503)
      const json = (await res.json()) as { success: boolean; error: string; serviceId: string }
      expect(json.serviceId).toBe("firelaBot")
    })
  })

  describe("exempt routes", () => {
    it("should never block /health", async () => {
      const mockKV = createMockKV({ billclaw: false, firelaBot: false })
      const app = createTestApp(mockKV)

      const res = await app.request("/health")

      expect(res.status).toBe(200)
    })

    it("should never block /api (root)", async () => {
      const mockKV = createMockKV({ billclaw: false, firelaBot: false })
      const app = createTestApp(mockKV)

      const res = await app.request("/api")

      expect(res.status).toBe(200)
    })

    it("should never block /api/services", async () => {
      const mockKV = createMockKV({ billclaw: false, firelaBot: false })
      const app = createTestApp(mockKV)

      const res = await app.request("/api/services")

      expect(res.status).toBe(200)
    })
  })
})
