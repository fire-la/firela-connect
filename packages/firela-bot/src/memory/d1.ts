/**
 * Memory D1 Storage
 *
 * Manages long-term memory storage using D1 database.
 */

import type { MemoryEntry } from './types';

/**
 * Generate a unique ID for memory entries
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get current timestamp in ISO 8601 format
 */
function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Store a new memory entry
 *
 * @param db - D1 database binding
 * @param channelId - Discord channel ID
 * @param userId - Discord user ID
 * @param content - Memory content
 * @returns The created memory entry
 */
export async function storeMemory(
  db: D1Database,
  channelId: string,
  userId: string,
  content: string
): Promise<MemoryEntry> {
  const id = generateId();
  const now = timestamp();

  await db
    .prepare(
      `INSERT INTO memories (id, channel_id, user_id, content, created_at, accessed_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, channelId, userId, content, now, now)
    .run();

  return {
    id,
    channel_id: channelId,
    user_id: userId,
    content,
    created_at: now,
    accessed_at: now,
  };
}

/**
 * Get recent memories for a channel
 *
 * @param db - D1 database binding
 * @param channelId - Discord channel ID
 * @param limit - Maximum number of memories to return
 * @returns Array of memory entries
 */
export async function getRecentMemories(
  db: D1Database,
  channelId: string,
  limit: number = 10
): Promise<MemoryEntry[]> {
  const result = await db
    .prepare(
      `SELECT * FROM memories
       WHERE channel_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(channelId, limit)
    .all<MemoryEntry>();

  return result.results;
}

/**
 * Search memories by content similarity (using Vectorize)
 *
 * This is a placeholder for vector search integration.
 * Will be implemented when Vectorize is configured.
 *
 * @param db - D1 database binding
 * @param vectorize - Vectorize index binding
 * @param channelId - Discord channel ID
 * @param query - Search query
 * @param limit - Maximum results
 * @returns Array of memory entries
 */
export async function searchMemories(
  db: D1Database,
  vectorize: VectorizeIndex | undefined,
  channelId: string,
  query: string,
  limit: number = 5
): Promise<MemoryEntry[]> {
  // If Vectorize is not configured, fall back to text search
  if (!vectorize) {
    const result = await db
      .prepare(
        `SELECT * FROM memories
         WHERE channel_id = ? AND content LIKE ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .bind(channelId, `%${query}%`, limit)
      .all<MemoryEntry>();

    return result.results;
  }

  // Vector search implementation roadmap (when embedding service is available):
  // 1. Generate embedding for query using embedding API
  // 2. Query Vectorize index for similar vectors
  // 3. Fetch matching memories from D1 by IDs
  // Currently falls back to recent memories when Vectorize is configured but not implemented
  return getRecentMemories(db, channelId, limit);
}

/**
 * Update the accessed_at timestamp for a memory
 *
 * @param db - D1 database binding
 * @param id - Memory ID
 */
export async function touchMemory(
  db: D1Database,
  id: string
): Promise<void> {
  await db
    .prepare(`UPDATE memories SET accessed_at = ? WHERE id = ?`)
    .bind(timestamp(), id)
    .run();
}

/**
 * Delete old memories (cleanup)
 *
 * @param db - D1 database binding
 * @param daysOld - Delete memories older than this many days
 * @returns Number of deleted rows
 */
export async function deleteOldMemories(
  db: D1Database,
  daysOld: number = 30
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const result = await db
    .prepare(`DELETE FROM memories WHERE created_at < ?`)
    .bind(cutoff.toISOString())
    .run();

  return result.meta.changes;
}
