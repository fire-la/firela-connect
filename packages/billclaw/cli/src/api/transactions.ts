/**
 * Transaction API for BillClaw CLI
 *
 * Provides functions to interact with VLT transaction endpoints.
 * Used by billclaw after fetching transactions from bank aggregators.
 */

import {
  handleApiError,
  isApiError,
  type ApiError,
} from "./client.js"

// Type definitions from @firela/api-types
import type {
  TransactionResponseDto,
  TransactionDetailDto,
  TransactionListResponseDto,
  CreateTransactionDto,
} from "@firela/api-types"

/**
 * Transaction upload result
 */
export interface UploadResult {
  uploaded: number
  errors: string[]
}

/**
 * Get API base URL
 */
function getBaseUrl(): string {
  return process.env["VLT_API_URL"] || "https://api.firela.com/api/v1"
}

/**
 * Get authorization header if API key is set
 */
function getAuthHeaders(): Record<string, string> {
  const apiKey = process.env["VLT_API_KEY"]
  if (apiKey) {
    return { Authorization: `Bearer ${apiKey}` }
  }
  return {}
}

/**
 * Upload transactions to VLT
 *
 * @param region - Region code (e.g., 'de', 'us', 'cn')
 * @param transactions - Array of transactions to upload
 * @returns Upload result with count and errors
 */
export async function uploadTransactions(
  region: string,
  transactions: CreateTransactionDto[]
): Promise<UploadResult> {
  const errors: string[] = []
  let uploaded = 0

  for (const transaction of transactions) {
    try {
      const response = await fetch(
        `${getBaseUrl()}/${region}/bean/transactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify(transaction),
        }
      )

      if (!response.ok) {
        const error: ApiError = {
          status: response.status,
          message: response.statusText,
        }
        errors.push(`Transaction ${transaction.date}: ${error.message}`)
        continue
      }

      uploaded++
    } catch (err) {
      errors.push(`Transaction ${transaction.date}: ${String(err)}`)
    }
  }

  return { uploaded, errors }
}

/**
 * List recent transactions for verification
 *
 * @param region - Region code
 * @param limit - Maximum number of transactions to return
 * @returns Transaction list response
 */
export async function listRecentTransactions(
  region: string,
  limit: number = 10
): Promise<TransactionListResponseDto> {
  const response = await fetch(
    `${getBaseUrl()}/${region}/bean/transactions?limit=${limit}`,
    {
      headers: getAuthHeaders(),
    }
  )

  if (!response.ok) {
    const error: ApiError = {
      status: response.status,
      message: response.statusText,
    }
    handleApiError(error, "Failed to list transactions")
  }

  return (await response.json()) as TransactionListResponseDto
}

/**
 * Get transaction by ID
 *
 * @param region - Region code
 * @param id - Transaction ID
 * @returns Transaction detail or null if not found
 */
export async function getTransaction(
  region: string,
  id: string
): Promise<TransactionDetailDto | null> {
  try {
    const response = await fetch(
      `${getBaseUrl()}/${region}/bean/transactions/${id}`,
      {
        headers: getAuthHeaders(),
      }
    )

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const error: ApiError = {
        status: response.status,
        message: response.statusText,
      }
      handleApiError(error, `Failed to get transaction ${id}`)
    }

    return (await response.json()) as TransactionDetailDto
  } catch (error) {
    if (isApiError(error)) {
      throw error // Already handled
    }
    throw new Error(`Failed to get transaction: ${String(error)}`)
  }
}

// Re-export types for convenience
export type {
  TransactionResponseDto,
  TransactionDetailDto,
  TransactionListResponseDto,
  CreateTransactionDto,
}
