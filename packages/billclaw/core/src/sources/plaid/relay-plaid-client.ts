/**
 * RelayPlaidClient - Plaid client implementation using firela-relay
 *
 * Implements PlaidSyncAdapter using the firela-relay service for
 * users who don't have their own Plaid developer accounts.
 *
 * SECURITY:
 * - access_token is always passed in request body, never in URL
 * - All tokens are redacted via RelayClient logging
 * - Tokens are stored locally only (never sent to relay for storage)
 *
 * @packageDocumentation
 */

import { RelayClient } from "../../relay/client.js"
import type { Logger } from "../../errors/errors.js"
import type {
  LinkTokenCreateRequest,
  LinkTokenCreateResponse,
  PublicTokenExchangeResponse,
  AccountsGetResponse,
  TransactionsSyncResponse,
} from "../../relay/plaid-types.js"

/**
 * Base path for Plaid relay API endpoints
 */
const PLAID_RELAY_BASE = "/api/open-banking/plaid"

/**
 * RelayPlaidClient implements PlaidSyncAdapter using firela-relay.
 *
 * This client communicates with the firela-relay service which holds
 * the Plaid API credentials. Users can sync Plaid transactions without
 * having their own Plaid developer account.
 *
 * @example
 * ```typescript
 * const client = new RelayPlaidClient({
 *   relayUrl: 'https://relay.firela.io',
 *   relayApiKey: 'your-api-key',
 * }, logger)
 *
 * // Create Link token for OAuth
 * const linkToken = await client.createLinkToken({
 *   client_name: 'BillClaw',
 *   language: 'en',
 *   country_codes: ['US'],
 *   user: { client_user_id: 'user-123' },
 * })
 *
 * // Exchange public token for access token
 * const { access_token } = await client.exchangePublicToken('public-token')
 *
 * // Sync transactions
 * const transactions = await client.syncTransactions(access_token, cursor)
 * ```
 */
export class RelayPlaidClient {
  private client: RelayClient

  constructor(
    config: { relayUrl: string; relayApiKey: string },
    private logger: Logger,
  ) {
    this.client = new RelayClient(
      { url: config.relayUrl, apiKey: config.relayApiKey },
      logger,
    )
  }

  /**
   * Create a Plaid Link token for OAuth initialization
   *
   * @param request - Link token creation request
   * @returns Link token response with link_token and expiration
   */
  async createLinkToken(
    request: LinkTokenCreateRequest,
  ): Promise<LinkTokenCreateResponse> {
    this.logger.debug?.("Creating Plaid Link token via relay")
    return this.client.request<LinkTokenCreateResponse>(
      `${PLAID_RELAY_BASE}/link/token/create`,
      {
        method: "POST",
        body: JSON.stringify(request),
      },
    )
  }

  /**
   * Exchange public_token for access_token
   *
   * The public_token is obtained from Plaid Link after successful OAuth.
   * It's short-lived and safe for this exchange flow.
   *
   * @param publicToken - Public token from Plaid Link
   * @returns Exchange response with access_token and item_id
   */
  async exchangePublicToken(
    publicToken: string,
  ): Promise<PublicTokenExchangeResponse> {
    this.logger.debug?.("Exchanging public token via relay")
    return this.client.request<PublicTokenExchangeResponse>(
      `${PLAID_RELAY_BASE}/item/public_token/exchange`,
      {
        method: "POST",
        body: JSON.stringify({ public_token: publicToken }),
      },
    )
  }

  /**
   * Fetch accounts for an item
   *
   * SECURITY: access_token is passed in request body, never in URL
   *
   * @param accessToken - Plaid access token
   * @returns Accounts response with account list
   */
  async getAccounts(accessToken: string): Promise<AccountsGetResponse> {
    this.logger.debug?.("Fetching Plaid accounts via relay")
    return this.client.request<AccountsGetResponse>(
      `${PLAID_RELAY_BASE}/accounts/get`,
      {
        method: "POST",
        // SECURITY: access_token in body, never in URL
        body: JSON.stringify({ access_token: accessToken }),
      },
    )
  }

  /**
   * Sync transactions with cursor-based pagination
   *
   * SECURITY: access_token is passed in request body, never in URL
   *
   * @param accessToken - Plaid access token
   * @param cursor - Optional cursor for pagination (omit for initial sync)
   * @returns Transactions sync response with added, modified, removed transactions
   */
  async syncTransactions(
    accessToken: string,
    cursor?: string,
  ): Promise<TransactionsSyncResponse> {
    this.logger.debug?.(
      `Syncing Plaid transactions via relay (cursor: ${cursor ? "provided" : "none"})`,
    )
    return this.client.request<TransactionsSyncResponse>(
      `${PLAID_RELAY_BASE}/transactions/sync`,
      {
        method: "POST",
        body: JSON.stringify({
          // SECURITY: access_token in body, never in URL
          access_token: accessToken,
          cursor: cursor,
          count: 500,
        }),
      },
    )
  }

  /**
   * Get the underlying connection mode
   *
   * @returns 'relay' indicating this client uses the relay service
   */
  getMode(): "relay" {
    return "relay"
  }
}
