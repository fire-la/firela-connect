/**
 * BillClaw Connect - OAuth Service Server
 *
 * Provides a web interface for OAuth authentication with financial data providers.
 *
 * @packageDocumentation
 */

import express from "express"
import https from "https"
import path from "path"
import { fileURLToPath } from "url"
import { readFileSync } from "fs"
import rateLimit from "express-rate-limit"
import { ConfigManager } from "@firela/billclaw-core"
import { plaidRouter } from "./routes/plaid.js"
import { gmailRouter } from "./routes/gmail.js"
import { credentialsRouter } from "./routes/credentials.js"
import { configRouter } from "./routes/config.js"
import {
  initializeWebhooks,
  setAccountFinder,
  createWebhookRoutes,
} from "./routes/webhooks.js"
import { createReceiverStatusRoutes } from "./routes/receiver-status.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Start the Connect server
 */
async function startServer() {
  const configManager = ConfigManager.getInstance()
  const connectConfig = await configManager.getServiceConfig("connect")
  const config = await configManager.getConfig()

  // Get storage base path for webhook cache
  const storageBase = config.storage?.path || "~/.firela/billclaw"
  const basePath = storageBase.startsWith("~")
    ? storageBase.replace("~", process.env.HOME || "")
    : storageBase

  // 12-factor app: environment variables take precedence, then config, then defaults
  // This allows the server to run without config file in CI/container environments
  const PORT =
    connectConfig.port || parseInt(process.env.PORT || "4456", 10)
  const HOST =
    connectConfig.host || process.env.HOST || "localhost"
  const PUBLIC_URL =
    connectConfig.publicUrl ||
    process.env.PUBLIC_URL ||
    `http://${HOST}:${PORT}`
  const tls = connectConfig.tls

  const app = express()

  // Middleware
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // P0: Rate limiting middleware
  // Separate rate limits for different webhook sources
  const plaidRateLimit = rateLimit({
    windowMs: 60_000, // 1 minute
    max: 100, // 100 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      received: false,
      error: "Too many requests from this IP, please try again later",
    },
    skipSuccessfulRequests: false,
  })

  // Reserved for future use
  const _gocardlessRateLimit = rateLimit({
    windowMs: 60_000,
    max: 50, // 50 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      received: false,
      error: "Too many requests from this IP, please try again later",
    },
  })

  // Reserved for future use
  const _testRateLimit = rateLimit({
    windowMs: 60_000,
    max: 30, // 30 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      received: false,
      error: "Too many test requests from this IP, please try again later",
    },
  })

  // Make publicUrl available to all routes
  app.use((req, _res, next) => {
    ;(req as any).publicUrl = PUBLIC_URL
    next()
  })

  // Serve static files (HTML pages) - use src/public for development
  app.use(express.static(path.join(__dirname, "../src/public")))

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "billclaw-connect" })
  })

  // Receiver status routes
  const receiverStatusRoutes = await createReceiverStatusRoutes()
  app.use("/receiver", receiverStatusRoutes)

  // OAuth routes
  app.use("/oauth/plaid", plaidRouter)
  app.use("/oauth/gmail", gmailRouter)

  // Redirect /oauth/plaid/link to /connect/plaid with session parameter (for Direct mode)
  // Updated: Uses React SPA route instead of old index.html
  app.get("/oauth/plaid/link", (req, res) => {
    const session = req.query.session
    if (session) {
      res.redirect(`/connect/plaid?session=${session}`)
    } else {
      res.redirect("/connect/plaid")
    }
  })

  // Redirect /connect/gmail to handle session parameter (for Gmail Direct mode)
  // Updated: Uses React SPA route instead of old gmail.html

  // Credential polling API (for Direct mode OAuth completion)
  app.use("/api/connect", credentialsRouter)

  // Config API routes (for UI package)
  app.use("/api", configRouter)

  // Initialize webhook components
  const plaidSecret = process.env.PLAID_WEBHOOK_SECRET
  await initializeWebhooks(basePath, plaidSecret)

  // Set account finder (for webhook-triggered syncs)
  // This is a stub - full implementation would require access to Billclaw instance
  setAccountFinder(async (_itemId: string) => {
    // Stub: Return null (no account found)
    // Full implementation would read from config and find account by plaidItemId
    return null
  })

  // Webhook routes with rate limiting
  const webhookRoutes = createWebhookRoutes()

  // Apply rate limiting to webhook routes
  // Note: Routes are defined as /plaid, /gocardless, /test in webhooks.ts
  // so we mount at /webhook to get /webhook/plaid, /webhook/gocardless, /webhook/test
  app.use("/webhook", plaidRateLimit, webhookRoutes)

  // Default route
  app.get("/", (_req, res) => {
    res.json({
      service: "BillClaw Connect",
      version: "0.1.0",
      publicUrl: PUBLIC_URL,
      tlsEnabled: tls?.enabled || false,
      endpoints: {
        health: "/health",
        oauth: {
          plaid: "/oauth/plaid",
          gmail: "/oauth/gmail",
        },
        config: {
          get: "/api/config",
          update: "/api/config",
          accounts: "/api/accounts",
          systemStatus: "/api/system/status",
        },
        credentials: {
          session: "/api/connect/session",
          poll: "/api/connect/credentials/:sessionId",
        },
        webhooks: {
          plaid: "/webhook/plaid",
          gocardless: "/webhook/gocardless",
          test: "/webhook/test",
        },
      },
    })
  })

  // Start server with optional HTTPS
  if (tls?.enabled) {
    if (!tls.keyPath || !tls.certPath) {
      throw new Error(
        "TLS is enabled but keyPath or certPath is missing in config",
      )
    }

    const httpsOptions = {
      key: readFileSync(tls.keyPath),
      cert: readFileSync(tls.certPath),
    }

    https.createServer(httpsOptions, app).listen(PORT, HOST, () => {
      console.log(`BillClaw Connect server running on https://${HOST}:${PORT}`)
      console.log(`- Public URL: ${PUBLIC_URL}`)
      console.log(`- Plaid OAuth: ${PUBLIC_URL}/oauth/plaid`)
      console.log(`- Gmail OAuth: ${PUBLIC_URL}/oauth/gmail`)
    })
  } else {
    app.listen(PORT, HOST, () => {
      console.log(`BillClaw Connect server running on http://${HOST}:${PORT}`)
      console.log(`- Public URL: ${PUBLIC_URL}`)
      console.log(`- Plaid OAuth: http://${HOST}:${PORT}/oauth/plaid`)
      console.log(`- Gmail OAuth: http://${HOST}:${PORT}/oauth/gmail`)
    })
  }
}

// Start the server
startServer().catch((error) => {
  console.error("Failed to start Connect server:", error)
  process.exit(1)
})
