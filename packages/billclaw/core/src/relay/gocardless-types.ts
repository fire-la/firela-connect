/**
 * GoCardless relay API type definitions
 *
 * Provides TypeScript types and Zod schemas for GoCardless Bank Account Data API
 * operations through the firela-relay service.
 *
 * IMPORTANT: These types are used for relay communication only.
 * They mirror the GoCardless Bank Account Data API structure.
 *
 * KEY DIFFERENCES from Plaid:
 * - accounts is string[] (UUID array), NOT nested objects
 * - access_expires is number (86400 = 24 hours)
 * - refresh_expires is number (30 days)
 * - Transaction amounts are strings, not numbers
 *
 * @packageDocumentation
 */

import { z } from "zod"

// ============================================================================
// Token Types
// ============================================================================

/**
 * Response from GoCardless token exchange.
 * POST /api/v2/token/new/ with secret_id and secret_key
 *
 * access_expires: 86400 seconds (24 hours)
 * refresh_expires: 2592000 seconds (30 days)
 */
export const TokenResponseSchema = z.object({
  access: z.string(),
  access_expires: z.number(),
  refresh: z.string(),
  refresh_expires: z.number(),
})

export type TokenResponse = z.infer<typeof TokenResponseSchema>

// ============================================================================
// Institution Types
// ============================================================================

/**
 * GoCardless institution (bank) information
 *
 * Represents a financial institution available through GoCardless.
 */
export const InstitutionSchema = z.object({
  id: z.string(),
  name: z.string(),
  bic: z.string(),
  countries: z.array(z.string()),
  logo: z.string(),
  transaction_total_days: z.number(),
})

export type Institution = z.infer<typeof InstitutionSchema>

// ============================================================================
// Requisition Types (OAuth Flow)
// ============================================================================

/**
 * Requisition status codes
 *
 * CR = Created (initial state)
 * GA = Granting access (user is authenticating)
 * UA = Undergoing authentication (user is authenticating)
 * DN = Done (successfully linked)
 * RJ = Rejected (user denied access or error)
 * EX = Expired (link expired)
 */
export type RequisitionStatus = "CR" | "GA" | "UA" | "DN" | "RJ" | "EX"

/**
 * GoCardless requisition (OAuth link) information
 *
 * A requisition represents a consent request from a user to access their
 * bank accounts. After successful OAuth, it contains the linked account IDs.
 *
 * KEY DIFFERENCE from Plaid: accounts is string[] (UUID array), NOT nested objects
 */
export const RequisitionSchema = z.object({
  id: z.string(),
  redirect: z.string(),
  status: z.string(),
  accounts: z.array(z.string()), // UUID array, not nested objects
  reference: z.string(),
  link: z.string(),
})

export type Requisition = z.infer<typeof RequisitionSchema>

/**
 * Request to create a new requisition (start OAuth flow)
 */
export const CreateRequisitionRequestSchema = z.object({
  institution_id: z.string(),
  redirect: z.string(),
  reference: z.string(),
  user_language: z.string().optional(),
})

export type CreateRequisitionRequest = z.infer<
  typeof CreateRequisitionRequestSchema
>

// ============================================================================
// Account Types
// ============================================================================

/**
 * Account status codes
 */
export type AccountStatus = "READY" | "SUSPENDED" | "ERROR" | "EXPIRED"

/**
 * GoCardless account information
 *
 * Represents a bank account linked through GoCardless.
 */
export const AccountSchema = z.object({
  id: z.string(),
  created: z.string(),
  last_accessed: z.string().optional(),
  iban: z.string().optional(),
  institution_id: z.string(),
  status: z.string(),
  owner_name: z.string().optional(),
})

export type Account = z.infer<typeof AccountSchema>

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Transaction amount with currency
 *
 * NOTE: GoCardless uses string for amount, not number
 */
export const TransactionAmountSchema = z.object({
  amount: z.string(),
  currency: z.string(),
})

export type TransactionAmount = z.infer<typeof TransactionAmountSchema>

/**
 * GoCardless transaction information
 *
 * Represents a single transaction from a bank account.
 */
export const GoCardlessTransactionSchema = z.object({
  transactionId: z.string(),
  bookingDate: z.string(),
  valueDate: z.string(),
  transactionAmount: TransactionAmountSchema,
  remittanceInformationUnstructured: z.string().optional(),
})

export type GoCardlessTransaction = z.infer<typeof GoCardlessTransactionSchema>

/**
 * Transactions response structure
 *
 * Contains booked and pending transaction arrays.
 */
export const TransactionsResponseSchema = z.object({
  transactions: z.object({
    booked: z.array(GoCardlessTransactionSchema),
    pending: z.array(GoCardlessTransactionSchema),
  }),
})

export type TransactionsResponse = z.infer<typeof TransactionsResponseSchema>

/**
 * Request to fetch transactions for an account
 *
 * SECURITY: access_token is always passed in request body, never in URL
 */
export const GetTransactionsRequestSchema = z.object({
  access_token: z.string(),
  account_id: z.string(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
})

export type GetTransactionsRequest = z.infer<typeof GetTransactionsRequestSchema>

// ============================================================================
// Error Types
// ============================================================================

/**
 * GoCardless error response structure
 *
 * GoCardless returns errors in this format:
 * {"summary": "...", "detail": "...", "status_code": ...}
 */
export const GoCardlessErrorSchema = z.object({
  summary: z.string(),
  detail: z.string(),
  status_code: z.number().optional(),
})

export type GoCardlessError = z.infer<typeof GoCardlessErrorSchema>
