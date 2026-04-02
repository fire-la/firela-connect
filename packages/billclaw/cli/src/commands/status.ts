/**
 * Status command
 *
 * Show connection status and recent sync results.
 */

import type { CliCommand, CliContext } from "./registry.js"
import {
  createTable,
  printTable,
  formatStatus,
  formatAccountType,
  formatDate,
} from "../utils/format.js"
import {
  Billclaw,
  getStorageDir,
  UploadStatusStore,
  type SyncState,
} from "@firela/billclaw-core"
import * as fs from "node:fs/promises"
import * as path from "node:path"

/**
 * Storage statistics
 */
interface StorageStats {
  accountId: string
  totalTransactions: number
  storageSize: string
  storageSizeBytes: number
  firstTransaction: string | null
  lastTransaction: string | null
}

/**
 * Calculate storage statistics for an account
 */
async function getStorageStats(
  accountId: string,
  storagePath: string,
): Promise<StorageStats> {
  const transactionsDir = path.join(storagePath, "transactions", accountId)

  let totalTransactions = 0
  let firstTransaction: string | null = null
  let lastTransaction: string | null = null
  let totalSize = 0

  try {
    const years = await fs.readdir(transactionsDir)

    for (const year of years) {
      const yearPath = path.join(transactionsDir, year)
      const months = await fs.readdir(yearPath)

      for (const month of months) {
        const monthPath = path.join(yearPath, month)
        const stats = await fs.stat(monthPath)

        // Read and count transactions
        const transactions = JSON.parse(await fs.readFile(monthPath, "utf-8"))
        totalTransactions += transactions.length

        // Track dates
        if (transactions.length > 0) {
          const dates = transactions.map((t: { date: string }) => t.date).sort()
          if (!firstTransaction || dates[0] < firstTransaction) {
            firstTransaction = dates[0]
          }
          if (!lastTransaction || dates[dates.length - 1] > lastTransaction) {
            lastTransaction = dates[dates.length - 1]
          }
        }

        totalSize += stats.size
      }
    }
  } catch {
    // Directory doesn't exist yet
  }

  return {
    accountId,
    totalTransactions,
    storageSize: formatBytes(totalSize),
    storageSizeBytes: totalSize,
    firstTransaction,
    lastTransaction,
  }
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Get recent sync results for all accounts
 */
async function getRecentSyncResults(
  accounts: Array<{ id: string }>,
  billclaw: Billclaw,
  limit: number = 5,
): Promise<Array<SyncState & { accountName: string }>> {
  const allSyncs: Array<SyncState & { accountName: string }> = []

  for (const account of accounts) {
    try {
      const syncStates = await billclaw.getSyncStates(account.id)
      const accountSyncs = syncStates
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, limit)
        .map((sync) => ({
          ...sync,
          accountName: account.id,
        }))

      allSyncs.push(...accountSyncs)
    } catch {
      // Skip accounts that don't have sync states yet
    }
  }

  return allSyncs
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit)
}

/**
 * Run status command
 */
