/**
 * Event emitter for BillClaw webhook events
 *
 * This module provides a centralized way to emit and forward webhook events
 * to configured external webhook endpoints.
 *
 * Framework-agnostic: Uses Logger interface instead of framework-specific APIs.
 */

import type { Logger } from "../errors/errors.js"
import type { WebhookEventType, WebhookConfig } from "../models/config.js"
import * as crypto from "node:crypto"

/**
 * Base event interface for all BillClaw webhook events
 */
export interface BillclawEvent {
  id: string
  event: WebhookEventType
  timestamp: string
  version: string
  data: unknown
}

/**
 * Transaction event data
 */
export interface TransactionEventData {
  accountId: string
  transactionId: string
  date: string
  amount: number
  currency: string
  merchantName?: string
  category?: string[]
  source: "plaid" | "gmail" | "gocardless" | "manual"
}

/**
 * Sync event data
 */
export interface SyncEventData {
  accountId: string
  syncId: string
  status: "started" | "completed" | "failed"
  transactionsAdded?: number
  transactionsUpdated?: number
  error?: string
  duration?: number // milliseconds
}

/**
 * Account event data
 */
export interface AccountEventData {
  accountId: string
  accountType: "plaid" | "gmail" | "gocardless"
  status: "connected" | "disconnected" | "error"
  error?: string
}

/**
 * Webhook test event data
 */
export interface WebhookTestData {
  message: string
  triggeredBy: string
}

/**
 * Event payload sent to external webhooks
 */
export interface WebhookPayload {
  id: string
  event: WebhookEventType
  timestamp: string
  version: string
  data: unknown
  signature?: string
}

/**
 * Options for webhook retry policy
 */
export interface RetryPolicy {
  maxRetries: number
  initialDelay: number // milliseconds
  maxDelay: number // milliseconds
}

/**
 * Emit a BillClaw event
 *
 * This function creates a standardized event and forwards it to all
 * configured external webhooks that are subscribed to this event type.
 *
 * @param logger - Logger instance for logging
 * @param webhooks - Array of webhook configurations
 * @param eventType - Type of event to emit
 * @param data - Event data
 */
export async function emitEvent(
  logger: Logger,
  webhooks: WebhookConfig[],
  eventType: WebhookEventType,
  data: unknown,
): Promise<void> {
  const enabledWebhooks = webhooks.filter((w) => w.enabled && w.url)

  if (enabledWebhooks.length === 0) {
    logger.debug?.(`No webhooks configured, skipping event: ${eventType}`)
    return
  }

  // Create standardized event
  const event: BillclawEvent = {
    id: generateEventId(),
    event: eventType,
    timestamp: new Date().toISOString(),
    version: "1.0",
    data,
  }

  logger.info?.(`Emitting event: ${eventType} (${event.id})`)

  // Forward to configured webhooks (fire-and-forget)
  const promises = enabledWebhooks.map(async (webhook) => {
    // Check if this webhook is subscribed to this event
    if (
      webhook.events &&
      webhook.events.length > 0 &&
      !webhook.events.includes(eventType)
    ) {
      return
    }

    // Skip webhooks without URL (shouldn't happen due to filter, but TypeScript needs guard)
    if (!webhook.url) {
      return
    }

    // Send webhook with retry logic (don't await)
    sendWebhook(
      logger,
      webhook as { url: string; secret?: string; retryPolicy?: RetryPolicy },
      event,
    ).catch((error) => {
      logger.debug?.(`Webhook emission failed:`, error)
    })
  })

  // Fire-and-forget: don't await webhook delivery
  Promise.all(promises).catch(() => {
    // All promises handled individually
  })
}

/**
 * Emit transaction.new event
 */
export async function emitTransactionNew(
  logger: Logger,
  webhooks: WebhookConfig[],
  transaction: TransactionEventData,
): Promise<void> {
  await emitEvent(logger, webhooks, "transaction.new", transaction)
}

/**
 * Emit transaction.updated event
 */
export async function emitTransactionUpdated(
  logger: Logger,
  webhooks: WebhookConfig[],
  transaction: TransactionEventData,
): Promise<void> {
  await emitEvent(logger, webhooks, "transaction.updated", transaction)
}

/**
 * Emit transaction.deleted event
 */
export async function emitTransactionDeleted(
  logger: Logger,
  webhooks: WebhookConfig[],
  transactionId: string,
  accountId: string,
): Promise<void> {
  await emitEvent(logger, webhooks, "transaction.deleted", {
    transactionId,
    accountId,
  })
}

/**
 * Emit sync.started event
 */
export async function emitSyncStarted(
  logger: Logger,
  webhooks: WebhookConfig[],
  accountId: string,
  syncId: string,
): Promise<void> {
  await emitEvent(logger, webhooks, "sync.started", {
    accountId,
    syncId,
    status: "started" as const,
  })
}

/**
 * Emit sync.completed event
 */
export async function emitSyncCompleted(
  logger: Logger,
  webhooks: WebhookConfig[],
  syncData: SyncEventData,
): Promise<void> {
  await emitEvent(logger, webhooks, "sync.completed", syncData)
}

/**
 * Emit sync.failed event
 */
export async function emitSyncFailed(
  logger: Logger,
  webhooks: WebhookConfig[],
  accountId: string,
  syncId: string,
  error: string,
): Promise<void> {
  await emitEvent(logger, webhooks, "sync.failed", {
    accountId,
    syncId,
    status: "failed" as const,
    error,
  })
}

/**
 * Emit account.connected event
 */
