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

// CORS - allows frontend to make API requests
app.use(
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: "include",
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

// ============================================================================
// SPA Fallback - serve index.html for client-side routes
// ============================================================================

// ============================================================================
// SPA Fallback - serve index.html for client-side routes
// ============================================================================

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BillClaw UI</title>
    <script type="module" crossorigin src="/assets/index-DDiRU5mW.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-BFD3B20P.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

// For SPA routes, serve index.html from dist folder
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

  // For SPA routes, serve the built index.html from dist folder
  return c.html(INDEX_HTML)
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
