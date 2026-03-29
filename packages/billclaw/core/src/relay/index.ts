/**
 * Relay module exports
 *
 * This module provides HTTP client and error handling for firela-relay
 * communication. It enables BillClaw to communicate with firela-relay
 * for Open Banking operations (Plaid, GoCardless) without user-owned
 * provider accounts.
 *
 * SECURITY: All tokens (access_token, refresh_token) are:
 * - Passed in request body (never in URL parameters)
 * - Redacted from all log output via redactSensitive()
 * - Stored locally only (never sent to relay for storage)
 *
 * @example
 * ```typescript
 * import { RelayClient, RelayError, RelayClientConfig, redactSensitive } from '@firela/billclaw-core/relay'
 *
 * const client = new RelayClient({
 *   url: 'https://relay.firela.io',
 *   apiKey: 'your-api-key',
 * })
 *
 * const result = await client.request('/v1/accounts', { method: 'GET' })
 * const health = await client.healthCheck()
 *
 * // Use redactSensitive before logging sensitive data
 * const data = { access_token: 'secret', userId: '123' }
 * console.log(redactSensitive(data)) // { access_token: 'secr***REDACTED***', userId: '123' }
 * ```
 *
 * @packageDocumentation
 */

// Client
export { RelayClient } from "./client.js"

// Types
export type {
  RelayClientConfig,
  RelayHealthCheckResult,
  RelayApiResponse,
} from "./types.js"

// Errors
export {
  RelayHttpError,
  RelayError,
  ProviderError,
  parseRelayError,
} from "./errors.js"

// Security utilities
export { redactSensitive, isSensitiveValue, maskApiKey } from "./redact.js"

// Plaid relay types
export type {
  LinkTokenCreateRequest,
  LinkTokenCreateResponse,
  PublicTokenExchangeRequest,
  PublicTokenExchangeResponse,
  AccountsGetRequest,
  AccountsGetResponse,
  TransactionsSyncRequest,
  TransactionsSyncResponse,
  PlaidAccount,
  PlaidAccountBalance,
  PlaidTransaction,
  PlaidRemovedTransaction,
} from "./plaid-types.js"

export {
  LinkTokenCreateRequestSchema,
  LinkTokenCreateResponseSchema,
  PublicTokenExchangeRequestSchema,
  PublicTokenExchangeResponseSchema,
  AccountsGetRequestSchema,
  AccountsGetResponseSchema,
  TransactionsSyncRequestSchema,
  TransactionsSyncResponseSchema,
  PlaidAccountSchema,
  PlaidAccountBalanceSchema,
  PlaidTransactionSchema,
  PlaidRemovedTransactionSchema,
} from "./plaid-types.js"

// Plaid error handling
export {
  PLAID_ERROR_MAPPING,
  mapPlaidRelayError,
  parsePlaidRelayError,
} from "./plaid-errors.js"

// GoCardless relay client
export { GoCardlessRelayClient, GOCARDLESS_RELAY_BASE } from "./gocardless-client.js"

// GoCardless relay types
export type {
  TokenResponse,
  Institution,
  Requisition,
  RequisitionStatus,
  Account,
  AccountStatus,
  TransactionAmount,
  GoCardlessTransaction,
  TransactionsResponse,
  CreateRequisitionRequest,
  GetTransactionsRequest,
  GoCardlessError,
} from "./gocardless-types.js"

export {
  TokenResponseSchema,
  InstitutionSchema,
  RequisitionSchema,
  AccountSchema,
  TransactionAmountSchema,
  GoCardlessTransactionSchema,
  TransactionsResponseSchema,
  CreateRequisitionRequestSchema,
  GetTransactionsRequestSchema,
  GoCardlessErrorSchema,
} from "./gocardless-types.js"

// GoCardless error handling
export {
  GOCARDLESS_ERROR_MAPPING,
  mapGoCardlessError,
  parseGoCardlessRelayError,
} from "./gocardless-errors.js"

// Webhook types (relay webhook forwarding)
export type {
  WebhookCallbackRegistration,
  RelayHealthCheckRequestBody,
  RelayHealthCheckResponse,
  RelayJwkProxyResponse,
  RelayWebhookForwarding,
} from "./types.js"
