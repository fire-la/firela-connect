/**
 * Beancount export functionality for BillClaw
 *
 * This module provides functionality to export BillClaw transactions
 * to the Beancount plain text accounting format.
 *
 * Beancount format reference: https://beancount.github.io/docs/beancount_language_syntax.html
 */

import type { Transaction } from "../storage/transaction-storage.js"
import type { StorageConfig } from "../models/config.js"
import { readTransactions } from "../storage/transaction-storage.js"

/**
 * Beancount transaction options
 */
export interface BeancountExportOptions {
  accountId: string
  year: number
  month: number
  commodity?: string // Default: USD
  payeeAccount?: string // Default: Expenses:Unknown
  tagAccounts?: Record<string, string> // Map categories to accounts
  includeTags?: boolean // Include tags for transaction source
  dateFormat?: string // Default: YYYY-MM-DD
}

/**
 * Convert a BillClaw transaction to Beancount format
 */
export function transactionToBeancount(
  txn: Transaction,
  options: BeancountExportOptions,
): string {
  const currency = options.commodity || "USD"

  // Format date
  const date = txn.date

  // Build payee line
  const payee = txn.merchantName || "Unknown"
  const narration = txn.category?.join(", ") || ""

  // Build tags
  let tags = ""
  if (options.includeTags) {
    const sourceTag = txn.paymentChannel === "email" ? "#gmail" : "#plaid"
    tags = ` ${sourceTag}`
    if (txn.pending) {
      tags += " #pending"
    }
  }

  // Build transaction header
  let output = `${date} * "${payee}"${tags}\n`

  // Add narration if present
  if (narration) {
    output += `  "${narration}"\n`
  }

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
    output += `  ${targetAccount}  ${amount} ${currency}\n`
    output += `  Assets:Bank:Checking\n`
  } else {
    // Income/Inflow
    output += `  Assets:Bank:Checking  ${amount} ${currency}\n`
    output += `  ${targetAccount}\n`
  }

  return output
}

/**
 * Export transactions to Beancount format
 */
export async function exportToBeancount(
  transactions: Transaction[],
  options: BeancountExportOptions,
): Promise<string> {
  // Build Beancount file header (always include this)
  let output = `;; Beancount export from BillClaw\n`
  output += `;; Account: ${options.accountId}\n`
  output += `;; Period: ${options.year}-${String(options.month).padStart(2, "0")}\n`
  output += `;; Exported: ${new Date().toISOString()}\n`
  output += "\n"

  if (transactions.length === 0) {
    output += "; No transactions found\n"
    return output
  }

  // Add each transaction
  for (const txn of transactions) {
    output += transactionToBeancount(txn, options)
    output += "\n"
  }

  return output
}

/**
 * Export transactions from storage to Beancount format
 */
export async function exportStorageToBeancount(
  accountId: string,
  year: number,
  month: number,
  storageConfig: StorageConfig,
  options?: Partial<BeancountExportOptions>,
): Promise<string> {
  const transactions = await readTransactions(
    accountId,
    year,
    month,
    storageConfig,
  )

  const fullOptions: BeancountExportOptions = {
    accountId,
    year,
    month,
    ...options,
  }

  return exportToBeancount(transactions, fullOptions)
}

/**
 * Get recommended account mappings for Beancount
 *
 * Returns a suggested mapping of BillClaw categories to Beancount accounts
 */
export function getBeancountAccountMappings(): Record<string, string> {
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
