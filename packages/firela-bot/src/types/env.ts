/**
 * Worker environment variables
 *
 * Configure these in wrangler.toml or via wrangler secret
 */
export interface Env {
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
