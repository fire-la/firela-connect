/**
 * Discord Slash Commands Handler
 *
 * Handles APPLICATION_COMMAND interactions (type 2).
 */

import { createRelayClient, getUserErrorMessage } from '../relay';
import { getHistory, appendMessage } from '../storage';
import { buildChatMessages } from '../conversation';
import { getRecentMemories, extractAndStoreMemory, type MemoryEntry } from '../memory';
import { getMessage, getLocaleFromInteraction } from '../i18n/index.js';
import {
  InteractionType,
  InteractionResponseType,
  ButtonStyle,
  ComponentType,
  ChatButtonCustomId,
  type DiscordInteraction,
} from '../types/index.js';
import type { Env } from '../types/env.js';

// Re-export types for backward compatibility
export {
  InteractionType,
  InteractionResponseType,
  ButtonStyle,
  ComponentType,
  ChatButtonCustomId,
  type DiscordInteraction,
};

/**
 * Handles APPLICATION_COMMAND interactions
 *
 * @param interaction - The Discord interaction object
 * @param env - Worker environment variables
 * @param ctx - ExecutionContext for background tasks
 * @returns Response object for Discord
 */
export async function handleCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const commandName = interaction.data?.name;

  switch (commandName) {
    case 'chat':
      return handleChatCommand(interaction, env, ctx);
    default:
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Unknown command: ${commandName}`,
        },
      });
  }
}

/**
 * Handles the /chat command
 *
 * Uses DEFERRED response mode because LLM calls may exceed
 * Discord's 3-second timeout.
 *
 * Flow:
 * 1. Immediately return DEFERRED response (type 5)
 * 2. Process LLM request in background
 * 3. Send final response via Discord Webhook API
 *
 * @param interaction - The Discord interaction object
 * @param env - Worker environment variables
 * @returns Deferred response, actual message sent via webhook
 */
async function handleChatCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // Get user message from interaction options
  const userMessage = interaction.data?.resolved?.values?.[0] ||
    interaction.data?.options?.find((o) => o.name === 'message')?.value;

  if (!userMessage) {
    const locale = getLocaleFromInteraction(interaction);
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: getMessage('validation.provide_message', locale),
      },
    });
  }

  // Start background processing with ctx.waitUntil() to ensure completion
  // In Cloudflare Workers, background tasks must be registered with waitUntil
  // or they will be terminated when the main function returns
  ctx.waitUntil(processChatAsync(interaction, userMessage, env, ctx));

  // Immediately return DEFERRED response (within Discord's 3-second timeout)
  return Response.json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  });
}

/**
 * Build Discord message body with optional buttons
 *
 * Shared helper for creating Discord webhook message payloads.
 */
function buildDiscordMessageBody(
  content: string,
  locale?: string,
  withButtons: boolean = true
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    content: content.slice(0, 2000), // Discord limit is 2000 chars
  };

  if (withButtons) {
    body.components = [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.PRIMARY,
            custom_id: ChatButtonCustomId.CONTINUE,
            label: getMessage('buttons.continue_chat', locale),
            emoji: { name: '💬' },
          },
          {
            type: ComponentType.BUTTON,
            style: ButtonStyle.DANGER,
            custom_id: ChatButtonCustomId.CLEAR,
            label: getMessage('buttons.clear_context', locale),
            emoji: { name: '🗑️' },
          },
        ],
      },
    ];
  }

  return body;
}

/**
 * Process chat request and return assistant message
 *
 * Shared logic for handling chat interactions from both slash commands and modals.
 */
async function processChatRequest(
  channelId: string,
  userId: string,
  userMessage: string,
  env: Env,
  ctx: ExecutionContext,
  locale?: string
): Promise<string> {
  // Create relay client
  const client = createRelayClient(env);

  // Get conversation history (if KV is available)
  let history = null;
  if (env.CONVERSATION_KV) {
    history = await getHistory(env.CONVERSATION_KV, channelId);
  }

  // Get D1 long-term memories (if DB is available)
  let memories: MemoryEntry[] = [];
  if (env.DB) {
    try {
      memories = await getRecentMemories(env.DB, channelId, 10);
    } catch (error) {
      console.error('Failed to retrieve long-term memories:', error);
      // Continue without memories - graceful degradation
    }
  }

  // Build messages with history and long-term memories
  const messages = buildChatMessages(history, userMessage, undefined, memories);

  // Send to LLM
  const response = await client.chat(messages);
  // Extract text from Claude response format
  const assistantMessage = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('') || getMessage('responses.llm_fallback', locale);

  // Save to history (if KV available)
  if (env.CONVERSATION_KV) {
    const now = Date.now();

    // Save user message
    await appendMessage(env.CONVERSATION_KV, channelId, {
      role: 'user',
      content: userMessage,
      timestamp: now,
    });

    // Save assistant response
    await appendMessage(env.CONVERSATION_KV, channelId, {
      role: 'assistant',
      content: assistantMessage,
      timestamp: now + 1,
    });
  }

  // Extract and store memory asynchronously (background task)
  if (env.DB) {
    ctx.waitUntil(extractAndStoreMemory(env, channelId, userId, userMessage));
  }

  return assistantMessage;
}

/**
 * Process chat command asynchronously and send response via webhook
 */
async function processChatAsync(
  interaction: DiscordInteraction,
  userMessage: string,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const channelId = interaction.channel_id;
  const userId = interaction.user?.id || 'unknown';
  const interactionToken = interaction.token;
  const applicationId = interaction.application_id;
  const locale = getLocaleFromInteraction(interaction);

  try {
    const assistantMessage = await processChatRequest(
      channelId,
      userId,
      userMessage,
      env,
      ctx,
      locale
    );
    // Send response via Discord Webhook API
    await sendFollowupMessage(applicationId, interactionToken, assistantMessage, locale);
  } catch (error) {
    console.error('Chat processing error:', error);
    // Send error message via webhook
    await sendFollowupMessage(
      applicationId,
      interactionToken,
      `Error: ${getUserErrorMessage(error, locale)}`
    );
  }
}

/**
 * Send a followup message via Discord Webhook API
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding#followup-messages
 */
async function sendFollowupMessage(
  applicationId: string,
  interactionToken: string,
  content: string,
  locale?: string,
  withButtons: boolean = true
): Promise<void> {
  const webhookUrl = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`;

  const body = buildDiscordMessageBody(content, locale, withButtons);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Webhook failed: ${response.status} - ${errorText}`);
  }
}

/**
 * Edit the original interaction response via Discord Webhook API
 * This updates the message in place, avoiding the "return" button issue
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding#edit-original-interaction-response
 */
async function editOriginalMessage(
  applicationId: string,
  interactionToken: string,
  content: string,
  locale?: string,
  withButtons: boolean = true
): Promise<void> {
  const webhookUrl = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`;

  const body = buildDiscordMessageBody(content, locale, withButtons);

  const response = await fetch(webhookUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Edit original message failed: ${response.status} - ${errorText}`);
  }
}

/**
 * Handle MESSAGE_COMPONENT interactions (button clicks)
 */
export function handleButtonInteraction(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext
): Response {
  const customId = interaction.data?.custom_id;
  const locale = getLocaleFromInteraction(interaction);

  switch (customId) {
    case ChatButtonCustomId.CONTINUE:
      return showChatModal(interaction, locale);
    case ChatButtonCustomId.CLEAR:
      return handleClearContext(interaction, env, ctx, locale);
    default:
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: getMessage('responses.unknown_button', locale) },
      });
  }
}

/**
 * Show a modal for continuing the conversation
 */
function showChatModal(_interaction: DiscordInteraction, locale?: string): Response {
  return Response.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: ChatButtonCustomId.MODAL_SUBMIT,
      title: getMessage('modals.continue_title', locale),
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.TEXT_INPUT,
              custom_id: 'message_input',
              style: 2, // Paragraph style
              label: getMessage('modals.input_label', locale),
              placeholder: getMessage('modals.input_placeholder', locale),
              required: true,
              min_length: 1,
              max_length: 2000,
            },
          ],
        },
      ],
    },
  });
}

/**
 * Handle clear context button click
 */
function handleClearContext(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  locale?: string
): Response {
  const channelId = interaction.channel_id;

  // Clear history in background
  ctx.waitUntil(clearHistoryAsync(env, channelId));

  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ ${getMessage('responses.context_cleared', locale)}`,
      flags: 64, // Ephemeral - only visible to the user
    },
  });
}

