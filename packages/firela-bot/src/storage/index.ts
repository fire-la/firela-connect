/**
 * Storage Module
 *
 * Provides conversation history storage using Workers KV.
 */

// Types
export type { HistoryEntry, ConversationHistory } from './types';
export { HISTORY_LIMIT, TTL_SECONDS } from './types';

// KV Storage
export {
  createHistoryKey,
  getHistory,
  appendMessage,
  clearHistory,
} from './kv';
