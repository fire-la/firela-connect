/**
 * Cache API Routes
 *
 * REST endpoints for cache statistics and management.
 * Provides visibility into server-side cache state and a clear endpoint.
 */
import { Hono } from "hono"
import type { Env } from "../index.js"

export const cacheRoutes = new Hono<{ Bindings: Env }>()

// Module-level cache instance for Workers environment
// This is separate from ConfigManager's Node.js cache
const serverCache = {
  _entries: new Map<string, { value: unknown; expiresAt: number }>(),

  get size(): number {
    // Clean expired entries before counting
    const now = Date.now()
    for (const [key, entry] of this._entries) {
      if (now >= entry.expiresAt) this._entries.delete(key)
    }
    return this._entries.size
  },

  get keys(): string[] {
    return Array.from(this._entries.keys())
  },

  clear(): void {
    this._entries.clear()
  },
}

/**
 * GET /api/cache/stats
 * Returns cache statistics
 */
cacheRoutes.get("/stats", async (c) => {
  try {
    const entries = serverCache.size
    const keys = serverCache.keys

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
 * Clear all cache entries
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
