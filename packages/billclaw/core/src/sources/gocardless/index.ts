/**
 * GoCardless data source for BillClaw
 *
 * Provides GoCardless integration through relay mode only.
 * Users cannot have their own GoCardless developer accounts.
 * All GoCardless operations must use the firela-relay service.
 *
 * This is different from Plaid which supports both direct and relay modes.
 *
 * @packageDocumentation
 */

// Adapter exports
export type { GoCardlessSyncAdapter } from "./gocardless-adapter.js"
export {
  createGoCardlessAdapter,
  GoCardlessRelayClient,
} from "./gocardless-adapter.js"

// Re-export types for convenience
export type {
  Institution,
  Requisition,
  Account,
  TransactionsResponse,
  CreateRequisitionRequest,
  GetTransactionsRequest,
} from "../../relay/index.js"
