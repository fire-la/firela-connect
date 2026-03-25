/**
 * Plaid relay API type definitions
 *
 * Provides TypeScript types and Zod schemas for Plaid relay operations.
 * These types mirror the Plaid API but are simplified for relay use.
 *
 * IMPORTANT: These types are used for relay communication only.
 * DO NOT import from 'plaid' package - relay uses its own transport.
 *
 * @packageDocumentation
 */

import { z } from "zod"

// ============================================================================
// Link Token Types
// ============================================================================

/**
 * Request to create a Plaid Link token
 */
export const LinkTokenCreateRequestSchema = z.object({
  client_name: z.string(),
  language: z.string(),
  country_codes: z.array(z.string()),
  user: z.object({
    client_user_id: z.string(),
  }),
  products: z.array(z.string()).optional(),
  webhook: z.string().optional(),
  redirect_uri: z.string().optional(),
})

export type LinkTokenCreateRequest = z.infer<typeof LinkTokenCreateRequestSchema>

/**
 * Response from creating a Plaid Link token
 */
export const LinkTokenCreateResponseSchema = z.object({
  link_token: z.string(),
  expiration: z.string(),
  request_id: z.string().optional(),
})

export type LinkTokenCreateResponse = z.infer<typeof LinkTokenCreateResponseSchema>

// ============================================================================
// Public Token Exchange Types
// ============================================================================

/**
 * Request to exchange public_token for access_token
 */
export const PublicTokenExchangeRequestSchema = z.object({
  public_token: z.string(),
})

export type PublicTokenExchangeRequest = z.infer<typeof PublicTokenExchangeRequestSchema>

/**
 * Response from exchanging public_token
 */
export const PublicTokenExchangeResponseSchema = z.object({
  access_token: z.string(),
  item_id: z.string(),
  request_id: z.string().optional(),
})

export type PublicTokenExchangeResponse = z.infer<typeof PublicTokenExchangeResponseSchema>

// ============================================================================
// Accounts Types
// ============================================================================

/**
 * Plaid account balance information
 */
export const PlaidAccountBalanceSchema = z.object({
  available: z.number().optional(),
  current: z.number().optional(),
  iso_currency_code: z.string().optional(),
})

export type PlaidAccountBalance = z.infer<typeof PlaidAccountBalanceSchema>

/**
 * Plaid account information
 */
export const PlaidAccountSchema = z.object({
  account_id: z.string(),
  balances: PlaidAccountBalanceSchema,
  name: z.string(),
  mask: z.string().optional(),
  type: z.string(),
  subtype: z.string().optional(),
})

export type PlaidAccount = z.infer<typeof PlaidAccountSchema>

/**
 * Request to get accounts for an item
 */
export const AccountsGetRequestSchema = z.object({
  access_token: z.string(),
  options: z
    .object({
      account_ids: z.array(z.string()).optional(),
    })
    .optional(),
})

export type AccountsGetRequest = z.infer<typeof AccountsGetRequestSchema>

/**
 * Response from getting accounts
 */
export const AccountsGetResponseSchema = z.object({
  accounts: z.array(PlaidAccountSchema),
  item: z.object({
    item_id: z.string(),
    institution_id: z.string().optional(),
  }),
  request_id: z.string().optional(),
})

export type AccountsGetResponse = z.infer<typeof AccountsGetResponseSchema>

// ============================================================================
// Transactions Types
// ============================================================================

/**
 * Plaid transaction information
 */
export const PlaidTransactionSchema = z.object({
  transaction_id: z.string(),
  account_id: z.string(),
  amount: z.number(),
  date: z.string(),
  name: z.string(),
  merchant_name: z.string().optional(),
  iso_currency_code: z.string().optional(),
  category: z.array(z.string()).optional(),
  pending: z.boolean().optional(),
  payment_channel: z.string().optional(),
})

export type PlaidTransaction = z.infer<typeof PlaidTransactionSchema>

/**
 * Removed transaction reference
 */
export const PlaidRemovedTransactionSchema = z.object({
  transaction_id: z.string(),
})

export type PlaidRemovedTransaction = z.infer<typeof PlaidRemovedTransactionSchema>

/**
 * Request to sync transactions
 */
export const TransactionsSyncRequestSchema = z.object({
  access_token: z.string(),
  cursor: z.string().optional(),
  count: z.number().optional(),
})

export type TransactionsSyncRequest = z.infer<typeof TransactionsSyncRequestSchema>

/**
 * Response from syncing transactions
 */
export const TransactionsSyncResponseSchema = z.object({
  added: z.array(PlaidTransactionSchema),
  modified: z.array(PlaidTransactionSchema),
  removed: z.array(PlaidRemovedTransactionSchema),
  next_cursor: z.string(),
  has_more: z.boolean(),
  request_id: z.string().optional(),
})

export type TransactionsSyncResponse = z.infer<typeof TransactionsSyncResponseSchema>
