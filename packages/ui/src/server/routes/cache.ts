/**
 * Cache API Routes
 *
 * REST endpoints for cache statistics and management.
 * Operates on the shared serverCache instance that wraps KV reads
 * across config and accounts routes.
 */

import { Hono } from "hono"
import type { Env } from "../index.js"
import { serverCache } from "../lib/server-cache.js"

export const cacheRoutes = new Hono<{ Bindings: Env }>()

/**
 * GET /api/cache/stats
 * Returns cache statistics from the shared server cache
 */
cacheRoutes.get("/stats", async (c) => {
  try {
    const entries = serverCache.size()
    const keys = serverCache.keys()

    // Estimate size: rough heuristic based on number of entries
    const estimatedSizeBytes = entries * 256 // ~256 bytes per entry estimate
    const sizeLabel =
      estimatedSizeBytes < 1024
        ? `${estimatedSizeBytes}B`
        : `${(estimatedSizeBytes / 1024).toFixed(1)}KB`

    return c.json({
      success: true,
      data: {
        entries,
        keys,
        estimatedSize: sizeLabel,
      },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get cache stats",
      },
      500,
    )
  }
})

/**
 * POST /api/cache/clear
 * Clear all entries from the shared server cache
 */
cacheRoutes.post("/clear", async (c) => {
  try {
    serverCache.clear()
    return c.json({
      success: true,
      message: "Cache cleared successfully",
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clear cache",
      },
      500,
    )
  }
})
