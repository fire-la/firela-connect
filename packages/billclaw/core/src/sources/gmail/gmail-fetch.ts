/**
 * Gmail data source for BillClaw - Framework-agnostic Gmail integration
 *
 * Core business logic for fetching and processing bill emails from Gmail.
 * OAuth token management is provided by the adapter layer.
 */

import type { Logger, UserError } from "../../errors/errors.js"
import type { StorageConfig } from "../../models/config.js"
import type { Transaction } from "../../storage/transaction-storage.js"
import { appendTransactions } from "../../storage/transaction-storage.js"
import {
  filterToBills,
  type EmailContent,
  type GmailConfig,
} from "./bill-recognizer.js"
import {
  parseBillToTransaction,
  type ParsedTransaction,
} from "./email-parser.js"
import { createUserError, ERROR_CODES, parseGmailError, ErrorCategory } from "../../errors/errors.js"

export interface GmailAccount {
  id: string
  gmailEmailAddress: string
}

export interface GmailFetchResult {
  success: boolean
  accountId: string
  emailsProcessed: number
  billsExtracted: number
  transactionsAdded: number
  transactionsUpdated: number
  errors?: UserError[]
}

/**
 * Gmail fetcher options
 */
export interface GmailFetcherOptions {
  accessToken: string
  userId?: string // Gmail user ID (default: "me")
  query?: string // Gmail search query
  maxResults?: number // Maximum number of emails to fetch
}

/**
 * Gmail API message structure (simplified)
 */
interface GmailMessage {
  id: string
  threadId: string
  payload: {
    headers?: Array<{ name: string; value: string }>
    body?: { data: string }
    parts?: Array<{
      mimeType?: string
      body?: { data: string }
      parts?: any[]
    }>
  }
  internalDate?: string
}

/**
 * Fetch emails from Gmail API
 *
 * NOTE: This is a framework-agnostic function that requires OAuth tokens.
 * The adapter layer (OpenClaw or CLI) provides the access token.
 *
 * This implementation uses a simple fetch-based approach. For production use,
 * consider using the official Gmail API client library.
 */
export async function fetchGmailEmails(
  options: GmailFetcherOptions,
  config: GmailConfig,
  logger: Logger,
): Promise<EmailContent[]> {
  const { accessToken, userId = "me", query, maxResults = 50 } = options

  logger.info?.("Fetching emails from Gmail API...")

  // Build Gmail search query
  let searchQuery = query || buildGmailQuery(config)

  try {
    // Construct Gmail API URL
    const apiUrl = new URL(
      `https://www.googleapis.com/gmail/v1/users/${userId}/messages`,
    )
    apiUrl.searchParams.set("q", searchQuery)
    apiUrl.searchParams.set("maxResults", maxResults.toString())

    // Fetch message list
    const response = await fetch(apiUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Gmail API error: ${response.status} ${errorText}`)
    }

    const data = (await response.json()) as {
      messages?: Array<{ id: string; threadId: string }>
    }
    const messages: Array<{ id: string; threadId: string }> = data.messages || []

    logger.info?.(`Found ${messages.length} messages matching query`)

    if (messages.length === 0) {
      return []
    }

    // Fetch full message details for each message
    const emails: EmailContent[] = []

    for (const message of messages) {
      try {
        const email = await fetchGmailMessage(userId, message.id, accessToken)
        if (email) {
          emails.push(email)
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error"
        logger.warn?.(`Failed to fetch message ${message.id}: ${errorMsg}`)
      }
    }

    return emails
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    logger.error?.(`Gmail fetch failed: ${errorMsg}`)
    throw error
  }
}

/**
 * Fetch a single Gmail message with full details
 */
async function fetchGmailMessage(
  userId: string,
  messageId: string,
  accessToken: string,
): Promise<EmailContent | null> {
  const apiUrl = new URL(
    `https://www.googleapis.com/gmail/v1/users/${userId}/messages/${messageId}`,
  )
  apiUrl.searchParams.set("format", "full")

  const response = await fetch(apiUrl.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    return null
  }

  const message = (await response.json()) as GmailMessage
  return parseGmailMessage(message)
}

/**
 * Parse Gmail API message into EmailContent
 */
function parseGmailMessage(message: GmailMessage): EmailContent | null {
  const headers = message.payload.headers || []

  const getHeader = (name: string): string => {
    const header = headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase(),
    )
    return header?.value || ""
  }

  const subject = getHeader("Subject")
  const from = getHeader("From")
  const to = getHeader("To")
  const date = getHeader("Date")

  // Extract body text
  const body = extractMessageBody(message.payload)

  return {
    id: message.id,
    subject,
    from,
    to,
    date,
    body,
  }
}

