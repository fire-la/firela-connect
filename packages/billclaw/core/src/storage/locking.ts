/**
 * File locking for BillClaw
 *
 * Provides inter-process file locking to prevent concurrent write conflicts.
 * Uses proper-lockfile for cross-platform file locking.
 *
 * Use cases:
 * - Preventing concurrent sync operations
 * - Protecting credential writes
 * - Coordinating between multiple processes
 */

import type { Logger } from "../errors/errors.js"

// Lockfile module (lazy loaded)
let lockfileModule: typeof import("proper-lockfile") | null = null

/**
 * Initialize lockfile module
 */
async function initLockfile(): Promise<typeof import("proper-lockfile")> {
  if (!lockfileModule) {
    try {
      lockfileModule = await import("proper-lockfile")
    } catch {
      throw new Error(
        "proper-lockfile is not installed. Install it with: npm install proper-lockfile",
      )
    }
  }
  return lockfileModule
}

/**
 * Lock options
 */
export interface LockOptions {
  /**
   * Lock stale time in milliseconds
   * If a lock is older than this, it will be considered stale and released
   */
  stale?: number

  /**
   * Retry options
   */
  retries?: {
    /**
     * Number of retries to acquire the lock
     */
    count?: number

    /**
     * Delay between retries in milliseconds
     */
    min?: number
    max?: number
  }

  /**
   * Logger for debug output
   */
  logger?: Logger
}

/**
 * Default lock options
 */
const DEFAULT_LOCK_OPTIONS: Required<Omit<LockOptions, "logger">> = {
  stale: 60 * 1000, // 1 minute
  retries: {
    count: 10,
    min: 100,
    max: 500,
  },
}

/**
 * Lock handle
 */
export interface Lock {
  /**
   * Release the lock
   */
  release(): Promise<void>

  /**
   * Check if the lock is still held
   */
  isLocked(): Promise<boolean>
}

/**
 * File lock implementation
 */
class FileLock implements Lock {
  private released = false

  constructor(
    private filePath: string,
    private logger?: Logger,
  ) {}

  async release(): Promise<void> {
    if (this.released) {
      return
    }

    const lockfile = await initLockfile()

    try {
      await lockfile.unlock(this.filePath)
      this.released = true
      this.logger?.debug?.(`Released lock: ${this.filePath}`)
    } catch (error) {
      this.logger?.error?.(`Failed to release lock: ${this.filePath}`, error)
      throw error
    }
  }

  async isLocked(): Promise<boolean> {
    if (this.released) {
      return false
    }

    const lockfile = await initLockfile()
    return lockfile.check(this.filePath)
  }
}

/**
 * Acquire a file lock
 *
 * @param filePath - Path to the file to lock
 * @param options - Lock options
 * @returns Lock handle that must be released when done
 */
export async function acquireLock(
  filePath: string,
  options: LockOptions = {},
): Promise<Lock> {
  const opts = { ...DEFAULT_LOCK_OPTIONS, ...options }
  const lockfile = await initLockfile()

  try {
    await lockfile.lock(filePath, {
      stale: opts.stale,
      retries: opts.retries
        ? {
            retries: opts.retries.count,
            minTimeout: opts.retries.min,
            maxTimeout: opts.retries.max,
          }
        : undefined,
    })

    options.logger?.debug?.(`Acquired lock: ${filePath}`)
    return new FileLock(filePath, options.logger)
  } catch (error) {
    options.logger?.error?.(`Failed to acquire lock: ${filePath}`, error)
    throw new Error(
      `Failed to acquire lock on ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

/**
 * Execute a function while holding a lock
 *
 * @param filePath - Path to the file to lock
 * @param fn - Function to execute while holding the lock
 * @param options - Lock options
 * @returns Result of the function
 */
export async function withLock<T>(
  filePath: string,
  fn: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const lock = await acquireLock(filePath, options)

  try {
    return await fn()
  } finally {
    await lock.release()
  }
}

/**
 * Check if a file is locked
 *
 * @param filePath - Path to the file to check
 * @returns true if the file is locked
 */
export async function isLocked(filePath: string): Promise<boolean> {
  const lockfile = await initLockfile()
  return lockfile.check(filePath)
}

/**
 * Lock names for common operations
 */
export const LockNames = {
  /**
   * Global sync lock (prevents concurrent sync operations)
   */
  SYNC: ".sync.lock",

  /**
   * Account-specific sync lock
   */
  accountSync(accountId: string): string {
    return `.sync_${accountId}.lock`
  },

  /**
   * Credential lock (protects credential writes)
   */
  CREDENTIALS: ".credentials.lock",

  /**
   * Account-specific credential lock
   */
  accountCredentials(accountId: string): string {
    return `.credentials_${accountId}.lock`
  },

  /**
   * Export lock (protects data export operations)
   */
  EXPORT: ".export.lock",

  /**
   * Configuration lock (protects config file writes)
   */
  CONFIG: ".config.lock",
}
