/**
 * Unified credential store interface for BillClaw
 *
 * Provides a consistent API for storing and retrieving credentials,
 * with support for both keychain storage (secure) and in-memory
 * fallback for development/testing.
 */

import type { Logger } from "../errors/errors.js"
import * as keychain from "./keychain.js"

/**
 * Credential storage strategy
 */
export enum CredentialStrategy {
  /** Store in platform keychain (recommended for production) */
  KEYCHAIN = "keychain",

  /** Store in memory only (for testing/development, NOT secure) */
  MEMORY = "memory",
}

/**
 * Credential store configuration
 */
export interface CredentialStoreConfig {
  strategy: CredentialStrategy
  logger?: Logger
}

/**
 * In-memory credential storage (NOT secure - for testing only)
 */
class MemoryCredentialStore {
  private credentials = new Map<string, string>()

  async set(key: string, value: string): Promise<void> {
    this.credentials.set(key, value)
  }

  async get(key: string): Promise<string | null> {
    return this.credentials.get(key) || null
  }

  async delete(key: string): Promise<boolean> {
    return this.credentials.delete(key)
  }

  async has(key: string): Promise<boolean> {
    return this.credentials.has(key)
  }

  async list(): Promise<string[]> {
    return Array.from(this.credentials.keys())
  }

  async clear(): Promise<void> {
    this.credentials.clear()
  }
}

/**
 * Unified credential store
 */
export class CredentialStore {
  private memoryStore: MemoryCredentialStore
  private config: CredentialStoreConfig

  constructor(config: CredentialStoreConfig) {
    this.config = config
    this.memoryStore = new MemoryCredentialStore()
  }

  /**
   * Store a credential
   *
   * @param key - Credential identifier
   * @param value - Sensitive value to store
   */
  async set(key: string, value: string): Promise<void> {
    if (this.config.strategy === CredentialStrategy.KEYCHAIN) {
      await keychain.setCredential(key, value, this.config.logger)
    } else {
      await this.memoryStore.set(key, value)
      this.config.logger?.warn?.(
        `Stored credential in memory (NOT SECURE): ${key}`,
      )
    }
  }

  /**
   * Retrieve a credential
   *
   * @param key - Credential identifier
   * @returns The credential value, or null if not found
   */
  async get(key: string): Promise<string | null> {
    if (this.config.strategy === CredentialStrategy.KEYCHAIN) {
      return keychain.getCredential(key, this.config.logger)
    } else {
      return this.memoryStore.get(key)
    }
  }

  /**
   * Delete a credential
   *
   * @param key - Credential identifier
   * @returns true if the credential was deleted
   */
  async delete(key: string): Promise<boolean> {
    if (this.config.strategy === CredentialStrategy.KEYCHAIN) {
      return keychain.deleteCredential(key, this.config.logger)
    } else {
      return this.memoryStore.delete(key)
    }
  }

  /**
   * Check if a credential exists
   *
   * @param key - Credential identifier
   * @returns true if the credential exists
   */
  async has(key: string): Promise<boolean> {
    if (this.config.strategy === CredentialStrategy.KEYCHAIN) {
      return keychain.hasCredential(key, this.config.logger)
    } else {
      return this.memoryStore.has(key)
    }
  }

  /**
   * List all credential keys
   *
   * @returns Array of credential keys
   */
  async list(): Promise<string[]> {
    if (this.config.strategy === CredentialStrategy.KEYCHAIN) {
      return keychain.listCredentialKeys()
    } else {
      return this.memoryStore.list()
    }
  }

  /**
   * Clear all credentials
   */
  async clear(): Promise<void> {
    const keys = await this.list()

    if (this.config.strategy === CredentialStrategy.KEYCHAIN) {
      await keychain.clearAllCredentials(keys, this.config.logger)
    } else {
      await this.memoryStore.clear()
    }
  }
}

/**
 * Create a credential store with the given configuration
 */
export function createCredentialStore(
  config: CredentialStoreConfig,
): CredentialStore {
  return new CredentialStore(config)
}

// Re-export keychain utilities for convenience
export * from "./keychain.js"
