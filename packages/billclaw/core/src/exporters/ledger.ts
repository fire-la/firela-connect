/**
 * Ledger (ledger-cli) export functionality for BillClaw
 *
 * This module provides functionality to export BillClaw transactions
 * to the Ledger plain text accounting format.
 *
 * Ledger format reference: https://www.ledger-cli.org/3.0/doc/ledger3.html
 */

import type { Transaction } from "../storage/transaction-storage.js"
import type { StorageConfig } from "../models/config.js"
import { readTransactions } from "../storage/transaction-storage.js"

/**
 * Ledger transaction options
 */
export interface LedgerExportOptions {
  accountId: string
  year: number
  month: number
  commodity?: string // Default: $
  payeeAccount?: string // Default: Expenses:Unknown
  tagAccounts?: Record<string, string> // Map categories to accounts
  includeTags?: boolean // Include tags for transaction source
  dateFormat?: string // Default: YYYY/MM/DD
}

/**
 * Convert a BillClaw transaction to Ledger format
 */
export function transactionToLedger(
  txn: Transaction,
  options: LedgerExportOptions,
): string {
  const currency = options.commodity || "$"

  // Format date
  const date = txn.date.replace(/-/g, "/")

  // Build payee/code line
  const payee = txn.merchantName || "Unknown"

  // Build tags
  let tags = ""
  if (options.includeTags) {
    const sourceTag = txn.paymentChannel === "email" ? "#gmail" : "#plaid"
    tags = `  ; :${sourceTag}:`
    if (txn.pending) {
      tags += ":pending:"
    }
  }

  // Build transaction header
  let output = `${date} ${payee}\n`

  // Determine target account based on category
  const targetAccount =
    options.tagAccounts?.[txn.category?.[0] || ""] ||
    options.payeeAccount ||
    "Expenses:Unknown"

  // Format amount (convert from cents to dollars)
  const amount = (Math.abs(txn.amount) / 100).toFixed(2)

  // Build postings
  if (txn.amount < 0) {
    // Expense/Outflow
    output += `    ${targetAccount}    ${currency}${amount}\n`
    output += `    Assets:Bank:Checking\n`
  } else {
    // Income/Inflow
    output += `    Assets:Bank:Checking    ${currency}${amount}\n`
    output += `    ${targetAccount}\n`
  }

  // Add tags if requested
  if (tags) {
    output += tags + "\n"
  }

  return output
}

/**
 * Export transactions to Ledger format
 */
export async function exportToLedger(
  transactions: Transaction[],
  options: LedgerExportOptions,
): Promise<string> {
  if (transactions.length === 0) {
    return "; No transactions found\n"
  }

  // Build Ledger file
  let output = `;; Ledger export from BillClaw\n`
  output += `;; Account: ${options.accountId}\n`
  output += `;; Period: ${options.year}-${String(options.month).padStart(2, "0")}\n`
  output += `;; Exported: ${new Date().toISOString()}\n`
  output += "\n"

  // Add each transaction
  for (const txn of transactions) {
    output += transactionToLedger(txn, options)
    output += "\n"
  }

  return output
}

/**
 * Export transactions from storage to Ledger format
 */
export async function exportStorageToLedger(
  accountId: string,
  year: number,
  month: number,
  storageConfig: StorageConfig,
  options?: Partial<LedgerExportOptions>,
): Promise<string> {
  const transactions = await readTransactions(
    accountId,
    year,
    month,
    storageConfig,
  )

  const fullOptions: LedgerExportOptions = {
    accountId,
    year,
    month,
    ...options,
  }

  return exportToLedger(transactions, fullOptions)
}

/**
 * Get recommended account mappings for Ledger
 *
 * Returns a suggested mapping of BillClaw categories to Ledger accounts
 */
export function getLedgerAccountMappings(): Record<string, string> {
  return {
    // Food & Dining
    "Food and Drink": "Expenses:Food:Restaurants",
    "Fast Food": "Expenses:Food:FastFood",
    Groceries: "Expenses:Food:Groceries",

    // Transportation
    Travel: "Expenses:Travel",
    Gasoline: "Expenses:Transport:Fuel",
    Parking: "Expenses:Transport:Parking",
    Taxi: "Expenses:Transport:Taxi",
    "Ride Share": "Expenses:Transport:Rideshare",
    "Public Transportation": "Expenses:Transport:Public",

    // Shopping
    Shopping: "Expenses:Shopping:General",
    Electronics: "Expenses:Shopping:Electronics",
    Clothing: "Expenses:Shopping:Clothing",
    "Home Improvement": "Expenses:Home:Improvement",

    // Entertainment
    Entertainment: "Expenses:Entertainment:General",
    Movies: "Expenses:Entertainment:Movies",
    Music: "Expenses:Entertainment:Music",
    Games: "Expenses:Entertainment:Games",
    Sports: "Expenses:Entertainment:Sports",

    // Bills & Utilities
    Utilities: "Expenses:Utilities:General",
    Electric: "Expenses:Utilities:Electric",
    Gas: "Expenses:Utilities:Gas",
    Water: "Expenses:Utilities:Water",
    Internet: "Expenses:Utilities:Internet",
    Phone: "Expenses:Utilities:Phone",
    Subscription: "Expenses:Subscriptions",

    // Health
    Healthcare: "Expenses:Health:Medical",
    Pharmacy: "Expenses:Health:Pharmacy",
    Insurance: "Expenses:Insurance:Health",

    // Financial
    Finance: "Expenses:Financial:Fees",
    "Bank Fee": "Expenses:Financial:BankFees",
    Interest: "Expenses:Financial:Interest",
    Transfer: "Expenses:Financial:Transfer",

    // Income
    Income: "Income:General",
    Salary: "Income:Salary",
    Refund: "Income:Refunds",
    Investment: "Income:Investments",
  }
}
