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
import { plaidRouter } from "@firela/billclaw-connect/routes/plaid"
import { gmailRouter } from "@firela/billclaw-connect/routes/gmail"

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
  const opts = options || {}
  const port = parseInt(opts.port as string, 10) || 3000
  const shouldOpen = opts.open !== false

  const app = express()
  const uiDistPath = getUiDistPath()

  // API routes
  app.use("/api", configRouter)

  // OAuth routes (for Plaid/Gmail connection flows)
  app.use("/oauth/plaid", plaidRouter)
  app.use("/oauth/gmail", gmailRouter)

  // Serve static UI files
  app.use(express.static(uiDistPath))

  // SPA fallback - serve index.html for all unmatched routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(uiDistPath, "index.html"))
  })

  const server = createServer(app)

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
      process.exit(0)
    })
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
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
