/**
 * Transform utility for converting parsed transactions to Plaid format.
 *
 * Converts RawTransaction from @firela/parser-* to PlaidTransactionUpload
 * format for IGN backend upload.
 *
 * @module @firela/billclaw-core/parsers
 */

import type { PlaidTransactionUpload } from '../upload/ign-client.js';
import type { RawTransaction } from '@firela/parser-core';
import { randomUUID } from 'crypto';

/**
 * Transform options.
 */
export interface TransformOptions {
  /** Target account ID for transactions */
  accountId: string;
  /** Whether transactions are pending (default: false) */
  pending?: boolean;
}

/**
 * Transform parsed transactions to Plaid format for IGN upload.
 *
 * @param transactions - Array of raw transactions from parser
 * @param options - Transform options (accountId, pending status)
 * @returns Array of PlaidTransactionUpload objects
 */
export function transformParsedTransactions(
  transactions: RawTransaction<unknown>[],
  options: TransformOptions,
): PlaidTransactionUpload[] {
  return transactions.map((txn): PlaidTransactionUpload => ({
    transaction_id: txn.metadata?.id?.toString() || randomUUID(),
    amount: txn.amount.toNumber(),
    iso_currency_code: txn.currency,
    date: txn.date.toISOString().split('T')[0],
    merchant_name: txn.payee,
    name: txn.description || txn.payee || '',
    pending: options.pending ?? false,
    account_id: options.accountId,
    category: undefined,
    payment_channel: undefined,
  }));
}
