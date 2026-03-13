/**
 * Conversation History Builder
 *
 * Converts KV history to OpenAI-compatible ChatMessage format.
 * Supports D1 long-term memory injection for cross-session context.
 */

import type { ChatMessage } from '../relay/types';
import type { ConversationHistory } from '../storage/types';
import type { MemoryEntry } from '../memory/types';

/**
 * Build ChatMessages from conversation history
 *
 * Constructs messages in order: system prompt → long-term memories → history → current message
 *
 * @param history - Conversation history from KV (can be null for new conversations)
 * @param currentMessage - Current user message
 * @param systemPrompt - Optional system prompt to prepend
 * @param longTermMemories - Optional D1 long-term memories for cross-session context
 * @returns Array of ChatMessages ready for API call
 */
export function buildChatMessages(
  history: ConversationHistory | null,
  currentMessage: string,
  systemPrompt?: string,
  longTermMemories?: MemoryEntry[]
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // 1. Add system prompt if provided
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  // 2. Add long-term memories if provided (D1 cross-session context)
  if (longTermMemories && longTermMemories.length > 0) {
    const memoryContent = longTermMemories
      .map(m => `• ${m.content}`)
      .join('\n');
    messages.push({
      role: 'system',
      content: `Relevant context from past conversations:\n${memoryContent}`,
    });
  }

  // 3. Add history messages (if any)
  if (history?.messages.length) {
    for (const entry of history.messages) {
      messages.push({
        role: entry.role,
        content: entry.content,
      });
    }
  }

  // 4. Add current user message
  messages.push({
    role: 'user',
    content: currentMessage,
  });

  return messages;
}
