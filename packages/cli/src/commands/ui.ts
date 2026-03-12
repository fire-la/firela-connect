/**
 * UI command
 *
 * Start BillClaw configuration UI server.
 * Uses wrangler dev for local development with Cloudflare Workers compatibility.
 */

import type { CliCommand, CliContext } from "./registry.js"
import { spawn } from "node:child_process"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import open from "open"

/**
 * Get the path to UI package
 */
function getUiPackagePath(): string {
  // Resolve UI package path relative to this CLI package
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const uiPath = path.resolve(currentDir, "..", "..", "..", "ui")

  return uiPath
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
  let opts: Record<string, unknown>
  if (options && typeof options === "object" && "opts" in options) {
    opts = (options as { opts: () => Record<string, unknown> }).opts()
  } else {
    opts = options || {}
  }

  const port = parseInt(opts.port as string, 10) || 8787
  const shouldOpen = opts.open !== false

  const uiPath = getUiPackagePath()

  runtime.logger.info(`Starting BillClaw UI server on port ${port}...`)
  runtime.logger.info(`UI package path: ${uiPath}`)

  // Use wrangler dev to start the UI server
  const wranglerArgs = [
    "run",
    "wrangler",
    "dev",
    "--port",
    String(port),
    "--local",
  ]

  return new Promise<void>((resolve, reject) => {
    const serverProcess = spawn("pnpm", wranglerArgs, {
      cwd: uiPath,
      stdio: "pipe",
      shell: true,
    })

    let serverReady = false

    serverProcess.stdout?.on("data", (data) => {
      const output = data.toString()
      process.stdout.write(data)

      // Check if server is ready
      if (!serverReady && output.includes(`http://localhost:${port}`)) {
        serverReady = true
        runtime.logger.info(`BillClaw UI running at http://localhost:${port}`)

        if (shouldOpen) {
          open(`http://localhost:${port}`).catch((err) => {
            runtime.logger.warn(`Failed to open browser: ${err}`)
          })
        }
      }
    })

    serverProcess.stderr?.on("data", (data) => {
      process.stderr.write(data)
    })

    serverProcess.on("error", (err) => {
      runtime.logger.error(`Failed to start UI server: ${err}`)
      reject(err)
    })

    // Graceful shutdown
    const shutdown = () => {
      runtime.logger.info("Shutting down UI server...")
      serverProcess.kill("SIGTERM")
      setTimeout(() => {
        serverProcess.kill("SIGKILL")
        resolve()
      }, 5000)
    }

    process.on("SIGINT", shutdown)
    process.on("SIGTERM", shutdown)

    // Handle server exit
    serverProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        runtime.logger.error(`UI server exited with code ${code}`)
      }
      resolve()
    })
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
      default: "8787",
    },
    {
      flags: "--no-open",
      description: "Don't open browser automatically",
    },
  ],
  handler: runUi,
}
