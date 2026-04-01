/**
 * GoCardlessSyncAdapter interface and factory for Relay mode selection
 *
 * Provides a unified interface for GoCardless Bank Account Data API operations.
 *
 * IMPORTANT: GoCardless is RELAY ONLY - there is no direct mode.
 * Users cannot have their own GoCardless developer accounts.
 * All GoCardless operations must go through the firela-relay service.
 *
 * This is different from Plaid which supports both direct and relay modes.
 *
 * @packageDocumentation
 */

import type { RuntimeContext } from "../../runtime/types.js"
import type { GoCardlessTokenStorage } from "../../storage/types.js"
import { selectConnectionMode } from "../../connection/mode-selector.js"
import {
  GoCardlessRelayClient,
  type Institution,
  type Requisition,
  type Account,
  type TransactionsResponse,
  type CreateRequisitionRequest,
  type GetTransactionsRequest,
} from "../../relay/index.js"

/**
 * GoCardlessSyncAdapter abstracts GoCardless operations.
 *
 * Factory function returns the appropriate implementation.
 * Since GoCardless is RELAY ONLY, this always returns a relay client.
 *
 * This interface mirrors PlaidSyncAdapter for consistency.
 */
export interface GoCardlessSyncAdapter {
  /**
   * Get available institutions (banks) for a country
   *
   * @param country - ISO 3166-1 alpha-2 country code (e.g., 'DE', 'GB', 'FR')
   * @returns List of available institutions
   */
  getInstitutions(country: string): Promise<Institution[]>

  /**
   * Create a new requisition (start OAuth flow)
   *
   * @param request - Requisition creation request
   * @returns Requisition with link for OAuth
   */
  createRequisition(request: CreateRequisitionRequest): Promise<Requisition>

  /**
   * Get requisition status and linked accounts
   *
   * @param requisitionId - Requisition ID
   * @param accessToken - GoCardless access token
   * @returns Requisition with status and account IDs
   */
  getRequisition(requisitionId: string, accessToken: string): Promise<Requisition>

  /**
   * Get all accounts linked to the access token
   *
   * @param accessToken - GoCardless access token
   * @returns List of linked accounts
   */
  getAccounts(accessToken: string): Promise<Account[]>

  /**
   * Get transactions for a specific account
   *
   * @param request - Transactions request with access_token, account_id
   * @returns Transactions response with booked and pending arrays
   */
  getTransactions(request: GetTransactionsRequest): Promise<TransactionsResponse>

  /**
   * Get the underlying connection mode
   *
   * @returns 'relay' (GoCardless is relay-only)
   */
  getMode(): "relay"

  /**
   * Ensure a valid access token for the given account.
   * Checks token expiry and auto-refreshes if needed.
   * Reads from GoCardlessTokenStorage, not config.
   *
   * @param accountId - Account identifier
   * @returns Valid access token (refreshed if needed)
   * @throws ProviderError with code "token_not_found" if no token in storage
   */
  ensureValidToken(accountId: string): Promise<string>
}

/**
 * Factory: Create GoCardless adapter (relay mode only).
 *
 * IMPORTANT: GoCardless is RELAY ONLY. There is no direct mode.
 * Users cannot have their own GoCardless developer accounts.
 *
 * Selection:
 * 1. Relay mode - always required for GoCardless
 * 2. Direct/Polling modes - NOT supported, will throw error
 *
 * @param context - Runtime context for config and logging
 * @returns GoCardlessSyncAdapter implementation (always relay)
 * @throws Error if relay configuration is missing or other mode selected
 *
 * @example
 * ```typescript
 * const adapter = await createGoCardlessAdapter(context)
 *
 * // Discover banks in Germany
 * const institutions = await adapter.getInstitutions('DE')
 *
 * // Start OAuth flow
 * const requisition = await adapter.createRequisition({
 *   institution_id: 'BANK_ID',
 *   redirect: 'https://example.com/callback',
 *   reference: 'ref-123',
 * })
 *
 * // After OAuth, fetch transactions
 * const transactions = await adapter.getTransactions({
 *   access_token,
 *   account_id: 'acc-uuid-1',
 * })
 * ```
 */
export async function createGoCardlessAdapter(
  context: RuntimeContext,
): Promise<GoCardlessSyncAdapter> {
  const modeResult = await selectConnectionMode(context, "oauth")
  const config = await context.config.getConfig()

  // GoCardless is RELAY ONLY - direct mode is not supported
  if (modeResult.mode === "relay") {
    if (!config.relay?.url || !config.relay?.apiKey) {
      throw new Error("Relay mode selected but relay configuration is missing")
    }

    if (!context.storage) {
      throw new Error(
        "Token storage required for GoCardless. Configure storage adapter.",
      )
    }

    context.logger.info("Using GoCardless relay mode")
    return new GoCardlessRelayClient(
      {
        relayUrl: config.relay.url,
        relayApiKey: config.relay.apiKey,
      },
      context.logger,
      context.storage as unknown as GoCardlessTokenStorage,
    )
  }

  // Direct and Polling modes are not supported for GoCardless
  // Users cannot have their own GoCardless developer accounts
  throw new Error(
    "GoCardless direct mode is not supported. Use relay mode. " +
      "Configure relay.url and relay.apiKey in your configuration.",
  )
}

// Re-export types for convenience
export type {
  Institution,
  Requisition,
  Account,
  TransactionsResponse,
  CreateRequisitionRequest,
  GetTransactionsRequest,
} from "../../relay/index.js"

// Re-export client for direct use if needed
export { GoCardlessRelayClient } from "../../relay/index.js"
