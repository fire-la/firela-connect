/**
 * Discord Interactions Handler
 *
 * Main entry point for handling Discord Interaction webhook requests.
 * Validates signatures and routes to appropriate handlers.
 */

import { verifyDiscordSignature } from './verify';
import {
  handleCommand,
  handleButtonInteraction,
  handleModalSubmit,
} from './commands';
import { InteractionType, type DiscordInteraction } from '../types/index.js';
import type { Env } from '../types/env.js';

/**
 * Handles incoming Discord Interaction requests
 *
 * @param request - The incoming HTTP request
 * @param env - Worker environment variables
 * @param ctx - Cloudflare Workers execution context for background tasks
 * @returns HTTP response for Discord
 */
export async function handleInteraction(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  // 1. Extract signature headers
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');

  if (!signature || !timestamp) {
    return new Response('Missing signature headers', { status: 401 });
  }

  // 2. Get raw body for signature verification
  const body = await request.text();

  // 3. Verify the request is genuinely from Discord
  const isValid = verifyDiscordSignature(
    body,
    signature,
    timestamp,
    env.DISCORD_PUBLIC_KEY
  );

  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  // 4. Parse the interaction
  let interaction: DiscordInteraction;
  try {
    interaction = JSON.parse(body);
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  // 5. Handle PING - Discord sends this to verify the endpoint
  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: 1 }); // PONG
  }

  // 6. Handle APPLICATION_COMMAND (slash commands)
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    return handleCommand(interaction, env, ctx);
  }

  // 7. Handle MESSAGE_COMPONENT (button clicks)
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    return handleButtonInteraction(interaction, env, ctx);
  }

  // 8. Handle MODAL_SUBMIT (modal form submissions)
  if (interaction.type === InteractionType.MODAL_SUBMIT) {
    return handleModalSubmit(interaction, env, ctx);
  }

  // 9. Unknown interaction type
  return new Response('Unknown interaction type', { status: 400 });
}

