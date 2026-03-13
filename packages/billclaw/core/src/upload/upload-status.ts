/**
 * Upload status tracking for IGN integration
 *
 * Persists upload status per account for visibility and debugging.
 * Uses file-based storage with atomic writes.
 *
 * @packageDocumentation
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import type { StorageConfig } from "../models/config.js"
import type { IgnUploadResult } from "./ign-client.js"

/**
 * IGN upload status for an account
 */
export interface IgnUploadStatus {
  /** Account ID */
  accountId: string
  /** Last upload timestamp (ISO) */
  lastUploadAt?: string
  /** Result of last upload */
  lastUploadResult?: IgnUploadResult
  /** Current status */
  status: "success" | "failed" | "disabled"
  /** Error message if failed */
  errorMessage?: string
}

/**
 * Get the upload status storage directory
 */
async function getUploadStatusDir(config?: StorageConfig): Promise<string> {
  const storagePath = config?.path || "~/.firela/billclaw"
  const expandedPath = storagePath.replace(/^~/, os.homedir())
  return path.join(expandedPath, "upload-status")
}

/**
 * Store for tracking IGN upload status per account
 *
 * Persists upload status to `.billclaw/upload-status/{accountId}.json`
 * Uses atomic writes for safety.
 *
 * @example
 * ```typescript
 * const store = new UploadStatusStore(storageConfig)
 *
 * // Read status
 * const status = await store.readStatus('account-123')
 *
 * // Write status
 * await store.writeStatus('account-123', {
 *   accountId: 'account-123',
 *   status: 'success',
 *   lastUploadAt: new Date().toISOString(),
 *   lastUploadResult: { imported: 10, skipped: 2, pendingReview: 0, failed: 0 }
 * })
 * ```
 */
export class UploadStatusStore {
  constructor(private readonly config?: StorageConfig) {}

  /**
   * Read upload status for an account
   *
   * @param accountId - Account ID
   * @returns Upload status or null if not found
   */
  async readStatus(accountId: string): Promise<IgnUploadStatus | null> {
    const dir = await getUploadStatusDir(this.config)
    const filePath = path.join(dir, `${accountId}.json`)

    try {
      const content = await fs.readFile(filePath, "utf-8")
      return JSON.parse(content) as IgnUploadStatus
    } catch {
      return null
    }
  }

  /**
   * Write upload status for an account
   *
   * Uses atomic write (temp file + rename) for safety.
   *
   * @param accountId - Account ID
   * @param status - Upload status to persist
   */
  async writeStatus(accountId: string, status: IgnUploadStatus): Promise<void> {
    const dir = await getUploadStatusDir(this.config)
    const filePath = path.join(dir, `${accountId}.json`)

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true })

    // Atomic write: write to temp file first, then rename
    const tempPath = filePath + ".tmp"
    await fs.writeFile(tempPath, JSON.stringify(status, null, 2), "utf-8")
    await fs.rename(tempPath, filePath)
  }
}
