/**
 * Update Notifier for BillClaw CLI
 *
 * Checks for CLI updates and notifies users when new versions are available.
 * Uses caching to avoid slowing down CLI startup.
 */

import { createRequire } from "module"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load package.json using createRequire for ESM compatibility
const require = createRequire(import.meta.url)
const packageJsonPath = join(__dirname, "..", "..", "package.json")
const packageJson = require(packageJsonPath)

// Lazy-loaded notifier (initialized on first use)
type UpdateNotifier = {
  update?: {
    current: string
    latest: string
    type: "major" | "minor" | "patch"
  }
}

let _notifier: UpdateNotifier | null = null

/**
 * Get or create the update notifier instance
 */
function getNotifier(): UpdateNotifier {
  if (!_notifier) {
    // Dynamic import to avoid blocking on module load
    const updateNotifier = require("update-notifier")
    _notifier = updateNotifier({
      pkg: packageJson,
      updateCheckInterval: 1000 * 60 * 60 * 24, // 24 hours
    })
  }
  // At this point _notifier is guaranteed to be non-null
  return _notifier!
}

/**
 * Show update notification if available (non-blocking)
 *
 * Displays a formatted notification when a new version is available.
 * Runs asynchronously to avoid blocking CLI operations.
 * Highlights major version changes with warnings.
 */
export function showUpdateNotification(): void {
  // Skip update notification in test environment
  if (process.env.NODE_ENV === 'test') {
    return
  }

  // Run asynchronously to avoid blocking
  setImmediate(() => {
    try {
      const notifier = getNotifier()

      if (!notifier.update) {
        return
      }

      const { current, latest, type } = notifier.update

      let message = `Update available! ${current} → ${latest}`

      if (type === "major") {
        message += "\n⚠️  This is a major update with breaking changes."
        message += "\n   Please review the changelog before updating."
      }

      message += "\n   Run: pnpm install -g @firela/billclaw-cli@latest"

      console.log(`
┌─────────────────────────────────────────┐
│  ${message.padEnd(39)}  │
└─────────────────────────────────────────┘
`)
    } catch {
      // Silently ignore update check errors
    }
  })
}

/**
 * Get update info for manual display
 *
 * @returns Update info object or null if no update available
 */
export function getUpdateInfo():
  | { current: string; latest: string; type: string }
  | null {
  try {
    const notifier = getNotifier()
    if (notifier.update) {
      const { current, latest, type } = notifier.update
      return { current, latest, type }
    }
  } catch {
    // Silently ignore update check errors
  }
  return null
}
