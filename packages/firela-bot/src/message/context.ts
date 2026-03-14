/**
 * Message Context Builder
 *
 * Builds OpenClaw-compatible MsgContext from Discord interactions.
 * This format is used for communication with the Wasm core layer.
 */

import { type DiscordInteraction } from '../types/index.js';

/**
 * Message context format compatible with OpenClaw
 *
 * This interface mirrors the MsgContext struct used in OpenClaw
 * for consistent message handling across the system.
 */
export interface MsgContext {
  /** The message content */
  Body: string;
  /** Sender identifier (e.g., "discord:123456789") */
  From: string;
  /** Recipient identifier (e.g., "channel:987654321") */
  To: string;
  /** Session key for conversation tracking */
  SessionKey: string;
  /** Account/Guild identifier */
  AccountId: string;
  /** Chat type: direct message or channel */
  ChatType: 'direct' | 'channel';
  /** Whether the bot was mentioned */
  WasMentioned: boolean;
  /** Unique message identifier */
  MessageSid: string;
  /** Unix timestamp in milliseconds */
  Timestamp: number;
}

/**
 * Builds MsgContext from a Discord interaction
 *
 * @param interaction - The Discord interaction object
 * @returns OpenClaw-compatible MsgContext
 */
export function buildMsgContext(interaction: DiscordInteraction): MsgContext {
  // Extract message content from command options
  const messageOption = interaction.data?.options?.find(
    (o) => o.name === 'message'
  );
  const body = messageOption?.value || '';

  // Determine chat type based on guild presence
  const chatType = interaction.guild_id ? 'channel' : 'direct';

  // Build the context
  return {
    Body: body,
    From: `discord:${interaction.user.id}`,
    To: `channel:${interaction.channel_id}`,
    SessionKey: `discord:${interaction.user.id}`,
    AccountId: interaction.guild_id || 'dm',
    ChatType: chatType,
    // In slash commands, the bot is always being addressed
    WasMentioned: true,
    MessageSid: interaction.id,
    Timestamp: Date.now(),
  };
}

/**
 * Creates a unique session key for a Discord user
 *
 * @param userId - Discord user ID
 * @returns Session key in format "discord:{userId}"
 */
export function createSessionKey(userId: string): string {
  return `discord:${userId}`;
}

/**
 * Parses a session key to extract the Discord user ID
 *
 * @param sessionKey - Session key in format "discord:{userId}"
 * @returns Discord user ID or null if invalid format
 */
export function parseSessionKey(sessionKey: string): string | null {
  const match = sessionKey.match(/^discord:(.+)$/);
  return match ? match[1] : null;
}
