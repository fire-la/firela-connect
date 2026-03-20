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
import { authMiddleware } from "./middleware/auth.js"

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
  SETUP_PASSWORD?: string // Required for initial JWT setup (Phase 13.2-05)
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

// CORS - allows frontend to make API requests
app.use(
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
)

// ============================================================================
// Health Check
// ============================================================================

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "billclaw-ui",
    version: "0.0.1",
  })
})

// ============================================================================
// Public Routes (no authentication required)
// ============================================================================

// Auth routes (including /auth/setup for initial token)
import { authRoutes } from "./routes/auth.js"
app.route("/auth", authRoutes)

// Webhook routes (no JWT auth - uses HMAC signature verification)
import { webhookRoutes } from "./routes/webhooks.js"
app.route("/webhook", webhookRoutes)

// ============================================================================
// Protected Routes (JWT authentication required)
// ============================================================================

// Apply JWT authentication middleware to all /api/* routes
app.use("/api/*", authMiddleware)

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
app.route("/api/connect", credentialsRoutes)

// Service toggle routes (Plan 13.4-01)
import { serviceRoutes } from "./routes/services.js"
app.route("/api/services", serviceRoutes)

// Sync status routes (Plan 13.3.1-01)
import { syncRoutes } from "./routes/sync.js"
app.route("/api/sync", syncRoutes)

// ============================================================================
// SPA Fallback - handled by Cloudflare Workers Assets
// ============================================================================
// Cloudflare Workers handles SPA routing automatically via wrangler.toml:
// [assets]
// directory = "dist"
// not_found_handling = "single-page-application"
//
// This means:
// - Static assets are served from dist/ automatically
// - For SPA routes (non-API, non-static), Cloudflare returns dist/index.html
// - The built index.html already contains correct asset hashes from Vite

app.notFound(async (c) => {
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

  // For SPA routes, return the built index.html
  // In production/Cloudflare, assets are served from dist/ via wrangler.toml [assets]
  // In local dev with wrangler, we need to return the built HTML manually
  // The built HTML contains the correct asset hashes from Vite build
  return c.html(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <title>connect</title>
    <script type="module" crossorigin src="/assets/index-Bta9ZeBb.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-C8CCZ_qM.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
    },
  })
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
 * export the Hono app for Cloudflare Workers runtime
 */
export default app
export type AppType = typeof app
