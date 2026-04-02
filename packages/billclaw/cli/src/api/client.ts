/**
 * VLT API Client for BillClaw CLI
 *
 * Configures the @firela/api-types client for CLI usage with
 * authentication and error handling.
 */

/**
 * API Error type for CLI context
 */
export interface ApiError {
  status: number
  message: string
  body?: unknown
}

/**
 * CLI API configuration
 */
export interface CliApiConfig {
  baseUrl: string
  apiKey?: string
  timeout?: number
}

/**
 * Default configuration from environment variables
 */
const DEFAULT_CONFIG: CliApiConfig = {
  baseUrl: process.env["VLT_API_URL"] || "https://api.firela.com/api/v1",
  apiKey: process.env["VLT_API_KEY"],
  timeout: 30000,
}

// Runtime configuration state
let currentConfig: CliApiConfig = { ...DEFAULT_CONFIG }

/**
 * Configure the API client for CLI usage
 *
 * @param config - Override default configuration
 */
export function configureApiClient(config: Partial<CliApiConfig> = {}): void {
  currentConfig = { ...DEFAULT_CONFIG, ...config }
}

/**
 * Handle API errors in CLI context
 *
 * @param error - API error
 * @param context - Additional context for error message
 * @throws Never - exits process with error code
 */
export function handleApiError(error: ApiError, context?: string): never {
  console.error(`\n❌ API Error`)
  if (context) {
    console.error(`   Context: ${context}`)
  }
  console.error(`   Status: ${error.status}`)
  console.error(`   Message: ${error.message}`)

  if (error.body) {
    console.error(`   Details: ${JSON.stringify(error.body, null, 2)}`)
  }

  process.exit(1)
}

/**
 * Type guard for API errors
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "message" in error
  )
}

/**
 * Get current API configuration
 */
export function getApiConfig(): { baseUrl: string; hasAuth: boolean } {
  return {
    baseUrl: currentConfig.baseUrl,
    hasAuth: !!currentConfig.apiKey,
  }
}

/**
 * Get authorization headers for API requests
 */
export function getAuthHeaders(): Record<string, string> {
  if (currentConfig.apiKey) {
    return { Authorization: `Bearer ${currentConfig.apiKey}` }
  }
  return {}
}

/**
 * Get base URL for API requests
 */
export function getBaseUrl(): string {
  return currentConfig.baseUrl
}
