/**
 * Upload module for BillClaw - Transaction upload to IGN Beancount SaaS
 *
 * Provides:
 * - IGN API client with retry logic
 * - Transaction transformation (BillClaw -> Plaid format)
 * - Upload status tracking
 * - Upload service for orchestrating the upload flow
 * - Automatic JWT token management (IgnAuthManager)
 *
 * @packageDocumentation
 */

// IGN API client
export {
  IgnClient,
  uploadTransactions,
  type IgnClientConfig,
  type PlaidTransactionUpload,
  type ProviderSyncConfig,
  type IgnUploadResult,
} from "./ign-client.js"

// Transaction transformation
export {
  transformToPlaidFormat,
  transformTransactionsToPlaidFormat,
} from "./transform.js"

// Upload status tracking
export {
  UploadStatusStore,
  type IgnUploadStatus,
} from "./upload-status.js"

// Upload service
export {
  UploadService,
  type UploadServiceResult,
  type UploadOptions,
} from "./upload-service.js"

// IGN Authentication Manager
export {
  IgnAuthManager,
  type IgnAuthManagerConfig,
} from "./ign-auth.js"
