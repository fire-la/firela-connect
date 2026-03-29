/**
 * Memory Extraction Utilities
 *
 * Provides simple, non-LLM-based memory extraction to avoid blocking delays.
 * Uses regex patterns to identify messages worth long-term storage.
 */

import { storeMemory } from './d1';
import type { Env } from '../types/env.js';

/**
 * Patterns that indicate a message is worth remembering long-term
 *
 * These patterns capture:
 * - User preferences (prefer, like, want, need, hate, love)
 * - Personal information (my name, job, role, project, goal)
 * - Explicit memory requests (remember, don't forget, important)
 * - Strong statements (always, never)
 */
const SIGNIFICANT_PATTERNS = [
  /i (prefer|like|want|need|hate|love)/i,
  /my (name|job|role|project|goal|work)/i,
  /i('m| am) (a |an )?\w+/i, // "I'm a developer", "I am working on..."
  /remember (that|this|,)/i,
  /don't forget/i,
  /important:?\s/i,
  /\b(always|never)\b/i,
  /call me \w+/i, // "Call me Alex"
  /i work (as|at|on|with)/i,
  /i live (in|at)/i,
  /my (favorite|favourite)/i,
];

/**
 * Check if a message is worth storing as long-term memory
 *
 * @param message - User message to evaluate
 * @returns true if the message should be stored
 */
export function shouldStoreMemory(message: string): boolean {
  // Skip very short messages
  if (message.length < 10) {
    return false;
  }

  // Check against significant patterns
  return SIGNIFICANT_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Extract and store memory asynchronously
 *
 * This function is designed to be called with ctx.waitUntil() to avoid
 * blocking the main response. It silently fails on errors to ensure
 * the chat experience is not affected.
 *
 * @param env - Worker environment with DB binding
 * @param channelId - Discord channel ID
 * @param userId - Discord user ID
 * @param userMessage - The user's message to potentially store
 */
export async function extractAndStoreMemory(
  env: Env,
  channelId: string,
  userId: string,
  userMessage: string
): Promise<void> {
  // Check if D1 is available
  if (!env.DB) {
    return;
  }

  // Check if message is worth remembering
  if (!shouldStoreMemory(userMessage)) {
    return;
  }

  try {
    await storeMemory(env.DB, channelId, userId, userMessage);
    console.log(`[Memory] Stored memory for channel ${channelId}`);
  } catch (error) {
    // Silent failure - log but don't throw
    console.error('[Memory] Failed to store memory:', error);
  }
}
