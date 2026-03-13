/**
 * Environment bindings for BillClaw Cloudflare Worker
 *
 * These bindings are configured in wrangler.toml and set via
 * wrangler secrets for sensitive values.
 *
 * @packageDocumentation
 */

/**
 * Worker environment bindings
 *
 * All bindings are injected by Cloudflare Workers runtime.
 * Secrets (PLAID_SECRET, JWT_SECRET, SETUP_PASSWORD) should be
 * set via `wrangler secret put <NAME>`.
 */
export interface Env {
  /**
   * D1 Database binding for persistent storage
   *
   * Configured in wrangler.toml:
   * [[d1_databases]]
   * binding = "DB"
   */
  DB: D1Database

  /**
   * KV Namespace for configuration and rate limiting
   *
   * Configured in wrangler.toml:
   * [[kv_namespaces]]
   * binding = "CONFIG"
   */
  CONFIG: KVNamespace

  /**
   * Plaid client ID
   *
   * Set via environment variable or wrangler secret
   */
  PLAID_CLIENT_ID: string

  /**
   * Plaid secret key
   *
   * MUST be set via: wrangler secret put PLAID_SECRET
   */
  PLAID_SECRET: string

  /**
   * Plaid environment
   *
   * - sandbox: For testing with Plaid's Sandbox API
   * - development: For development with real institutions
   * - production: For production use
   */
  PLAID_ENV: "sandbox" | "development" | "production"

  /**
   * JWT secret for authentication
   *
   * MUST be set via: wrangler secret put JWT_SECRET
   * Should be a strong random string (32+ characters)
   */
  JWT_SECRET: string

  /**
   * Setup password for initial JWT token generation
   *
   * MUST be set via: wrangler secret put SETUP_PASSWORD
   * Used once during initial setup to generate the owner JWT
   */
  SETUP_PASSWORD: string

  /**
   * Plaid webhook secret for HMAC verification
   *
   * Set via: wrangler secret put PLAID_WEBHOOK_SECRET
   * Optional - if not set, webhook signature verification is skipped
   */
  PLAID_WEBHOOK_SECRET?: string
}
