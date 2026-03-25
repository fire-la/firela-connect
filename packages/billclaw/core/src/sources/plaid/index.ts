/**
 * Plaid data source for BillClaw
 *
 * Provides Plaid integration through both direct mode (user-owned credentials)
 * and relay mode (firela-relay service).
 *
 * @packageDocumentation
 */

// Existing Plaid sync functionality
export * from "./plaid-sync.js"

// New adapter exports for dual mode support
export type { PlaidSyncAdapter } from "./plaid-adapter.js"
export {
  DirectPlaidClient,
  RelayPlaidClient,
  createPlaidAdapter,
} from "./plaid-adapter.js"
