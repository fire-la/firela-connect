/**
 * BillClaw Cloudflare Worker - Main entry point
 *
 * Self-hosted financial data service running on Cloudflare Workers
 * with D1 storage and Hono web framework.
 *
 * @packageDocumentation
 */

import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { authMiddleware } from "./middleware/auth.js"
import { authRoutes, oauthRoutes, webhookRoutes } from "./routes/index.js"
import type { Env } from "./types/env.js"

/**
 * Main Hono application with type bindings
 */
const app = new Hono<{ Bindings: Env }>()

// ============================================================================
// Global Middleware
// ============================================================================

// Request logging
app.use("*", logger())

// CORS - allows frontend to call the API
app.use(
  "*",
  cors({
    origin: "*", // In production, you may want to restrict this
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 600,
    credentials: true,
  }),
)

// ============================================================================
// Public Routes (no authentication required)
// ============================================================================

/**
 * Health check endpoint
 */
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "billclaw-worker",
    version: "0.0.1",
  })
})

/**
 * Root endpoint with service info
 */
app.get("/", (c) => {
  return c.json({
    service: "BillClaw Worker",
    version: "0.0.1",
    description: "Self-hosted financial data service",
    endpoints: {
      health: "/health",
      auth: {
        setup: "/auth/setup",
        verify: "/auth/verify",
        status: "/auth/status",
      },
      oauth: {
        plaid: {
          linkToken: "/api/oauth/plaid/link-token",
          exchange: "/api/oauth/plaid/exchange",
        },
      },
      webhook: {
        plaid: "/webhook/plaid",
        health: "/webhook/health",
      },
    },
  })
})

// Auth routes (including /auth/setup for initial token)
app.route("/auth", authRoutes)

// Webhook routes (no JWT auth - uses HMAC signature verification)
app.route("/webhook", webhookRoutes)

// ============================================================================
// Protected Routes (JWT authentication required)
// ============================================================================

// Apply JWT authentication middleware to all /api/* routes
app.use("/api/*", authMiddleware)

// OAuth routes (requires authentication)
app.route("/api/oauth", oauthRoutes)

// ============================================================================
// Error Handling
// ============================================================================

// Handle 404 - Route not found
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: "Not Found",
      errorCode: "NOT_FOUND",
      path: c.req.path,
    },
    404,
  )
})

// Global error handler
app.onError((err, c) => {
  console.error("Error:", err)

  return c.json(
    {
      success: false,
      error: err.message || "Internal Server Error",
      errorCode: "INTERNAL_ERROR",
    },
    500,
  )
})

/**
 * Export the Hono app for Cloudflare Workers runtime
 */
export default app

/**
 * Export types for consumers
 */
export type { Env } from "./types/env.js"
export type AppType = typeof app
