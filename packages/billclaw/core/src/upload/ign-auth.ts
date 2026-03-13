/**
 * IGN (Firela Vault) Authentication Manager
 *
 * Provides fully automatic authentication for Firela Vault integration:
 * - Exchanges accessToken for JWT token via /auth/sessions/anonymous
 * - Caches JWT token in system keychain
 * - Auto-refreshes JWT token before expiry (180-day validity)
 *
 * @packageDocumentation
 */

import { KeychainKeys } from "../credentials/keychain.js"
import type { Logger } from "../errors/errors.js"
import type { IgnConfig } from "../models/config.js"
import type { CredentialStore } from "../credentials/store.js"

/**
 * JWT token response from IGN /auth/sessions/anonymous endpoint
 */
interface IgnAuthResponse {
  authToken: string
}

/**
 * Cached token data stored in keychain
 */
interface CachedToken {
  token: string
  expiresAt: string | null
}

/**
 * Configuration for IgnAuthManager
 */
export interface IgnAuthManagerConfig {
  /** JWT token expiry in days (default: 180) */
  tokenExpiryDays?: number
  /** Refresh threshold in days before expiry (default: 30) */
  refreshThresholdDays?: number
  /** Background refresh interval in days (default: 7) */
  backgroundRefreshIntervalDays?: number
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<IgnAuthManagerConfig> = {
  tokenExpiryDays: 180,
  refreshThresholdDays: 30,
  backgroundRefreshIntervalDays: 7,
}

/**
 * IGN (Firela Vault) Authentication Manager
 *
 * Manages automatic authentication for Firela Vault integration:
 * 1. Checks keychain for cached JWT token
 * 2. If no valid token, exchanges accessToken for JWT
 * 3. Stores JWT in keychain with expiry time
 * 4. Background refresh to keep token valid
 *
 * @example
 * ```typescript
 * const authManager = new IgnAuthManager(ignConfig, credentialStore, logger)
 *
 * // Get valid JWT token (auto-refresh if needed)
 * const jwtToken = await authManager.ensureValidToken()
 *
 * // Start background refresh (optional)
 * authManager.startBackgroundRefresh()
 *
 * // Stop background refresh when done
 * authManager.stopBackgroundRefresh()
 * ```
 */
export class IgnAuthManager {
  private refreshInterval: ReturnType<typeof setInterval> | null = null
  private readonly config: Required<IgnAuthManagerConfig>

  constructor(
    private readonly ignConfig: IgnConfig,
    private readonly credentialStore: CredentialStore,
    private readonly logger?: Logger,
    config?: IgnAuthManagerConfig,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Ensure a valid JWT token is available
   *
   * Flow:
   * 1. Check keychain for cached token
   * 2. If valid and not expiring soon, return cached token
   * 3. Otherwise, exchange accessToken for new JWT
   *
   * @returns Valid JWT token
   * @throws Error if accessToken is not configured or exchange fails
   */
  async ensureValidToken(): Promise<string> {
    // 1. Check keychain for cached token
    const cachedToken = await this.getCachedToken()

    // 2. If valid and not expiring soon, return it
    if (cachedToken && !this.isTokenExpiringSoon(cachedToken.expiresAt)) {
      this.logger?.debug?.("Using cached IGN JWT token")
      return cachedToken.token
    }

    // 3. Exchange accessToken for new JWT
    this.logger?.info?.("Obtaining new IGN JWT token...")
    return this.exchangeAccessToken()
  }

  /**
   * Start background token refresh
   *
   * Periodically checks if token needs refresh and refreshes if needed.
   * This ensures the JWT token is always valid even for long-running processes.
   */
  startBackgroundRefresh(): void {
    if (this.refreshInterval) {
      this.logger?.debug?.("Background refresh already running")
      return
    }

    const intervalMs = this.config.backgroundRefreshIntervalDays * 24 * 60 * 60 * 1000

    this.logger?.debug?.(
      `Starting IGN token background refresh (every ${this.config.backgroundRefreshIntervalDays} days)`,
    )

    this.refreshInterval = setInterval(async () => {
      try {
        await this.ensureValidToken()
      } catch (error) {
        this.logger?.error?.("IGN background token refresh failed:", error)
      }
    }, intervalMs)
  }

  /**
   * Stop background token refresh
   *
   * Call this when the auth manager is no longer needed to prevent memory leaks.
   */
  stopBackgroundRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
      this.logger?.debug?.("Stopped IGN token background refresh")
    }
  }

  /**
   * Clear cached JWT token
   *
   * Forces a fresh token exchange on next ensureValidToken() call.
   */
  async clearCachedToken(): Promise<void> {
    await this.credentialStore.delete(KeychainKeys.ignJwtToken())
    await this.credentialStore.delete(KeychainKeys.ignJwtExpiresAt())
    this.logger?.debug?.("Cleared cached IGN JWT token")
  }

  /**
   * Get cached token from keychain
   */
  private async getCachedToken(): Promise<CachedToken | null> {
    const token = await this.credentialStore.get(KeychainKeys.ignJwtToken())
    const expiresAt = await this.credentialStore.get(KeychainKeys.ignJwtExpiresAt())

    if (!token) {
      return null
    }

    return {
      token,
      expiresAt: expiresAt ?? null,
    }
  }

  /**
   * Check if token is expiring soon
   *
   * @param expiresAt - ISO timestamp of token expiry
   * @returns true if token expires within threshold days
   */
  private isTokenExpiringSoon(expiresAt: string | null): boolean {
    if (!expiresAt) {
      return true // No expiry info, treat as expiring
    }

    const expiresDate = new Date(expiresAt)
    const now = new Date()
    const diffDays = (expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

    return diffDays < this.config.refreshThresholdDays
  }

  /**
   * Exchange accessToken for JWT token
   *
   * Calls IGN /auth/sessions/anonymous endpoint to exchange the long-lived
   * accessToken (from Firela Vault app) for a JWT token.
   *
   * @returns JWT token
   * @throws Error if accessToken is not configured or exchange fails
   */
  private async exchangeAccessToken(): Promise<string> {
    if (!this.ignConfig.accessToken) {
      throw new Error(
        "IGN accessToken not configured. Please add ign.accessToken to your config. " +
          "You can get an access token from the Firela Vault app.",
      )
    }

    const url = `${this.ignConfig.apiUrl}/${this.ignConfig.region}/auth/sessions/anonymous`

    this.logger?.debug?.(`Exchanging IGN accessToken for JWT at ${url}`)

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: this.ignConfig.accessToken }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error")
      throw new Error(
        `IGN authentication failed: ${response.status} ${response.statusText}. ${errorText}`,
      )
    }

    const data = (await response.json()) as IgnAuthResponse

    if (!data.authToken) {
      throw new Error("IGN authentication response missing authToken")
    }

    // Calculate expiry time (180 days from now)
    const expiresAt = new Date(
      Date.now() + this.config.tokenExpiryDays * 24 * 60 * 60 * 1000,
    ).toISOString()

    // Store JWT and expiry in keychain
    await this.credentialStore.set(KeychainKeys.ignJwtToken(), data.authToken)
    await this.credentialStore.set(KeychainKeys.ignJwtExpiresAt(), expiresAt)

    this.logger?.info?.(
      `Obtained new IGN JWT token (expires: ${expiresAt})`,
    )

    return data.authToken
  }
}
