/**
 * PlaidSyncAdapter interface and factory for Direct/Relay mode selection
 *
 * Provides a unified interface for Plaid operations that works with both:
 * - Direct mode: Using user's own Plaid credentials
 * - Relay mode: Using firela-relay service (no user credentials required)
 *
 * Factory function selects implementation based on connection mode.
 *
 * @packageDocumentation
 */

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid"
import type { RuntimeContext } from "../../runtime/types.js"
import { selectConnectionMode } from "../../connection/mode-selector.js"
import type { Logger } from "../../errors/errors.js"
import type {
  LinkTokenCreateRequest,
  LinkTokenCreateResponse,
  PublicTokenExchangeResponse,
  AccountsGetResponse,
  TransactionsSyncResponse,
} from "../../relay/plaid-types.js"
import { RelayPlaidClient } from "./relay-plaid-client.js"
import type { PlaidConfig } from "./plaid-sync.js"

/**
 * PlaidSyncAdapter abstracts Plaid operations for Direct vs Relay mode.
 *
 * Factory function selects implementation based on connection mode.
 * This interface allows transparent mode switching without changing
 * application code.
 */
export interface PlaidSyncAdapter {
  /**
   * Create a Plaid Link token for OAuth initialization
   *
   * @param request - Link token creation request
   * @returns Link token response with link_token and expiration
   */
  createLinkToken(request: LinkTokenCreateRequest): Promise<LinkTokenCreateResponse>

  /**
   * Exchange public_token for access_token
   *
   * @param publicToken - Public token from Plaid Link
   * @returns Exchange response with access_token and item_id
   */
  exchangePublicToken(publicToken: string): Promise<PublicTokenExchangeResponse>

  /**
   * Fetch accounts for an item
   *
   * @param accessToken - Plaid access token
   * @returns Accounts response with account list
   */
  getAccounts(accessToken: string): Promise<AccountsGetResponse>

  /**
   * Sync transactions with cursor-based pagination
   *
   * @param accessToken - Plaid access token
   * @param cursor - Optional cursor for pagination
   * @returns Transactions sync response
   */
  syncTransactions(
    accessToken: string,
    cursor?: string,
  ): Promise<TransactionsSyncResponse>

  /**
   * Get the underlying connection mode
   *
   * @returns 'direct' or 'relay'
   */
  getMode(): "direct" | "relay"
}

/**
 * DirectPlaidClient implements PlaidSyncAdapter using direct Plaid SDK.
 *
 * Wraps existing plaid-sync.ts functions for users who have their own
 * Plaid developer accounts. Uses the official Plaid Node SDK.
 *
 * @example
 * ```typescript
 * const client = new DirectPlaidClient({
 *   clientId: 'your-client-id',
 *   secret: 'your-secret',
 *   environment: 'sandbox',
 * }, logger)
 *
 * const linkToken = await client.createLinkToken({ ... })
 * ```
 */
export class DirectPlaidClient implements PlaidSyncAdapter {
  private plaidApi: PlaidApi

  constructor(
    config: PlaidConfig,
    private logger: Logger,
  ) {
    const environment =
      config.environment === "production"
        ? PlaidEnvironments.production
        : config.environment === "development"
          ? PlaidEnvironments.development
          : PlaidEnvironments.sandbox

    const configuration = new Configuration({
      basePath: environment,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": config.clientId,
          "PLAID-SECRET": config.secret,
        },
      },
    })

    this.plaidApi = new PlaidApi(configuration)
  }

  async createLinkToken(
    request: LinkTokenCreateRequest,
  ): Promise<LinkTokenCreateResponse> {
    this.logger.debug?.("Creating Plaid Link token (direct mode)")
    const response = await this.plaidApi.linkTokenCreate(request as any)
    return response.data as LinkTokenCreateResponse
  }

  async exchangePublicToken(
    publicToken: string,
  ): Promise<PublicTokenExchangeResponse> {
    this.logger.debug?.("Exchanging public token (direct mode)")
    const response = await this.plaidApi.itemPublicTokenExchange({
      public_token: publicToken,
    })
    return response.data as PublicTokenExchangeResponse
  }

  async getAccounts(accessToken: string): Promise<AccountsGetResponse> {
    this.logger.debug?.("Fetching Plaid accounts (direct mode)")
    const response = await this.plaidApi.accountsGet({
      access_token: accessToken,
    })
    return response.data as AccountsGetResponse
  }

  async syncTransactions(
    accessToken: string,
    cursor?: string,
  ): Promise<TransactionsSyncResponse> {
    this.logger.debug?.(
      `Syncing Plaid transactions (direct mode, cursor: ${cursor ? "provided" : "none"})`,
    )
    const response = await this.plaidApi.transactionsSync({
      access_token: accessToken,
      cursor: cursor,
      count: 500,
    })
    return response.data as TransactionsSyncResponse
  }

  getMode(): "direct" {
    return "direct"
  }
}

/**
 * Factory: Create appropriate Plaid adapter based on configuration.
 *
 * Selection priority:
 * 1. Explicit mode from config (relay/direct)
 * 2. Auto-detect via selectConnectionMode (Relay > Direct)
 *
 * @param context - Runtime context for config and logging
 * @returns PlaidSyncAdapter implementation
 * @throws Error if required configuration is missing for selected mode
 *
 * @example
 * ```typescript
 * const adapter = await createPlaidAdapter(context)
 *
 * if (adapter.getMode() === 'relay') {
 *   console.log('Using relay mode - no Plaid credentials required')
 * }
 *
 * const linkToken = await adapter.createLinkToken({ ... })
 * ```
 */
export async function createPlaidAdapter(
  context: RuntimeContext,
): Promise<PlaidSyncAdapter> {
  const modeResult = await selectConnectionMode(context, "oauth")
  const config = await context.config.getConfig()

  if (modeResult.mode === "relay") {
    if (!config.relay?.url || !config.relay?.apiKey) {
      throw new Error("Relay mode selected but relay configuration is missing")
    }

    context.logger.info("Using Plaid relay mode")
    return new RelayPlaidClient(
      {
        relayUrl: config.relay.url,
        relayApiKey: config.relay.apiKey,
      },
      context.logger,
    )
  }

  // Direct mode requires Plaid credentials
  if (!config.plaid?.clientId || !config.plaid?.secret) {
    throw new Error(
      "Direct mode selected but Plaid credentials are missing. Configure plaid.clientId and plaid.secret, or use relay mode.",
    )
  }

  context.logger.info("Using Plaid direct mode")
  return new DirectPlaidClient(
    {
      clientId: config.plaid.clientId,
      secret: config.plaid.secret,
      environment: config.plaid.environment || "sandbox",
    },
    context.logger,
  )
}

// Re-export RelayPlaidClient for direct use if needed
export { RelayPlaidClient } from "./relay-plaid-client.js"
