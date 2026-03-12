/**
 * Platform keychain credential storage for BillClaw
 *
 * Uses keytar to securely store sensitive tokens in the platform keychain:
 * - macOS: Keychain
 * - Windows: Credential Manager
 * - Linux: Secret Service API / KWallet
 *
 * This provides P0 security for:
 * - Plaid access tokens
 * - Gmail refresh tokens
 * - GoCardless access tokens
 */

import type { Logger } from "../errors/errors.js"

// Keytar is an optional dependency - will be installed by adapter
let keytarModule: typeof import("keytar") | null = null

/**
 * Initialize keytar module
 * Call this before using keychain functions
 */
export async function initKeytar(): Promise<void> {
  if (!keytarModule) {
    try {
      keytarModule = await import("keytar")
    } catch {
      throw new Error(
        "keytar is not installed. Install it with: npm install keytar",
      )
    }
  }
}

/**
 * Service name for BillClaw in keychain
 */
const KEYCHAIN_SERVICE = "billclaw"

/**
 * Store a credential in the platform keychain
 *
 * @param key - Credential identifier (e.g., "plaid_access_token:account123")
 * @param value - Sensitive value to store (e.g., access token)
 * @param logger - Optional logger for audit logging
 */
export async function setCredential(
  key: string,
  value: string,
  logger?: Logger,
): Promise<void> {
  await initKeytar()

  const keytar = keytarModule!

  try {
    await keytar.setPassword(KEYCHAIN_SERVICE, key, value)
    logger?.debug?.(`Stored credential in keychain: ${key}`)
  } catch (error) {
    logger?.error?.(`Failed to store credential in keychain: ${key}`, error)
    throw new Error(
      `Failed to store credential in keychain: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

/**
 * Retrieve a credential from the platform keychain
 *
 * @param key - Credential identifier
 * @param logger - Optional logger for audit logging
 * @returns The credential value, or null if not found
 */
export async function getCredential(
  key: string,
  logger?: Logger,
): Promise<string | null> {
  await initKeytar()

  const keytar = keytarModule!

  try {
    const value = await keytar.getPassword(KEYCHAIN_SERVICE, key)

    if (value !== null) {
      logger?.debug?.(`Retrieved credential from keychain: ${key}`)
    } else {
      logger?.debug?.(`Credential not found in keychain: ${key}`)
    }

    return value
  } catch (error) {
    logger?.error?.(
      `Failed to retrieve credential from keychain: ${key}`,
      error,
    )
    throw new Error(
      `Failed to retrieve credential from keychain: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

/**
 * Delete a credential from the platform keychain
 *
 * @param key - Credential identifier
 * @param logger - Optional logger for audit logging
 * @returns true if the credential was deleted, false if it didn't exist
 */
export async function deleteCredential(
  key: string,
  logger?: Logger,
): Promise<boolean> {
  await initKeytar()

  const keytar = keytarModule!

  try {
    const result = await keytar.deletePassword(KEYCHAIN_SERVICE, key)

    if (result) {
      logger?.debug?.(`Deleted credential from keychain: ${key}`)
    } else {
      logger?.debug?.(
        `Credential not found in keychain (could not delete): ${key}`,
      )
    }

    return result
  } catch (error) {
    logger?.error?.(`Failed to delete credential from keychain: ${key}`, error)
    throw new Error(
      `Failed to delete credential from keychain: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

/**
 * Check if a credential exists in the keychain
 *
 * @param key - Credential identifier
 * @param logger - Optional logger for audit logging
 * @returns true if the credential exists
 */
export async function hasCredential(
  key: string,
  logger?: Logger,
): Promise<boolean> {
  const value = await getCredential(key, logger)
  return value !== null
}

/**
 * List all credential keys for BillClaw
 *
 * Note: keytar doesn't provide a direct way to list all keys,
 * so this returns empty array. Applications should track
 * their own credential keys separately.
 *
 * @returns Empty array (keytar limitation)
 */
export async function listCredentialKeys(): Promise<string[]> {
  // keytar doesn't support listing keys
  // Applications should maintain their own registry
  return []
}

/**
 * Clear all BillClaw credentials from the keychain
 *
 * WARNING: This is a destructive operation. Use with caution.
 *
 * @param keys - List of credential keys to delete
 * @param logger - Optional logger for audit logging
 */
export async function clearAllCredentials(
  keys: string[],
  logger?: Logger,
): Promise<void> {
  logger?.warn?.(`Clearing ${keys.length} credentials from keychain`)

  for (const key of keys) {
    await deleteCredential(key, logger)
  }

  logger?.info?.(`Cleared all credentials from keychain`)
}

/**
 * Keychain utility functions for building credential keys
 */
export const KeychainKeys = {
  /**
   * Build a Plaid access token key
   */
  plaidAccessToken(accountId: string): string {
    return `plaid_access_token:${accountId}`
  },

  /**
   * Build a Gmail refresh token key
   */
  gmailRefreshToken(accountId: string): string {
    return `gmail_refresh_token:${accountId}`
  },

  /**
   * Build a GoCardless access token key
   */
  gocardlessAccessToken(accountId: string): string {
    return `gocardless_access_token:${accountId}`
  },

  /**
   * Build a GoCardless requisition ID key
   */
  gocardlessRequisitionId(accountId: string): string {
    return `gocardless_requisition_id:${accountId}`
  },

  /**
   * IGN (Firela Vault) JWT token key
   *
   * Stores the JWT token obtained from /auth/sessions/anonymous endpoint.
   * JWT token is valid for 180 days and auto-refreshed by IgnAuthManager.
   */
  ignJwtToken(): string {
    return "ign_jwt_token"
  },

  /**
   * IGN (Firela Vault) JWT token expiry timestamp (ISO string)
   *
   * Used to track when the JWT token needs to be refreshed.
   */
  ignJwtExpiresAt(): string {
    return "ign_jwt_expires_at"
  },
}
