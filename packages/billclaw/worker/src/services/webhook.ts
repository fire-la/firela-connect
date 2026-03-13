/**
 * Webhook Service
 *
 * Provides utilities for processing Plaid webhooks.
 * Uses JWT-based verification via verifyPlaidWebhookJWT.
 *
 * @packageDocumentation
 */

import { verifyPlaidWebhookJWT } from "../webhook/verify.js"
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
 * Verify Plaid webhook using JWT verification
 *
 * Plaid uses JWT-based verification (not HMAC-SHA256).
 * This delegates to the verifyPlaidWebhookJWT function.
 *
 * @param body - The raw request body as a string
 * @param verificationHeader - The Plaid-Verification header (JWT)
 * @param env - Worker environment with Plaid credentials
 * @returns Whether the webhook is valid
 */
export async function verifyPlaidWebhook(
  body: string,
  verificationHeader: string | null,
  env: Env,
): Promise<WebhookVerifyResult> {
  return verifyPlaidWebhookJWT(body, verificationHeader || "", env)
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
      case "SYNC_UPDATES_AVAILABLE":
        return "sync" // Modern Plaid sync API
      default:
        return "sync" // All other transaction webhooks trigger sync
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
 * Find account by Plaid item_id in D1 database
 *
 * @param itemId - The Plaid item_id
 * @param db - D1 database instance
 * @returns The account or null if not found
 */
async function findAccountByItemId(
  itemId: string,
  db: D1Database,
): Promise<{ id: string; accessToken: string } | null> {
  try {
    const result = await db
      .prepare(
        "SELECT id, access_token FROM accounts WHERE plaid_item_id = ?",
      )
      .bind(itemId)
      .first()

    if (!result) {
      return null
    }

    return {
      id: result.id as string,
      accessToken: result.access_token as string,
    }
  } catch (error) {
    console.error("[webhook] Error finding account:", error)
    return null
  }
}

/**
 * Trigger sync for an account in the background
 *
 * This function is designed to be called via waitUntil() so it runs
 * asynchronously after the webhook response is sent.
 *
 * TODO: This function currently only logs the sync request.
 * The actual sync implementation requires either:
 * 1. Refactoring syncPlaidAccount to accept StorageAdapter interface
 * 2. Creating a D1-specific sync implementation
 * 3. Using the Plaid API directly with D1StorageAdapter
 *
 * Technical debt tracked in: https://github.com/fire-la/billclaw/issues/XXX
 *
 * @param account - The account to sync
 * @param _env - Worker environment (unused for now)
 */
async function triggerSync(
  account: { id: string; accessToken: string },
  _env: Env,
): Promise<void> {
  // TODO: Implement actual sync using Plaid API + D1StorageAdapter
  // For now, just log that we would sync
  console.log(`[sync] Sync triggered for account ${account.id}`, {
    accountId: account.id,
    hasAccessToken: !!account.accessToken,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Process a Plaid webhook
 *
 * This function handles the webhook and returns a result.
 * For SYNC_UPDATES_AVAILABLE webhooks, it triggers an async sync.
 *
 * @param env - Worker environment
 * @param body - The raw request body
 * @param verificationHeader - The Plaid-Verification header (JWT)
 * @param ctx - Execution context for waitUntil (optional)
 * @returns The processing result
 */
export async function processPlaidWebhook(
  env: Env,
  body: string,
  verificationHeader: string | null,
  ctx?: ExecutionContext,
): Promise<WebhookProcessResult> {
  // Verify the JWT signature
  const verifyResult = await verifyPlaidWebhook(
    body,
    verificationHeader,
    env,
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

  // Only trigger sync for SYNC_UPDATES_AVAILABLE
  // All other transaction webhooks also trigger sync (simpler)
  // Item webhooks are just logged
  const shouldTriggerSync =
    webhook.webhook_type === "TRANSACTIONS" ||
    webhook.webhook_code !== "TRANSACTIONS_REMOVED"

  if (shouldTriggerSync) {
    // Find the account by item_id
    const account = await findAccountByItemId(webhook.item_id, env.DB)

    if (!account) {
      return {
        success: false,
        type: "account_not_found",
        itemId: webhook.item_id,
        action,
        error: `Account not found for item_id: ${webhook.item_id}`,
      }
    }

    // Trigger async sync if context is available
    if (ctx?.waitUntil) {
      ctx.waitUntil(
        triggerSync(account, env).catch((err) =>
          console.error("[webhook] Sync trigger failed:", err),
        )
      )

      return {
        success: true,
        type: webhook.webhook_type,
        itemId: webhook.item_id,
        action: "sync_triggered",
      }
    } else {
      // No execution context - can't trigger async sync
      console.warn(
        "[webhook] No execution context available, sync not triggered",
      )

      return {
        success: true,
        type: webhook.webhook_type,
        itemId: webhook.item_id,
        action: "sync_not_triggered",
        error: "No execution context available",
      }
    }
  }

  // For non-sync webhooks, just log and acknowledge
  console.log("[webhook] Received:", {
    type: webhook.webhook_type,
    code: webhook.webhook_code,
    itemId: webhook.item_id,
    action,
  })

  return {
    success: true,
    type: webhook.webhook_type,
    itemId: webhook.item_id,
    action,
  }
}
