/**
 * Connection module exports
 *
 * Unified connection mode selection for OAuth and webhooks.
 *
 * @packageDocumentation
 */

export type {
  ConnectionPurpose,
  ConnectionModeSelectionResult,
  HealthCheckResult,
} from "./types.js"

// Mode selector functions
export {
  isDirectAvailable,
  selectConnectionMode,
  getFallbackMode,
  canUpgradeMode,
  getBestAvailableMode,
  selectMode,
} from "./mode-selector.js"
