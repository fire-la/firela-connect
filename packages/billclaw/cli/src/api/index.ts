/**
 * IGN API Client for BillClaw CLI
 *
 * Re-exports all API client functionality for easy importing.
 *
 * @example
 * ```typescript
 * import { configureApiClient, uploadTransactions } from '@firela/billclaw-cli/api'
 *
 * // Configure API client
 * configureApiClient({
 *   baseUrl: 'https://api.firela.com/api/v1',
 *   apiKey: process.env.IGN_API_KEY
 * })
 *
 * // Upload transactions
 * const result = await uploadTransactions('de', transactions)
 * ```
 */

// Client configuration
export {
  configureApiClient,
  handleApiError,
  isApiError,
  getApiConfig,
  getAuthHeaders,
  getBaseUrl,
  type ApiError,
  type CliApiConfig,
} from "./client.js"

// Transaction API
export {
  uploadTransactions,
  listRecentTransactions,
  getTransaction,
  type UploadResult,
} from "./transactions.js"
