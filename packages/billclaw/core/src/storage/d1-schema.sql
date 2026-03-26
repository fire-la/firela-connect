-- BillClaw D1 Schema
-- This schema defines the tables for storing BillClaw data in Cloudflare D1
--
-- Usage:
--   wrangler d1 execute <database> --file=./src/storage/d1-schema.sql
--
-- Or include in wrangler.toml migrations directory

-- Accounts table
-- Stores registered account information
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- 'plaid' | 'gmail'
  name TEXT NOT NULL,
  plaid_access_token TEXT,      -- Encrypted access token for Plaid
  plaid_item_id TEXT,           -- Plaid item ID
  gmail_email TEXT,             -- Gmail email address
  gmail_refresh_token TEXT,     -- Encrypted refresh token for Gmail
  created_at TEXT NOT NULL,     -- ISO timestamp
  last_sync TEXT                -- ISO timestamp of last sync
);

-- Transactions table
-- Stores all transaction records with monthly partitioning via date index
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,                -- UUID
  account_id TEXT NOT NULL,           -- Reference to accounts.id
  date TEXT NOT NULL,                 -- ISO date (YYYY-MM-DD)
  amount INTEGER NOT NULL,            -- Amount in cents (integer)
  currency TEXT NOT NULL DEFAULT 'USD',
  merchant_name TEXT,
  category TEXT,                      -- JSON array of category strings
  payment_channel TEXT,
  pending INTEGER NOT NULL DEFAULT 0, -- Boolean as integer (0/1)
  plaid_transaction_id TEXT UNIQUE,   -- Plaid's transaction ID
  created_at TEXT NOT NULL,           -- ISO timestamp

  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Sync state table
-- Stores sync cursors and state for incremental updates
CREATE TABLE IF NOT EXISTS sync_state (
  sync_id TEXT PRIMARY KEY,           -- UUID
  account_id TEXT NOT NULL,           -- Reference to accounts.id
  started_at TEXT NOT NULL,           -- ISO timestamp
  completed_at TEXT,                  -- ISO timestamp (null if running)
  status TEXT NOT NULL,               -- 'running' | 'completed' | 'failed'
  transactions_added INTEGER NOT NULL DEFAULT 0,
  transactions_updated INTEGER NOT NULL DEFAULT 0,
  cursor TEXT,                        -- Sync cursor for incremental updates
  error TEXT,                         -- Error message if failed
  requires_reauth INTEGER DEFAULT 0,  -- Boolean as integer (0/1)

  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date);
CREATE INDEX IF NOT EXISTS idx_sync_state_account_id ON sync_state(account_id);
CREATE INDEX IF NOT EXISTS idx_sync_state_started_at ON sync_state(started_at);

-- Relay tokens table
-- Stores relay access tokens for Open Banking providers
-- SECURITY: Tokens are stored locally only, never sent to relay for storage
CREATE TABLE IF NOT EXISTS relay_tokens (
  provider TEXT NOT NULL,          -- 'plaid' | 'gocardless'
  account_id TEXT NOT NULL,        -- Reference to accounts.id
  token TEXT NOT NULL,             -- Access token (plaintext for v1.4.0, encryption deferred)
  updated_at TEXT NOT NULL,        -- ISO timestamp

  PRIMARY KEY (provider, account_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Index for relay token lookups
CREATE INDEX IF NOT EXISTS idx_relay_tokens_account_id ON relay_tokens(account_id);

-- GoCardless tokens table
-- Stores GoCardless token data with refresh_token and expiry
-- SECURITY: Tokens are stored locally only, never sent to relay for storage
CREATE TABLE IF NOT EXISTS gocardless_tokens (
  account_id TEXT PRIMARY KEY,        -- Reference to accounts.id
  access_token TEXT NOT NULL,         -- GoCardless access token
  refresh_token TEXT NOT NULL,        -- GoCardless refresh token for token renewal
  expires_at TEXT NOT NULL,           -- ISO timestamp when access token expires
  updated_at TEXT NOT NULL,           -- ISO timestamp of last update

  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Index for gocardless token expiry lookups (for proactive refresh)
CREATE INDEX IF NOT EXISTS idx_gocardless_tokens_expires_at ON gocardless_tokens(expires_at);

-- Unique constraint for plaid_transaction_id
-- Note: UNIQUE constraint is already in CREATE TABLE, this is explicit
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_plaid_id ON transactions(plaid_transaction_id);
