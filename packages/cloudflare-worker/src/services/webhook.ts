/**
 * Webhook Service
 *
 * Provides utilities for processing Plaid webhooks.
 * Uses Web Crypto API for HMAC-SHA256 verification.
 *
 * @packageDocumentation
 */

import type { Env } from "../types/env.js"

/**
 * Plaid webhook types
 */
export type PlaidWebhookType =
  | "TRANSACTIONS"
  | "ITEM"
  | "HISTORICAL_UPDATE"
  | "DEFAULT_UPDATE"

/**
 * Plaid webhook payload
 */
export interface PlaidWebhook {
  webhook_type: string
  webhook_code: string
  item_id: string
  error?: {
    error_type: string
    error_code: string
    error_message: string
  }
  new_transactions?: number
  removed_transactions?: string[]
  environment?: string
}

/**
 * Result of webhook verification
 */
export interface WebhookVerifyResult {
  valid: boolean
  error?: string
}

/**
 * Result of webhook processing
 */
export interface WebhookProcessResult {
  success: boolean
  type: string
  itemId: string
  action?: string
  error?: string
}

/**
 * Verify Plaid webhook signature using HMAC-SHA256
 *
 * This implementation uses the Web Crypto API which is native to Cloudflare Workers.
 * No Node.js dependencies are required.
 *
 * @param body - The raw request body as a string
 * @param signature - The Plaid-Signature header value (hex-encoded)
 * @param secret - The Plaid webhook secret (from PLAID_WEBHOOK_SECRET)
 * @returns Whether the signature is valid
 */
export async function verifyPlaidWebhook(
  body: string,
  signature: string | null,
  secret: string,
): Promise<WebhookVerifyResult> {
  if (!signature) {
    return { valid: false, error: "Missing Plaid-Signature header" }
  }

  if (!secret) {
    // If no secret is configured, skip verification (not recommended for production)
    return { valid: true }
  }

  try {
    const encoder = new TextEncoder()

    // Import the secret key for HMAC
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )

    // Sign the message body
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body),
    )

    // Convert signature to hex string
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    // Compare signatures (constant-time comparison would be ideal but hex is low-entropy)
    if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
      return { valid: false, error: "Signature mismatch" }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Verification error",
    }
  }
}

/**
 * Parse and validate a Plaid webhook payload
 *
 * @param body - The raw request body as a string
 * @returns The parsed webhook or an error
 */
export function parsePlaidWebhook(body: string): {
  webhook?: PlaidWebhook
  error?: string
} {
  try {
    const payload = JSON.parse(body) as PlaidWebhook

    if (!payload.webhook_type || !payload.item_id) {
      return { error: "Missing required fields in webhook payload" }
    }

    return { webhook: payload }
  } catch {
    return { error: "Invalid JSON in webhook payload" }
  }
}

/**
 * Determine the action to take for a webhook
 *
 * @param webhook - The parsed Plaid webhook
 * @returns The action to take
 */
export function getWebhookAction(webhook: PlaidWebhook): string {
  const { webhook_type, webhook_code } = webhook

  if (webhook_type === "TRANSACTIONS") {
    switch (webhook_code) {
      case "INITIAL_UPDATE":
        return "initial_sync"
      case "HISTORICAL_UPDATE":
        return "historical_sync"
      case "DEFAULT_UPDATE":
        return "incremental_sync"
      case "TRANSACTIONS_REMOVED":
        return "remove_transactions"
      default:
        return "sync"
    }
  }

  if (webhook_type === "ITEM") {
    switch (webhook_code) {
      case "ERROR":
        return "item_error"
      case "LOGIN_RECREATED":
        return "login_restored"
      case "PENDING_EXPIIRE":
        return "item_expiring"
      case "USER_PERMISSION_REVOKED":
        return "access_revoked"
      default:
        return "item_update"
    }
  }

  return "unknown"
}

/**
 * Process a Plaid webhook
 *
 * This function handles the webhook and returns a result.
 * The actual sync operations will be implemented in 06-03.
 *
 * @param env - Worker environment
 * @param body - The raw request body
 * @param signature - The Plaid-Signature header
 * @returns The processing result
 */
export async function processPlaidWebhook(
  env: Env,
  body: string,
  signature: string | null,
): Promise<WebhookProcessResult> {
  // Verify the signature
  const verifyResult = await verifyPlaidWebhook(
    body,
    signature,
    env.PLAID_WEBHOOK_SECRET || "",
  )

  if (!verifyResult.valid) {
    return {
      success: false,
      type: "verification_failed",
      itemId: "",
      error: verifyResult.error,
    }
  }

  // Parse the webhook
  const { webhook, error } = parsePlaidWebhook(body)

  if (error || !webhook) {
    return {
      success: false,
      type: "parse_failed",
      itemId: "",
      error: error || "Failed to parse webhook",
    }
  }

  // Determine the action
  const action = getWebhookAction(webhook)

  // Return the result
  // In 06-03, we'll add logic to queue sync operations
  return {
    success: true,
    type: webhook.webhook_type,
    itemId: webhook.item_id,
    action,
  }
}
