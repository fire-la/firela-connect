/**
 * Connection module types
 *
 * Type definitions for unified connection mode selection.
 * Used by both OAuth completion and webhook reception.
 *
 * @packageDocumentation
 */

import type { ConnectionMode } from "../models/config.js"

/**
 * Purpose of connection (webhook or OAuth)
 */
export type ConnectionPurpose = "webhook" | "oauth"

/**
 * Mode selection result (new unified format)
 */
export interface ConnectionModeSelectionResult {
  mode: ConnectionMode
  reason: string
  /**
   * Which purpose this selection is for
   */
  purpose: ConnectionPurpose
}

/**
 * Mode selection result (legacy format for backward compatibility)
 *
 * @deprecated Use ConnectionModeSelectionResult instead
 */
export interface ModeSelectionResult {
  mode: ConnectionMode
  reason: string
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  available: boolean
  latency?: number
  error?: string
}
