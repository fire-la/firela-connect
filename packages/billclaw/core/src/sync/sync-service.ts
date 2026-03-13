/**
 * Sync service for BillClaw - Framework-agnostic background sync logic
 */

import type { AccountConfig } from "../models/config.js"
import type { Logger, UserError } from "../errors/errors.js"
import { parseNetworkError } from "../errors/errors.js"

export interface SyncResult {
  accountId: string
  success: boolean
  transactionsAdded: number
  transactionsUpdated: number
  errors?: UserError[]
}

export interface SyncServiceState {
  isRunning: boolean
  lastSync: string | null
  nextSync: string | null
  accountsSynced: number
}

/**
 * Sync function interface - adapters provide the actual sync implementation
 */
export interface SyncProvider {
  syncAccount(accountId: string): Promise<SyncResult>
}

/**
 * Calculate next sync time based on sync frequency
 */
export function calculateNextSync(frequency: string, lastSync?: Date): Date {
  const now = new Date()
  const base = lastSync || now

  switch (frequency) {
    case "realtime":
      // Webhook-based, no scheduled sync
      return new Date(0)

    case "hourly":
      return new Date(base.getTime() + 60 * 60 * 1000)

    case "daily":
      // Next day at same time
      const nextDay = new Date(base)
      nextDay.setDate(nextDay.getDate() + 1)
      return nextDay

    case "weekly":
      // Next week on same day
      const nextWeek = new Date(base)
      nextWeek.setDate(nextWeek.getDate() + 7)
      return nextWeek

    case "manual":
      // No scheduled sync
      return new Date(0)

    default:
      return new Date(base.getTime() + 24 * 60 * 60 * 1000)
  }
}

/**
 * Check if an account is due for sync
 */
export function isDueForSync(account: AccountConfig): boolean {
  if (!account.enabled || !account.lastSync) {
    return true
  }

  const lastSync = new Date(account.lastSync)
  const nextSync = calculateNextSync(account.syncFrequency, lastSync)

  // Manual accounts never sync automatically
  if (account.syncFrequency === "manual") {
    return false
  }

  // Realtime accounts sync via webhook, not scheduled
  if (account.syncFrequency === "realtime") {
    return false
  }

  return new Date() >= nextSync
}

/**
 * Sync a single account using the provided sync provider
 */
async function syncAccount(
  accountId: string,
  syncProvider: SyncProvider,
  logger: Logger,
): Promise<SyncResult> {
  try {
    const result = await syncProvider.syncAccount(accountId)

    if (result.success) {
      logger.info?.(
        `Sync completed for ${accountId}: ${result.transactionsAdded} added, ${result.transactionsUpdated} updated`,
      )
    } else {
      logger.error?.(`Sync failed for ${accountId}:`, result.errors || [])
    }

    return result
  } catch (error) {
    logger.error?.(`Error syncing ${accountId}:`, error)
    // Convert error to UserError
    const userError =
      error instanceof Error
        ? parseNetworkError(error)
        : parseNetworkError(new Error(String(error)))

    return {
      accountId,
      success: false,
      transactionsAdded: 0,
      transactionsUpdated: 0,
      errors: [userError],
    }
  }
}

/**
 * Sync all accounts that are due for sync
 *
 * @param accounts - All configured accounts
 * @param syncProvider - Provider that implements the actual sync logic
 * @param logger - Logger for output
 * @returns Array of sync results
 */
export async function syncDueAccounts(
  accounts: AccountConfig[],
  syncProvider: SyncProvider,
  logger: Logger,
): Promise<SyncResult[]> {
  logger.info?.("BillClaw sync service started")

  // Filter for enabled accounts
  const enabledAccounts = accounts.filter((acc) => acc.enabled)

  if (enabledAccounts.length === 0) {
    logger.info?.("No enabled accounts to sync")
    return []
  }

  logger.info?.(`Found ${enabledAccounts.length} enabled accounts to check`)

  const results: SyncResult[] = []
  let syncedCount = 0

  for (const account of enabledAccounts) {
    if (isDueForSync(account)) {
      logger.info?.(`Syncing account: ${account.name} (${account.id})`)
      const result = await syncAccount(account.id, syncProvider, logger)
      results.push(result)
      if (result.success) {
        syncedCount++
      }
    } else {
      logger.info?.(
        `Skipping ${account.name} (${account.id}): not due for sync`,
      )
    }
  }

  logger.info?.(`Sync service completed: ${syncedCount} accounts synced`)

  return results
}
