/**
 * Plaid OAuth provider - framework-agnostic implementation
 *
 * This module handles the Plaid Link OAuth flow for connecting bank accounts.
 * It supports two modes:
 * 1. Link token creation (for initializing Plaid Link frontend)
 * 2. Public token exchange (for completing the connection)
 *
 * @packageDocumentation
 */

import {
  createPlaidClient,
  type PlaidConfig,
} from "../../sources/plaid/plaid-sync.js"
import type {
  Logger,
} from "../../runtime/types.js"
import type {
  PlaidLinkTokenResult,
  PlaidTokenExchangeResult,
  PlaidOAuthResult,
} from "../types.js"

/**
 * Create Plaid Link token for initializing Link frontend
 */
export async function createLinkToken(
  config: PlaidConfig,
  accountId?: string,
  logger?: Logger,
): Promise<PlaidLinkTokenResult> {
  const plaidClient = createPlaidClient(config)

  const request = {
    user: {
      client_user_id: accountId || `user_${Date.now()}`,
    },
    client_name: "BillClaw",
    products: ["transactions" as any],
    country_codes: ["US" as any],
    language: "en",
  }

  const axiosResponse = await plaidClient.linkTokenCreate(request)
  const response = axiosResponse.data

  logger?.info?.("Plaid Link token created successfully")

  return { linkToken: response.link_token }
}

/**
 * Exchange Plaid public token for access token
 */
export async function exchangePublicToken(
  config: PlaidConfig,
  publicToken: string,
  logger?: Logger,
): Promise<PlaidTokenExchangeResult> {
  const plaidClient = createPlaidClient(config)

  const request = {
    public_token: publicToken,
  }

  const axiosResponse = await plaidClient.itemPublicTokenExchange(request)
  const response = axiosResponse.data

  logger?.info?.("Plaid public token exchanged successfully")

  return {
    accessToken: response.access_token,
    itemId: response.item_id,
  }
}

/**
 * Handle Plaid Link OAuth flow
 *
 * This integrates Plaid Link (https://plaid.com/docs/link/)
 * for secure bank account connection.
 *
 * Flow:
 * 1. Create Link token (no params) - Returns { url, token: linkToken }
 * 2. Handle Link success callback - Receives publicToken
 * 3. Exchange public_token for access_token - Returns { url: "", token: accessToken, itemId }
 *
 * @param config - Plaid configuration
 * @param publicToken - Optional public token from Plaid Link callback
 * @param accountId - Optional account ID for Link token creation
 * @param logger - Optional logger instance
 * @returns OAuthResult with URL and token
 */
export async function plaidOAuthHandler(
  config: PlaidConfig,
  publicToken?: string,
  accountId?: string,
  logger?: Logger,
): Promise<PlaidOAuthResult> {
  try {
    if (!publicToken) {
      // No public token provided - create Link token for initializing Link
      const { linkToken } = await createLinkToken(config, accountId, logger)

      // Return Plaid Link URL and the link token
      return {
        url: "https://cdn.plaid.com/link/v2/stable/link.html",
        token: linkToken,
      }
    }

    // Public token provided - exchange for access token
    const { accessToken, itemId } = await exchangePublicToken(
      config,
      publicToken,
      logger,
    )

    // Return the access token and item ID
    return {
      url: "",
      token: accessToken,
      itemId,
      accessToken,
    }
  } catch (error) {
    logger?.error?.("Plaid OAuth error:", error)
    throw error
  }
}