async function runStatus(context: CliContext): Promise<void> {
  const { runtime } = context
  const billclaw = new Billclaw(runtime)
  const config = await runtime.config.getConfig()

  const accounts = await billclaw.getAccounts()

  if (accounts.length === 0) {
    console.log("No accounts configured. Run 'billclaw setup' first.")
    return
  }

  console.log("")
  console.log("BillClaw Status")
  console.log("")

  // Accounts table
  const accountsTable = createTable({
    head: ["Account ID", "Type", "Status", "Last Sync"],
  })

  for (const account of accounts) {
    accountsTable.push([
      account.id,
      formatAccountType(account.type),
      formatStatus(account.lastStatus ?? "unknown"),
      account.lastSync ? formatDate(account.lastSync) : "Never",
    ])
  }

  printTable(accountsTable)

  // Storage Statistics
  console.log("")
  console.log("Storage Statistics")

  const storageConfig = await runtime.config.getStorageConfig()
  const storagePath = await getStorageDir(storageConfig)

  const statsTable = createTable({
    head: ["Account", "Transactions", "Size", "First", "Last"],
  })

  let totalTransactions = 0
  let totalSize = 0

  for (const account of accounts) {
    const stats = await getStorageStats(account.id, storagePath)
    statsTable.push([
      account.id,
      stats.totalTransactions.toString(),
      stats.storageSize,
      stats.firstTransaction ? formatDate(stats.firstTransaction) : "N/A",
      stats.lastTransaction ? formatDate(stats.lastTransaction) : "N/A",
    ])

    totalTransactions += stats.totalTransactions
    const sizeBytes = parseFloat(stats.storageSize)
    const _unit = stats.storageSize.split(" ")[1]
    totalSize += sizeBytes
  }

  printTable(statsTable)

  // Totals row
  console.log(
    `Total: ${totalTransactions} transactions, ${formatBytes(totalSize * 1024)}`,
  )

  // Firela Vault Upload Status (if configured)
  if (config.vlt?.accessToken) {
    console.log("")
    console.log("Firela Vault Upload Status")

    const uploadStatusStore = new UploadStatusStore(storageConfig)
    const uploadTable = createTable({
      head: ["Account", "Last Upload", "Imported", "Skipped", "Review", "Status"],
    })

    for (const account of accounts) {
      const uploadStatus = await uploadStatusStore.readStatus(account.id)
      if (uploadStatus) {
        uploadTable.push([
          account.id,
          uploadStatus.lastUploadAt
            ? formatDate(uploadStatus.lastUploadAt)
            : "Never",
          uploadStatus.lastUploadResult?.imported?.toString() || "0",
          uploadStatus.lastUploadResult?.skipped?.toString() || "0",
          uploadStatus.lastUploadResult?.pendingReview?.toString() || "0",
          uploadStatus.status,
        ])
      } else {
        uploadTable.push([
          account.id,
          "Never",
          "-",
          "-",
          "-",
          "pending",
        ])
      }
    }

    printTable(uploadTable)
  }

  // Recent Sync Results
  console.log("")
  console.log("Recent Sync Results")

  const recentSyncs = await getRecentSyncResults(accounts, billclaw)

  if (recentSyncs.length === 0) {
    console.log("No sync history available.")
  } else {
    const syncTable = createTable({
      head: ["Account", "Status", "Added", "Updated", "Time"],
    })

    for (const sync of recentSyncs) {
      syncTable.push([
        sync.accountName,
        formatStatus(sync.status),
        sync.transactionsAdded.toString(),
        sync.transactionsUpdated.toString(),
        formatDate(sync.startedAt),
      ])
    }

    printTable(syncTable)
  }

  // VLT Configuration Section
  if (config.vlt) {
    console.log("")
    console.log("Firela Vault Integration:")
    console.log(`  Region: ${config.vlt.region}`)
    console.log(`  Upload mode: ${config.vlt.upload?.mode || "not configured"}`)
    console.log(`  API URL: ${config.vlt.apiUrl}`)
    console.log(`  Configured: ${config.vlt.accessToken ? "Yes" : "No"}`)
  }

  // Status summary
  console.log("")
  const enabledCount = accounts.filter((a) => a.enabled).length
  const disabledCount = accounts.length - enabledCount

  console.log("Summary:")
  console.log(`  Total accounts: ${accounts.length}`)
  console.log(`  Enabled: ${enabledCount}`)
  console.log(`  Disabled: ${disabledCount}`)

  if (accounts.some((a: any) => a.requiresReauth)) {
    console.log("  ⚠️  Some accounts require re-authentication")
  }
}

/**
 * Status command definition
 */
export const statusCommand: CliCommand = {
  name: "status",
  description: "Show connection status and recent sync results",
  handler: runStatus,
}
