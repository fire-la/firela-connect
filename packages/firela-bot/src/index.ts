/**
 * Firela Bot Worker
 *
 * Cloudflare Workers entry point for Firela Discord Bot.
 * Routes Discord Interactions and provides health check endpoints.
 */

import { handleInteraction } from './interactions/handler';
import { registerCommands, getCommandsDefinition } from './commands/register';
import { getHistory, clearHistory } from './storage/kv';

/**
 * Worker environment variables
 *
 * Configure these in wrangler.toml or via wrangler secret
 */
interface Env {
  /** Discord Application Public Key (for signature verification) */
  DISCORD_PUBLIC_KEY: string;
  /** Discord Bot Token (for command registration and webhook) */
  DISCORD_BOT_TOKEN: string;
  /** Discord Application ID */
  DISCORD_APPLICATION_ID: string;
  /** Environment name (development, staging, production) */
  ENVIRONMENT?: string;
  /** Firela Bot API Key for relay authentication */
  FIRELA_BOT_API_KEY: string;
  /** Relay service URL */
  RELAY_URL: string;
  /** Workers KV namespace for conversation history */
  CONVERSATION_KV?: KVNamespace;
  /** D1 Database for memory storage */
  DB?: D1Database;
  /** Vectorize index for semantic search */
  VECTORIZE?: VectorizeIndex;
  /** Setup password for one-time endpoints (register commands) */
  SETUP_PASSWORD?: string;
}

/**
 * CORS headers for local testing and development
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-signature-ed25519, x-signature-timestamp',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Discord Interactions endpoint (POST only)
    if (url.pathname === '/interactions' && request.method === 'POST') {
      return handleInteraction(request, env, ctx);
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return Response.json(
        {
          status: 'ok',
          timestamp: Date.now(),
          environment: env.ENVIRONMENT || 'development',
        },
        { headers: corsHeaders }
      );
    }

    // Test endpoint for verifying worker is running
    if (url.pathname === '/test') {
      return Response.json(
        {
          status: 'ok',
          message: 'Firela Bot Worker is running',
          version: '1.0.0',
          timestamp: Date.now(),
        },
        { headers: corsHeaders }
      );
    }

    // One-time slash command registration endpoint
    // Protected by SETUP_PASSWORD (same pattern as billclaw)
    if (url.pathname === '/api/register-commands') {
      return handleRegisterCommands(request, env);
    }

    // Test endpoints for E2E testing (protected by SETUP_PASSWORD)
    if (url.pathname.startsWith('/test/') && env.SETUP_PASSWORD) {
      return handleTestEndpoints(request, env, url);
    }

    // 404 for unknown routes
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

/**
 * Handle slash command registration
 *
 * One-time setup endpoint to register slash commands with Discord.
 * Protected by SETUP_PASSWORD to prevent unauthorized access.
 *
 * Usage:
 *   GET /api/register-commands?password=<SETUP_PASSWORD>
 *
 * Response:
 *   - success: true/false
 *   - commands: list of registered commands
 *   - message: status message
 */
async function handleRegisterCommands(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const password = url.searchParams.get('password');

  // Verify setup password
  if (!env.SETUP_PASSWORD || password !== env.SETUP_PASSWORD) {
    return Response.json(
      {
        success: false,
        error: 'Invalid or missing setup password',
        errorCode: 'SETUP_INVALID_PASSWORD',
        hint: 'Add SETUP_PASSWORD to your Worker secrets and include it in the URL: /api/register-commands?password=YOUR_PASSWORD',
      },
      { status: 401, headers: corsHeaders }
    );
  }

  // Verify required Discord credentials
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_APPLICATION_ID) {
    return Response.json(
      {
        success: false,
        error: 'Missing Discord credentials',
        errorCode: 'MISSING_CREDENTIALS',
        hint: 'Add DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID to your Worker secrets',
      },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    // Check for guild_id parameter for instant guild command registration
    const guildId = url.searchParams.get('guild_id') || undefined;

    // Register commands with Discord
    await registerCommands(env.DISCORD_BOT_TOKEN, env.DISCORD_APPLICATION_ID, guildId);

    return Response.json(
      {
        success: true,
        message: 'Slash commands registered successfully!',
        commands: getCommandsDefinition(),
        note: 'Global commands may take up to 1 hour to appear in Discord. Guild commands are instant.',
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return Response.json(
      {
        success: false,
        error: 'Failed to register commands',
        errorCode: 'REGISTRATION_FAILED',
        details: errorMessage,
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Handle test endpoints for E2E testing
 *
 * Protected by SETUP_PASSWORD via Authorization header.
 * Provides access to conversation history for test verification.
 *
 * Endpoints:
 *   GET /test/history/:channelId - Get conversation history
 *   DELETE /test/history/:channelId - Clear conversation history
 *   GET /test/health - Check KV/DB bindings
 */
async function handleTestEndpoints(
  request: Request,
  env: Env,
  url: URL
): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  const expectedAuth = `Bearer ${env.SETUP_PASSWORD}`;

  if (authHeader !== expectedAuth) {
    return Response.json(
      { error: 'Unauthorized', errorCode: 'TEST_UNAUTHORIZED' },
      { status: 401, headers: corsHeaders }
    );
  }

  // GET /test/history/:channelId - Get conversation history
  const historyMatch = url.pathname.match(/^\/test\/history\/(\d+)$/);
  if (historyMatch && request.method === 'GET') {
    const channelId = historyMatch[1];

    if (!env.CONVERSATION_KV) {
      return Response.json(
        { error: 'KV binding not available', errorCode: 'KV_NOT_CONFIGURED' },
        { status: 503, headers: corsHeaders }
      );
    }

    const history = await getHistory(env.CONVERSATION_KV, channelId);
    return Response.json(history, { headers: corsHeaders });
  }

  // DELETE /test/history/:channelId - Clear conversation history
  if (historyMatch && request.method === 'DELETE') {
    const channelId = historyMatch[1];

    if (!env.CONVERSATION_KV) {
      return Response.json(
        { error: 'KV binding not available', errorCode: 'KV_NOT_CONFIGURED' },
        { status: 503, headers: corsHeaders }
      );
    }

    await clearHistory(env.CONVERSATION_KV, channelId);
    return Response.json({ success: true }, { headers: corsHeaders });
  }

  // GET /test/health - Check bindings
  if (url.pathname === '/test/health' && request.method === 'GET') {
    return Response.json(
      {
        status: 'ok',
        kvBinding: !!env.CONVERSATION_KV,
        dbBinding: !!env.DB,
        vectorizeBinding: !!env.VECTORIZE,
      },
      { headers: corsHeaders }
    );
  }

  return Response.json(
    { error: 'Not Found', errorCode: 'TEST_NOT_FOUND' },
    { status: 404, headers: corsHeaders }
  );
}
