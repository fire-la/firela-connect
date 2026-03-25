/**
 * GoCardlessRelayClient - GoCardless client implementation using firela-relay
 *
 * Implements GoCardless Bank Account Data API operations using the firela-relay
 * service for users who don't have their own GoCardless developer accounts.
 *
 * SECURITY:
 * - access_token is always passed in request body, never in URL
 * - All tokens are redacted via RelayClient logging
 * - Tokens are stored locally only (never sent to relay for storage)
 *
 * @packageDocumentation
 */

import { RelayClient } from "./client.js"
import type { Logger } from "../errors/errors.js"
import type {
  Institution,
  Requisition,
  Account,
  TransactionsResponse,
  CreateRequisitionRequest,
  GetTransactionsRequest,
} from "./gocardless-types.js"

/**
 * Base path for GoCardless relay API endpoints
 */
export const GOCARDLESS_RELAY_BASE = "/api/open-banking/gocardless"

/**
 * GoCardlessRelayClient implements GoCardless operations using firela-relay.
 *
 * This client communicates with the firela-relay service which holds
 * the GoCardless API credentials. Users can sync GoCardless bank data without
 * having their own GoCardless developer account.
 *
 * @example
 * ```typescript
 * const client = new GoCardlessRelayClient({
 *   relayUrl: 'https://relay.firela.io',
 *   relayApiKey: 'your-api-key',
 * }, logger)
 *
 * // Discover institutions
 * const institutions = await client.getInstitutions('DE')
 *
 * // Create requisition (OAuth flow)
 * const requisition = await client.createRequisition({
 *   institution_id: 'BANK_ID',
 *   redirect: 'https://example.com/callback',
 *   reference: 'ref-123',
 * })
 *
 * // After OAuth completion, get accounts
 * const accounts = await client.getAccounts(access_token)
 *
 * // Fetch transactions
 * const transactions = await client.getTransactions({
 *   access_token,
 *   account_id: 'acc-uuid-1',
 * })
 * ```
 */
export class GoCardlessRelayClient {
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
   * Get available institutions (banks) for a country
   *
   * @param country - ISO 3166-1 alpha-2 country code (e.g., 'DE', 'GB', 'FR')
   * @returns List of available institutions
   */
  async getInstitutions(country: string): Promise<Institution[]> {
    this.logger.debug?.(`Fetching GoCardless institutions for country: ${country}`)
    return this.client.request<Institution[]>(
      `${GOCARDLESS_RELAY_BASE}/institutions?country=${country}`,
      { method: "GET" },
    )
  }

  /**
   * Create a new requisition (start OAuth flow)
   *
   * Creates a consent request for accessing bank accounts.
   * The returned `link` should be opened in a browser for the user to
   * authenticate with their bank.
   *
   * @param request - Requisition creation request
   * @returns Requisition with link for OAuth
   */
  async createRequisition(
    request: CreateRequisitionRequest,
  ): Promise<Requisition> {
    this.logger.debug?.(
      `Creating GoCardless requisition for institution: ${request.institution_id}`,
    )
    return this.client.request<Requisition>(
      `${GOCARDLESS_RELAY_BASE}/requisitions`,
      {
        method: "POST",
        body: JSON.stringify(request),
      },
    )
  }

  /**
   * Get requisition status and linked accounts
   *
   * After OAuth completion, use this to check if accounts are linked.
   * Status 'DN' means done - accounts are available in the accounts array.
   *
   * SECURITY: access_token is passed in request body, never in URL
   *
   * @param requisitionId - Requisition ID
   * @param accessToken - GoCardless access token
   * @returns Requisition with status and account IDs
   */
  async getRequisition(
    requisitionId: string,
    accessToken: string,
  ): Promise<Requisition> {
    this.logger.debug?.(`Fetching GoCardless requisition: ${requisitionId}`)
    return this.client.request<Requisition>(
      `${GOCARDLESS_RELAY_BASE}/requisitions/${requisitionId}`,
      {
        method: "POST",
        // SECURITY: access_token in body, never in URL
        body: JSON.stringify({ access_token: accessToken }),
      },
    )
  }

  /**
   * Get all accounts linked to the access token
   *
   * SECURITY: access_token is passed in request body, never in URL
   *
   * @param accessToken - GoCardless access token
   * @returns List of linked accounts
   */
  async getAccounts(accessToken: string): Promise<Account[]> {
    this.logger.debug?.("Fetching GoCardless accounts via relay")
    return this.client.request<Account[]>(
      `${GOCARDLESS_RELAY_BASE}/accounts`,
      {
        method: "POST",
        // SECURITY: access_token in body, never in URL
        body: JSON.stringify({ access_token: accessToken }),
      },
    )
  }

  /**
   * Get transactions for a specific account
   *
   * SECURITY: access_token is passed in request body, never in URL
   *
   * @param request - Transactions request with access_token, account_id, and optional date filters
   * @returns Transactions response with booked and pending arrays
   */
  async getTransactions(
    request: GetTransactionsRequest,
  ): Promise<TransactionsResponse> {
    this.logger.debug?.(
      `Fetching GoCardless transactions for account: ${request.account_id}`,
    )
    return this.client.request<TransactionsResponse>(
      `${GOCARDLESS_RELAY_BASE}/transactions`,
      {
        method: "POST",
        body: JSON.stringify({
          // SECURITY: access_token in body, never in URL
          access_token: request.access_token,
          account_id: request.account_id,
          date_from: request.date_from,
          date_to: request.date_to,
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
