/**
 * Webhook handlers for different data sources
 *
 * Protocol-specific implementations for processing webhooks from
 * Plaid, GoCardless, Gmail, etc.
 */

export * from "./plaid.js"
export * from "./gocardless.js"
export * from "./gmail.js"
