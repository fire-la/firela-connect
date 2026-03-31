/**
 * Relay and GoCardless Types
 *
 * Frontend types for relay service health and GoCardless bank connection flow.
 */

/** Relay service health information */
export interface RelayHealthInfo {
  available: boolean
  configured: boolean
  latency?: number
  error?: string
  relayUrl?: string
  apiKeyMasked?: string
  lastChecked?: string
}

/** GoCardless institution (bank) from search results */
export interface GoCardlessInstitution {
  id: string
  name: string
  bic: string
  countries: string[]
  logo: string
  transaction_total_days: number
}

/** GoCardless requisition (OAuth link) */
export interface GoCardlessRequisition {
  id: string
  redirect: string
  status: string
  accounts: string[]
  reference: string
  link: string
}