/**
 * Extract message body from Gmail payload
 * Handles both plain text and HTML, traversing parts if needed
 */
function extractMessageBody(payload: GmailMessage["payload"]): string {
  // If body has data, decode it
  if (payload.body?.data) {
    return base64UrlDecode(payload.body.data)
  }

  // If there are parts, traverse them to find text content
  if (payload.parts) {
    for (const part of payload.parts) {
      // Prefer plain text over HTML
      if (part.mimeType === "text/plain" && part.body?.data) {
        return base64UrlDecode(part.body.data)
      }
      if (part.mimeType === "text/html" && part.body?.data) {
        // Strip HTML tags for plain text
        const html = base64UrlDecode(part.body.data)
        return html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      }
      // Recurse into nested parts
      const nestedBody = extractMessageBody(part)
      if (nestedBody) {
        return nestedBody
      }
    }
  }

  return ""
}

/**
 * Decode base64url encoded string
 */
function base64UrlDecode(encoded: string): string {
  // Replace base64url characters with base64 standard
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/")

  // Add padding if needed
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")

  // Decode
  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new TextDecoder().decode(bytes)
  } catch {
    // Fallback for simple base64 without padding
    return atob(base64)
  }
}

/**
 * Build Gmail search query from config
 */
function buildGmailQuery(config: GmailConfig): string {
  const parts: string[] = []

  // Add keyword search
  if (config.keywords.length > 0) {
    const keywordQuery = config.keywords.map((k) => `"${k}"`).join(" OR ")
    parts.push(`(${keywordQuery})`)
  }

  // Add sender whitelist
  if (config.senderWhitelist.length > 0) {
    const senderQuery = config.senderWhitelist
      .map((s) => {
        if (s.startsWith("@")) {
          return `from:${s}`
        }
        return `from:${s}`
      })
      .join(" OR ")
    parts.push(`(${senderQuery})`)
  }

  // Add time filter (emails from last 30 days)
  parts.push("newer_than:30d")

  return parts.join(" ")
}

/**
 * Parse ParsedTransaction to Transaction format for storage
 */
