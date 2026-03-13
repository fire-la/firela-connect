/**
 * Storage Types
 *
 * Type definitions for conversation history storage.
 */

/**
 * A single entry in the conversation history
 */
export interface HistoryEntry {
  /** Message role: user or assistant */
  role: 'user' | 'assistant';
  /** Message content */
  content: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Optional Discord message ID */
  messageId?: string;
}

/**
 * Conversation history for a channel
 */
export interface ConversationHistory {
  /** List of messages in chronological order */
  messages: HistoryEntry[];
  /** Unix timestamp of last update in milliseconds */
  lastUpdated: number;
  /** Discord channel ID */
  channelId: string;
}

/**
 * Maximum number of messages to keep in history
 * Matches OpenClaw's DEFAULT_GROUP_HISTORY_LIMIT
 */
export const HISTORY_LIMIT = 50;

/**
 * Time-to-live for conversation history in seconds
 * 7 days = 60 * 60 * 24 * 7
 */
export const TTL_SECONDS = 604800;
