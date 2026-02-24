/**
 * Tests for Webhook routes
 *
 * Tests the HTTP endpoints for receiving webhooks from external services.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import request from "supertest"
import express from "express"
import { createWebhookRoutes } from "./webhooks.js"

// Note: We don't mock the core module here because the webhooks module
// uses a singleton pattern that requires the actual module to initialize
// the processor. Instead, we focus on testing the test endpoint and
// the route structure.

describe("Webhook Routes", () => {
  let app: express.Application

  beforeEach(() => {
    vi.clearAllMocks()
    app = express()
    app.use(express.json())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("POST /webhook/test", () => {
    it("should return success for test webhook", async () => {
      const router = createWebhookRoutes()
      app.use("/webhook", router)

      const response = await request(app)
        .post("/webhook/test")
        .send({ test: true })

      expect(response.status).toBe(200)
      expect(response.body.received).toBe(true)
      expect(response.body.message).toContain("success")
    })

    it("should accept any body for test webhook", async () => {
      const router = createWebhookRoutes()
      app.use("/webhook", router)

      const response = await request(app)
        .post("/webhook/test")
        .send({ arbitrary: "data", nested: { value: 123 } })

      expect(response.status).toBe(200)
      expect(response.body.received).toBe(true)
    })
  })

  describe("route structure", () => {
    it("should create routes for plaid webhook endpoint", async () => {
      const router = createWebhookRoutes()
      app.use("/webhook", router)

      // Without processor initialization, should return 500
      const response = await request(app)
        .post("/webhook/plaid")
        .send({})

      expect(response.status).toBe(500)
    })

    it("should create routes for gocardless webhook endpoint", async () => {
      const router = createWebhookRoutes()
      app.use("/webhook", router)

      // Without processor initialization, should return 500
      const response = await request(app)
        .post("/webhook/gocardless")
        .send({})

      expect(response.status).toBe(500)
    })
  })

  describe("error handling", () => {
    it("should handle test webhook errors gracefully", async () => {
      const router = createWebhookRoutes()
      app.use("/webhook", router)

      // The test endpoint should always succeed
      const response = await request(app)
        .post("/webhook/test")
        .send(null)

      expect(response.status).toBe(200)
    })
  })
})
