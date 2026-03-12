/**
 * API Response Types
 *
 * Shared type definitions for API responses.
 */

/**
 * Base API response
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Plaid Link token response
 */
export interface LinkTokenResponse {
  success: boolean
  linkToken?: string
  error?: string
}

/**
 * Gmail OAuth authorize response
 */
export interface GmailAuthorizeResponse {
  success: boolean
  authUrl?: string
  state?: string
  error?: string
}

/**
 * OAuth exchange response
 */
export interface OAuthExchangeResponse {
  success: boolean
  error?: string
}

/**
 * Generic webhook result response
 */
export interface WebhookResultResponse {
  success: boolean
  message?: string
  error?: string
}

/**
 * Generic API result response
 */
export interface ApiResultResponse {
  success: boolean
  message?: string
  error?: string
}