/**
 * Clear conversation history asynchronously
 */
async function clearHistoryAsync(env: Env, channelId: string): Promise<void> {
  if (env.CONVERSATION_KV) {
    try {
      await env.CONVERSATION_KV.delete(`history:${channelId}`);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  }
}

/**
 * Handle MODAL_SUBMIT interactions
 */
export function handleModalSubmit(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext
): Response {
  const locale = getLocaleFromInteraction(interaction);

  // Extract user input from modal
  const userInput = interaction.data?.components?.[0]?.components?.[0]?.value;

  if (!userInput) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: getMessage('validation.no_input_received', locale),
        flags: 64, // Ephemeral
      },
    });
  }

  // Process in background - use editOriginalMessage for Modal to avoid "return" button
  ctx.waitUntil(processModalSubmitAsync(interaction, userInput, env, ctx));

  // Return deferred response - this shows "thinking..." state
  return Response.json({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
  });
}

/**
 * Process Modal submit asynchronously and edit original message
 * This avoids the "return" button issue by editing in place
 */
async function processModalSubmitAsync(
  interaction: DiscordInteraction,
  userMessage: string,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const channelId = interaction.channel_id;
  const userId = interaction.user?.id || 'unknown';
  const interactionToken = interaction.token;
  const applicationId = interaction.application_id;
  const locale = getLocaleFromInteraction(interaction);

  try {
    const assistantMessage = await processChatRequest(
      channelId,
      userId,
      userMessage,
      env,
      ctx,
      locale
    );
    // Edit original message instead of sending new one
    // This avoids the "return" button issue
    await editOriginalMessage(applicationId, interactionToken, assistantMessage, locale);
  } catch (error) {
    console.error('Modal submit processing error:', error);
    // Edit original message with error
    await editOriginalMessage(
      applicationId,
      interactionToken,
      `Error: ${getUserErrorMessage(error, locale)}`,
      locale,
      false // No buttons on error
    );
  }
}
