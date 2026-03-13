/**
 * BillClaw UI - Hono Server Entry Point
 *
 * Unified server for Cloudflare Workers deployment.
 * Provides both API routes and serves the React SPA.
 *
 * @packageDocumentation
 */

import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"

/**
 * Environment bindings for Cloudflare Workers
 */
export type Env = {
  DB: D1Database
  CONFIG: KVNamespace
  PLAID_CLIENT_ID: string
  PLAID_SECRET: string
  PLAID_ENV: string
  PLAID_WEBHOOK_SECRET: string
  JWT_SECRET: string
  GMAIL_CLIENT_ID?: string
  GMAIL_CLIENT_SECRET?: string
  // Service toggles (from wrangler.toml vars)
  BILLCLAW_ENABLED?: string
  FIRELA_BOT_ENABLED?: string
}

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
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 600,
    credentials: true,
  }),
)

// Service toggle middleware (Plan 13.4-01)
import { serviceToggleMiddleware } from "./middleware/service-toggle.js"

app.use("*", serviceToggleMiddleware())

// ============================================================================
// Health Check
// ============================================================================

/**
 * Health check endpoint
 */
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "billclaw-ui",
    version: "0.0.1",
  })
})

/**
 * Root API info endpoint
 */
app.get("/api", (c) => {
  return c.json({
    service: "BillClaw UI",
    version: "0.0.1",
    description: "Unified UI and API service",
    endpoints: {
      health: "/health",
      oauthPlaid: "/api/oauth/plaid",
      oauthGmail: "/api/oauth/gmail",
      credentials: "/api/connect",
    },
  })
})

// ============================================================================
// API Routes
// ============================================================================

// OAuth routes
import plaidRoutes from "./routes/oauth/plaid.js"
import gmailRoutes from "./routes/oauth/gmail.js"
import credentialsRoutes from "./routes/oauth/credentials.js"

// Register OAuth routes
app.route("/api/oauth/plaid", plaidRoutes)
app.route("/api/oauth/gmail", gmailRoutes)

// Register credential routes for Direct mode
app.route("/api/connect", credentialsRoutes)

// Webhook and Config routes (Plan 13.2-03)
import { webhookRoutes } from "./routes/webhooks.js"
import { configRoutes } from "./routes/config.js"

// Register webhook routes
app.route("/webhook", webhookRoutes)

// Register config routes (already under /api prefix)
app.route("/api", configRoutes)

// Service toggle routes (Plan 13.4-01)
import { serviceRoutes } from "./routes/services.js"

app.route("/api/services", serviceRoutes)

// ============================================================================
// Error Handling
// ============================================================================

// Handle 404 - Route not found
app.notFound((c) => {
  // For API routes, return JSON error
  if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/webhook/")) {
    return c.json(
      {
        success: false,
        error: "Not Found",
        errorCode: "NOT_FOUND",
        path: c.req.path,
      },
      404,
    )
  }

  // For other routes, return a simple 404 (SPA routing handled by wrangler assets)
  return c.text("Not Found", 404)
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
export type AppType = typeof app
