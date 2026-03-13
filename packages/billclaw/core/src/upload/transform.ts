/**
 * Transaction transformation for IGN upload
 *
 * Converts BillClaw Transaction format to Plaid format for IGN API.
 * This is the REVERSE of convertTransaction in plaid-sync.ts.
 *
 * @packageDocumentation
 */

import type { Transaction } from "../storage/transaction-storage.js"
import type { PlaidTransactionUpload } from "./ign-client.js"

/**
 * Transform a BillClaw Transaction to Plaid format for IGN upload
 *
 * Key conversion: amount is in cents in BillClaw, but IGN expects dollars.
 *
 * @param txn - BillClaw transaction
 * @returns Plaid-format transaction for IGN
 */
export function transformToPlaidFormat(txn: Transaction): PlaidTransactionUpload {
  return {
    transaction_id: txn.plaidTransactionId || txn.transactionId,
    // Convert cents to dollars (BillClaw stores in cents, IGN expects dollars)
    amount: txn.amount / 100,
    iso_currency_code: txn.currency,
    date: txn.date,
    merchant_name: txn.merchantName,
    name: txn.merchantName,
    pending: txn.pending,
    account_id: txn.accountId,
    category: txn.category.length > 0 ? txn.category : undefined,
    payment_channel: txn.paymentChannel,
  }
}

/**
 * Transform multiple BillClaw transactions to Plaid format
 *
 * @param transactions - BillClaw transactions
 * @returns Plaid-format transactions for IGN
 */
export function transformTransactionsToPlaidFormat(
  transactions: Transaction[],
): PlaidTransactionUpload[] {
  return transactions.map(transformToPlaidFormat)
}
