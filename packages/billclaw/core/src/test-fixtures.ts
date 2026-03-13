/**
 * Test fixtures for BillClaw
 */

import type { AccountConfig, BillclawConfig } from "@firela/billclaw-core"

/**
 * Sample Plaid transaction data (external format)
 */
export interface PlaidTransactionData {
  transaction_id: string
  account_id: string
  date: string
  amount: number
  iso_currency_code: string
  category?: string[]
  merchant_name?: string
  payment_channel?: string
  pending?: boolean
}

export const mockPlaidTransactions: PlaidTransactionData[] = [
  {
    transaction_id: "plaid-txn-001",
    account_id: "plaid-acct-123",
    date: "2024-01-15",
    amount: 125.5,
    iso_currency_code: "USD",
    category: ["Food", "Restaurants"],
    merchant_name: "Test Restaurant",
    payment_channel: "online",
    pending: false,
  },
  {
    transaction_id: "plaid-txn-002",
    account_id: "plaid-acct-123",
    date: "2024-01-16",
    amount: 45.99,
    iso_currency_code: "USD",
    category: ["Shopping", "Electronics"],
    merchant_name: "Tech Store",
    payment_channel: "in store",
    pending: true,
  },
]

/**
 * Sample account configurations
 */
export const mockAccounts: AccountConfig[] = [
  {
    id: "plaid-sandbox-123",
    type: "plaid",
    name: "Test Bank Account",
    enabled: true,
    syncFrequency: "daily",
    lastSync: "2024-01-16T10:30:00Z",
    lastStatus: "success",
    plaidItemId: "item-sandbox-123",
    plaidAccessToken: "access-sandbox-test",
  },
  {
    id: "gmail-bill-456",
    type: "gmail",
    name: "Gmail Bills",
    enabled: true,
    syncFrequency: "weekly",
    lastSync: "2024-01-15T08:00:00Z",
    lastStatus: "success",
    gmailEmailAddress: "user@example.com",
    gmailFilters: ["from:billing@*"],
  },
  {
    id: "gocardless-sandbox-789",
    type: "gocardless",
    name: "European Bank",
    enabled: false,
    syncFrequency: "manual",
  },
]

/**
 * Sample complete configuration
 */
export const mockConfig: BillclawConfig = {
  version: 1,
  accounts: mockAccounts,
  webhooks: [
    {
      enabled: true,
      url: "https://example.com/webhook",
      secret: "webhook-secret-key",
      events: ["transaction.new", "sync.failed"],
      retryPolicy: {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 30000,
      },
    },
  ],
  storage: {
    path: "~/.firela/billclaw",
    format: "json",
    encryption: { enabled: false },
  },
  sync: {
    defaultFrequency: "daily",
    maxRetries: 3,
    retryOnFailure: true,
  },
  plaid: {
    clientId: "test-client-id",
    secret: "test-secret",
    environment: "sandbox",
  },
  gmail: {
    senderWhitelist: ["billing@*"],
    keywords: ["invoice", "receipt", "statement"],
    confidenceThreshold: 0.5,
    requireAmount: false,
    requireDate: false,
  },
  connect: {
    port: 4456,
    host: "localhost",
  },
  export: {
    format: "beancount",
    outputPath: "~/.firela/billclaw/exports",
    filePrefix: "transactions",
    includePending: false,
    currencyColumn: true,
  },
}

/**
 * Sample Gmail email content
 */
export const mockGmailEmails = [
  {
    id: "gmail-msg-001",
    from: "billing@company.com",
    subject: "Your invoice for January",
    body: `
      Dear Customer,

      Your invoice for January is ready.

      Amount Due: $89.00
      Due Date: January 31, 2024

      Thank you for your business.
    `,
    date: "2024-01-15T10:00:00Z",
  },
  {
    id: "gmail-msg-002",
    from: "receipt@store.com",
    subject: "Receipt for your purchase",
    body: `
      Thank you for your purchase!

      Item: Widget Pro
      Amount: $29.99
      Date: 01/16/2024
    `,
    date: "2024-01-16T14:30:00Z",
  },
]
