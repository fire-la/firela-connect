/**
 * UIAdapter Types
 *
 * Core interface for multi-environment UI deployment.
 * Enables the same React codebase to work in browser, CLI, and OpenClaw contexts.
 */

import type { RelayHealthInfo, GoCardlessInstitution, GoCardlessRequisition } from "../types/relay"

/**
 * Account information
 */
export interface Account {
  id: string
  name: string
  type: "plaid" | "gmail" | "gocardless"
  enabled: boolean
  lastSync?: string
  status: "connected" | "disconnected" | "error"
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean
  transactionsAdded: number
  error?: string
}

/**
 * Current sync status
 */
export interface SyncStatus {
  lastSync: string | null
  status: "idle" | "syncing" | "error"
  accounts: { id: string; name: string; lastSync: string | null }[]
}

/**
 * System status information
 */
export interface SystemStatus {
  version: string
  platform: string
  configPath: string
}

/**
 * BillClaw configuration (masked for UI display)
 */
export interface BillclawConfig {
  plaid?: {
    clientId?: string
    secret?: string // Masked as "***"
    env?: string
  }
  gmail?: {
    clientId?: string
    clientSecret?: string // Masked as "***"
    refreshToken?: string // Masked as "***"
  }
  ign?: {
    apiUrl?: string
    accessToken?: string // Masked as "***"
    region?: "cn" | "us" | "eu-core" | "de"
    upload?: {
      mode?: "auto" | "manual" | "disabled"
      sourceAccount?: string
      defaultCurrency?: string
      defaultExpenseAccount?: string
      defaultIncomeAccount?: string
      filterPending?: boolean
    }
  }
  export?: {
    format?: "beancount" | "ledger"
    outputPath?: string
    filePrefix?: string
    includePending?: boolean
    currencyColumn?: boolean
  }
  storage?: {
    path?: string
  }
  connect?: {
    publicUrl?: string
    connection?: {
      mode?: "auto" | "direct" | "polling"
      healthCheck?: {
        enabled?: boolean
        timeout?: number
        retries?: number
        retryDelay?: number
      }
    }
  }
}

/**
 * UIAdapter Interface
 *
 * Abstract interface for UI operations across different runtime environments.
 * Implementations:
 * - BrowserAdapter: Uses fetch API for HTTP communication
 * - (Future) CLIAdapter: Direct function calls to core
 * - (Future) OpenClawAdapter: Integration with OpenClaw runtime
 */
export interface UIAdapter {
  /**
   * Get the current BillClaw configuration (with sensitive fields masked)
   */
  getConfig(): Promise<BillclawConfig>

  /**
   * Update BillClaw configuration
   */
  updateConfig(config: Partial<BillclawConfig>): Promise<void>

  /**
   * List all connected accounts
   */
  listAccounts(): Promise<Account[]>

  /**
   * Initiate OAuth connection for a provider
   * Returns URL to redirect user to for authorization
   */
  connectAccount(provider: "plaid" | "gmail"): Promise<{ url: string }>

  /**
   * Disconnect an account
   */
  disconnectAccount(accountId: string): Promise<void>

  /**
   * Trigger sync for a specific account
   */
  syncAccount(accountId: string): Promise<SyncResult>

  /**
   * Get current sync status
   */
  getSyncStatus(): Promise<SyncStatus>

  /**
   * Get system status information
   */
  getSystemStatus(): Promise<SystemStatus>

  /**
   * Refresh Gmail OAuth token for an account
   * Used when access token expires during sync operations
   */
  refreshGmailToken(accountId: string): Promise<{
    success: boolean
    accessToken?: string
    expiresIn?: number
    error?: string
  }>

  /**
   * Update account settings
   * Currently supports updating enabled status
   */
  updateAccount(accountId: string, enabled: boolean): Promise<{
    success: boolean
    data?: Account
    error?: string
  }>

  /**
   * Search GoCardless institutions by country code
   */
  searchInstitutions(country: string): Promise<GoCardlessInstitution[]>

  /**
   * Create GoCardless requisition (start OAuth flow)
   */
  createRequisition(institutionId: string, redirectUrl: string): Promise<GoCardlessRequisition>

  /**
   * Poll requisition status after user authorizes
   */
  pollRequisitionStatus(requisitionId: string, accessToken: string): Promise<GoCardlessRequisition>

  /**
   * Get relay service health status
   */
  getRelayHealth(): Promise<RelayHealthInfo>
}
