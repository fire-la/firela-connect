/**
 * Memory Types
 *
 * Type definitions for long-term memory storage using D1 and Vectorize.
 */

/**
 * A memory entry stored in D1
 */
export interface MemoryEntry {
  /** Unique ID */
  id: string;
  /** Discord channel ID */
  channel_id: string;
  /** Discord user ID */
  user_id: string;
  /** Memory content */
  content: string;
  /** Embedding vector ID in Vectorize */
  vector_id?: string;
  /** Creation timestamp (ISO 8601) */
  created_at: string;
  /** Last access timestamp (ISO 8601) */
  accessed_at: string;
}

/**
 * D1 schema for memory storage
 */
export const MEMORY_SCHEMA = `
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  vector_id TEXT,
  created_at TEXT NOT NULL,
  accessed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_channel_id ON memories(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_id ON memories(user_id);
`;
