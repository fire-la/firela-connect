/**
 * Framework-agnostic OAuth types and interfaces
 *
 * This module defines OAuth types that are independent of any
 * specific runtime (OpenClaw, CLI, standalone service, etc.)
 *
 * @packageDocumentation
 */

import { type Logger } from "../runtime/types.js"

/**
 * Plaid configuration
 */
export interface PlaidConfig {
  clientId: string
  secret: string
  environment: "sandbox" | "development" | "production"
}

/**
 * Gmail OAuth configuration (for OAuth flow only)
 */
export interface GmailOAuthConfig {
  clientId: string
  clientSecret?: string // Optional for PKCE
}

/**
 * Generic OAuth provider configuration
 */
export type OAuthConfig =
  | { provider: "plaid"; config: PlaidConfig }
  | { provider: "gmail"; config: GmailOAuthConfig }
  | { provider: string; config: unknown }

/**
 * Plaid Link token creation result
 */
export interface PlaidLinkTokenResult {
  linkToken: string
}

/**
 * Plaid public token exchange result
 */
export interface PlaidTokenExchangeResult {
  accessToken: string
  itemId: string
}

/**
 * Plaid OAuth handler result
 */
export interface PlaidOAuthResult {
  url: string
  token?: string // linkToken or accessToken
  itemId?: string
  accessToken?: string
}

/**
 * Gmail authorization URL result
 */
export interface GmailAuthUrlResult {
  url: string
  state: string
}

/**
 * Gmail token exchange result
 */
export interface GmailTokenResult {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

/**
 * Gmail OAuth handler result
 */
export interface GmailOAuthResult {
  url: string
  state?: string
  accessToken?: string
  refreshToken?: string
  expiresIn?: number
}

/**
 * OAuth context for callbacks
 */
export interface OAuthContext {
  // Plaid callback
  publicToken?: string

  // Gmail callback
  code?: string
  state?: string
  redirectUri?: string

  // Common
  accountId?: string
}

/**
 * OAuth handler options
 */
export interface OAuthHandlerOptions {
  logger?: Logger
  config: OAuthConfig
}