export async function emitAccountConnected(
  logger: Logger,
  webhooks: WebhookConfig[],
  accountId: string,
  accountType: "plaid" | "gmail" | "gocardless",
): Promise<void> {
  await emitEvent(logger, webhooks, "account.connected", {
    accountId,
    accountType,
    status: "connected" as const,
  })
}

/**
 * Emit account.disconnected event
 */
export async function emitAccountDisconnected(
  logger: Logger,
  webhooks: WebhookConfig[],
  accountId: string,
  accountType: "plaid" | "gmail" | "gocardless",
): Promise<void> {
  await emitEvent(logger, webhooks, "account.disconnected", {
    accountId,
    accountType,
    status: "disconnected" as const,
  })
}

/**
 * Emit account.error event
 */
export async function emitAccountError(
  logger: Logger,
  webhooks: WebhookConfig[],
  accountId: string,
  accountType: "plaid" | "gmail" | "gocardless",
  error: string,
): Promise<void> {
  await emitEvent(logger, webhooks, "account.error", {
    accountId,
    accountType,
    status: "error" as const,
    error,
  })
}

/**
 * Emit webhook.test event
 */
export async function emitWebhookTest(
  logger: Logger,
  webhooks: WebhookConfig[],
  message: string = "Test webhook from BillClaw",
): Promise<void> {
  await emitEvent(logger, webhooks, "webhook.test", {
    message,
    triggeredBy: "user",
  })
}

/**
 * Send webhook to external endpoint with signature and retry logic
 *
 * @param logger - Logger instance
 * @param webhook - Webhook configuration with url, secret, retryPolicy
 * @param event - Event to send
 */
async function sendWebhook(
  logger: Logger,
  webhook: { url: string; secret?: string; retryPolicy?: RetryPolicy },
  event: BillclawEvent,
): Promise<void> {
  const maxRetries = webhook.retryPolicy?.maxRetries || 3
  const initialDelay = webhook.retryPolicy?.initialDelay || 1000
  const maxDelay = webhook.retryPolicy?.maxDelay || 30000

  // Create payload
  const payload: WebhookPayload = { ...event }

  // Sign payload if secret is configured
  if (webhook.secret) {
    payload.signature = generateSignature(event, webhook.secret)
  }

  let attempt = 0
  let delay = initialDelay

  while (attempt < maxRetries) {
    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BillClaw/1.0",
          "X-Billclaw-Event-Id": event.id,
          "X-Billclaw-Event-Type": event.event,
          "X-Billclaw-Timestamp": event.timestamp,
          ...(payload.signature && {
            "X-Billclaw-Signature": payload.signature,
          }),
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        logger.info?.(`Webhook sent successfully to ${webhook.url}`)
        return
      }

      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        logger.warn?.(`Webhook rejected by ${webhook.url}: ${response.status}`)
        return
      }

      throw new Error(`Webhook failed: ${response.status}`)
    } catch (error) {
      attempt++
      if (attempt >= maxRetries) {
        logger.error?.(
          `Webhook failed after ${maxRetries} retries to ${webhook.url}:`,
          error,
        )
        return
      }

      // Exponential backoff with jitter (30%)
      const jitter = Math.random() * 0.3 * delay
      await new Promise((resolve) => setTimeout(resolve, delay + jitter))
      delay = Math.min(delay * 2, maxDelay)
    }
  }
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 *
 * @param event - Event to sign
 * @param secret - Secret key for HMAC
 * @returns Signature in format "sha256=<hex>"
 */
export function generateSignature(
  event: BillclawEvent,
  secret: string,
): string {
  // Create payload to sign (all fields except signature)
  const payload = {
    id: event.id,
    event: event.event,
    timestamp: event.timestamp,
    version: event.version,
    data: event.data,
  }

  const payloadString = JSON.stringify(payload)

  // Compute HMAC-SHA256
  const hmac = crypto.createHmac("sha256", secret)
  hmac.update(payloadString)
  return `sha256=${hmac.digest("hex")}`
}

/**
 * Verify webhook signature
 *
 * Returns true if the signature matches the computed signature.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param payload - JSON string payload
 * @param signature - Signature to verify (format: "sha256=<hex>")
 * @param secret - Secret key for HMAC
 * @returns True if signature is valid
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex")

    const providedSignature = signature.replace("sha256=", "")

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature),
    )
  } catch {
    return false
  }
}

/**
 * Generate unique event ID
 *
 * Format: evt_<timestamp>_<random>
 * Example: evt_lz1h2x3a4b5c6d_abc123def4567
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 15)
  return `evt_${timestamp}_${random}`
}

/**
 * Type guard to check if an event is a transaction event
 */
export function isTransactionEvent(
  event: BillclawEvent,
): event is BillclawEvent & { data: TransactionEventData } {
  return (
    event.event === "transaction.new" ||
    event.event === "transaction.updated" ||
    event.event === "transaction.deleted"
  )
}

/**
 * Type guard to check if an event is a sync event
 */
export function isSyncEvent(
  event: BillclawEvent,
): event is BillclawEvent & { data: SyncEventData } {
  return (
    event.event === "sync.started" ||
    event.event === "sync.completed" ||
    event.event === "sync.failed"
  )
}

/**
 * Type guard to check if an event is an account event
 */
export function isAccountEvent(
  event: BillclawEvent,
): event is BillclawEvent & { data: AccountEventData } {
  return (
    event.event === "account.connected" ||
    event.event === "account.disconnected" ||
    event.event === "account.error"
  )
}
