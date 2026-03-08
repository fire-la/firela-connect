/**
 * UI command
 *
 * Start BillClaw configuration UI server.
 */

import type { CliCommand, CliContext } from "./registry.js"
import express, { type Request, type Response } from "express"
import { createServer } from "node:http"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import open from "open"
import { configRouter } from "@firela/billclaw-connect/routes/config"
import { credentialsRouter } from "@firela/billclaw-connect/routes/credentials"
import { plaidRouter } from "@firela/billclaw-connect/routes/plaid"
import { gmailRouter } from "@firela/billclaw-connect/routes/gmail"
import { createWebhookRoutes } from "@firela/billclaw-connect/routes/webhooks"

/**
 * Get the path to UI static files
 */
function getUiDistPath(): string {
  // Resolve UI dist path relative to this CLI package
  // In development: packages/ui/dist
  // In production (after pnpm build): ../../../ui/dist relative to dist/commands/ui.js
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const uiDistPath = path.resolve(currentDir, "..", "..", "..", "ui", "dist")

  return uiDistPath
}

/**
 * Run UI server
 */
async function runUi(
  context: CliContext,
  options?: Record<string, unknown>,
): Promise<void> {
  const { runtime } = context

  // Extract options from Commander Command object if needed
  // Commander passes the Command instance as the last parameter
  let opts: Record<string, unknown>
  if (options && typeof options === "object" && "opts" in options) {
    // This is a Commander Command object, extract options using opts()
    opts = (options as { opts: () => Record<string, unknown> }).opts()
  } else {
    opts = options || {}
  }

  const port = parseInt(opts.port as string, 10) || 3000
  const shouldOpen = opts.open !== false

  const app = express()
  const uiDistPath = getUiDistPath()

  // Parse JSON bodies for API routes
  app.use(express.json())

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "billclaw-ui",
      version: process.env.npm_package_version || "0.0.0",
    })
  })

  // API routes
  app.use("/api", configRouter)

  // Credentials routes (for Direct mode polling)
  app.use("/api/connect", credentialsRouter)

  // OAuth routes (for Plaid/Gmail connection flows)
  app.use("/oauth/plaid", plaidRouter)
  app.use("/oauth/gmail", gmailRouter)

  // Webhook routes (for Plaid/GoCardless webhooks)
  app.use("/webhook", createWebhookRoutes())

  // Serve static UI files
  app.use(express.static(uiDistPath))

  // SPA fallback - serve index.html for all unmatched routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(uiDistPath, "index.html"))
  })

  const server = createServer(app)

  // Return a promise that resolves when server closes
  // This keeps the CLI process running until user stops it
  return new Promise<void>((resolve) => {
    server.listen(port, () => {
      runtime.logger.info(`BillClaw UI running at http://localhost:${port}`)

      if (shouldOpen) {
        open(`http://localhost:${port}`).catch((err) => {
          runtime.logger.warn(`Failed to open browser: ${err}`)
        })
      }
    })

    // Graceful shutdown
    const shutdown = () => {
      runtime.logger.info("Shutting down UI server...")
      server.close(() => {
        runtime.logger.info("UI server stopped")
        resolve()
      })
    }

    process.on("SIGINT", shutdown)
    process.on("SIGTERM", shutdown)
  })
}

/**
 * UI command definition
 */
export const uiCommand: CliCommand = {
  name: "ui",
  description: "Start BillClaw configuration UI",
  options: [
    {
      flags: "-p, --port <port>",
      description: "Port to run UI server",
      default: "3000",
    },
    {
      flags: "--no-open",
      description: "Don't open browser automatically",
    },
  ],
  handler: runUi,
}
