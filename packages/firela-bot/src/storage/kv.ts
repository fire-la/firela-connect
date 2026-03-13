/**
 * KV Storage Layer
 *
 * Manages conversation history in Workers KV.
 * Provides graceful degradation on KV errors.
 */

import type { HistoryEntry, ConversationHistory } from './types';
import { HISTORY_LIMIT, TTL_SECONDS } from './types';

/**
 * Create KV key for a channel's conversation history
 */
export function createHistoryKey(channelId: string): string {
  return `conversation:${channelId}`;
}

/**
 * Get conversation history for a channel
 *
 * @param kv - Workers KV namespace
 * @param channelId - Discord channel ID
 * @returns Conversation history or null if not found/error
 */
export async function getHistory(
  kv: KVNamespace,
  channelId: string
): Promise<ConversationHistory | null> {
  try {
    const key = createHistoryKey(channelId);
    const value = await kv.get(key, 'json');
    return value as ConversationHistory | null;
  } catch (err) {
    // Graceful degradation: return null on error
    console.error(`KV read error for channel ${channelId}:`, err);
    return null;
  }
}

/**
 * Append a message to conversation history
 *
 * Automatically truncates history to HISTORY_LIMIT.
 * Uses ctx.waitUntil() pattern - should be called with waitUntil for non-blocking.
 *
 * @param kv - Workers KV namespace
 * @param channelId - Discord channel ID
 * @param entry - History entry to append
 * @returns true if successful, false on error
 */
export async function appendMessage(
  kv: KVNamespace,
  channelId: string,
  entry: HistoryEntry
): Promise<boolean> {
  try {
    // Get existing history or create new
    let history = await getHistory(kv, channelId);
    if (!history) {
      history = {
        messages: [],
        lastUpdated: 0,
        channelId,
      };
    }

    // Append new message
    history.messages.push(entry);

    // Truncate if exceeds limit (remove oldest)
    while (history.messages.length > HISTORY_LIMIT) {
      history.messages.shift();
    }

    history.lastUpdated = Date.now();

    // Write to KV with TTL
    const key = createHistoryKey(channelId);
    await kv.put(key, JSON.stringify(history), {
      expirationTtl: TTL_SECONDS,
    });

    return true;
  } catch (err) {
    console.error(`KV write error for channel ${channelId}:`, err);
    return false;
  }
}

/**
 * Clear conversation history for a channel
 *
 * @param kv - Workers KV namespace
 * @param channelId - Discord channel ID
 */
export async function clearHistory(
  kv: KVNamespace,
  channelId: string
): Promise<void> {
  try {
    const key = createHistoryKey(channelId);
    await kv.delete(key);
  } catch (err) {
    console.error(`KV delete error for channel ${channelId}:`, err);
  }
}