function parsedToStorageTransaction(parsed: ParsedTransaction): Transaction {
  return {
    transactionId: parsed.transactionId,
    plaidTransactionId: parsed.transactionId, // Gmail uses same field
    accountId: parsed.accountId,
    date: parsed.date,
    amount: parsed.amount,
    currency: parsed.currency,
    category: parsed.category,
    merchantName: parsed.merchantName,
    paymentChannel: parsed.paymentChannel,
    pending: parsed.pending,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Fetch bills from Gmail
 *
 * Main entry point for Gmail bill fetching workflow:
 * 1. Fetch emails matching criteria
 * 2. Recognize which emails are bills
 * 3. Parse bill emails into transactions
 * 4. Store transactions
 */
export async function fetchGmailBills(
  account: GmailAccount,
  _days: number = 30,
  gmailConfig: GmailConfig,
  storageConfig: StorageConfig,
  logger: Logger,
  accessToken?: string,
): Promise<GmailFetchResult> {
  if (!accessToken) {
    const noTokenError: UserError = createUserError(
      ERROR_CODES.GMAIL_AUTH_FAILED,
      ErrorCategory.GMAIL_AUTH,
      "error",
      true,
      {
        title: "No OAuth Access Token Provided",
        message: `No OAuth access token was provided for Gmail account ${account.id}.`,
        suggestions: [
          "Ensure an access token is provided when calling this function",
          "Run OAuth setup to authenticate with Gmail",
        ],
      },
      [{ type: "oauth_reauth", tool: "gmail_oauth", params: { accountId: account.id } }],
      { accountId: account.id },
    )
    return {
      success: false,
      accountId: account.id,
      emailsProcessed: 0,
      billsExtracted: 0,
      transactionsAdded: 0,
      transactionsUpdated: 0,
      errors: [noTokenError],
    }
  }

  try {
    logger.info?.(`Fetching Gmail bills for account ${account.id}...`)

    // Step 1: Fetch emails from Gmail
    const emails = await fetchGmailEmails(
      {
        accessToken,
        query: buildGmailQuery(gmailConfig),
        maxResults: 50,
      },
      gmailConfig,
      logger,
    )

    logger.info?.(`Fetched ${emails.length} emails from Gmail`)

    if (emails.length === 0) {
      return {
        success: true,
        accountId: account.id,
        emailsProcessed: 0,
        billsExtracted: 0,
        transactionsAdded: 0,
        transactionsUpdated: 0,
      }
    }

    // Step 2: Recognize bills from emails
    const billEmails = filterToBills(emails, gmailConfig)

    logger.info?.(
      `Identified ${billEmails.length} bill emails (threshold: ${gmailConfig.confidenceThreshold})`,
    )

    if (billEmails.length === 0) {
      return {
        success: true,
        accountId: account.id,
        emailsProcessed: emails.length,
        billsExtracted: 0,
        transactionsAdded: 0,
        transactionsUpdated: 0,
      }
    }

    // Step 3: Parse bills into transactions
    const transactions: Transaction[] = []

    for (const { email, recognition } of billEmails) {
      const parsed = parseBillToTransaction(
        account.id,
        email.id,
        email.subject,
        email.body,
        email.from,
        email.date,
        recognition,
      )

      transactions.push(parsedToStorageTransaction(parsed))
    }

    // Step 4: Store transactions
    const now = new Date()
    const storageResult = await appendTransactions(
      account.id,
      now.getFullYear(),
      now.getMonth() + 1,
      transactions,
      storageConfig,
    )

    logger.info?.(
      `Stored ${storageResult.added} new, ${storageResult.updated} updated transactions`,
    )

    return {
      success: true,
      accountId: account.id,
      emailsProcessed: emails.length,
      billsExtracted: billEmails.length,
      transactionsAdded: storageResult.added,
      transactionsUpdated: storageResult.updated,
    }
  } catch (error) {
    logger.error?.(`Gmail fetch failed:`, error)

    // Parse error to UserError
    let userError: UserError
    if (error instanceof Error) {
      // Try to parse as Gmail error
      try {
        // Check if it's a fetch response with status
        if ("status" in error) {
          userError = parseGmailError(
            { status: (error as any).status, message: error.message },
            account.id,
          )
        } else {
          // Generic error
          userError = parseGmailError({ message: error.message }, account.id)
        }
      } catch {
        // Fallback to network error
        userError = parseGmailError({ message: error.message }, account.id)
      }
    } else {
      userError = parseGmailError({ message: String(error) }, account.id)
    }

    return {
      success: false,
      accountId: account.id,
      emailsProcessed: 0,
      billsExtracted: 0,
      transactionsAdded: 0,
      transactionsUpdated: 0,
      errors: [userError],
    }
  }
}

// Re-export types and functions from submodules
export * from "./bill-recognizer.js"
export * from "./email-parser.js"
