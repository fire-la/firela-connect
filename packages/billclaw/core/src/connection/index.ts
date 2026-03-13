/**
 * Connection module
 *
 * Unified connection mode selection for OAuth and webhook reception.
 * Provides automatic mode detection based on environment availability.
 *
 * Note: For backward compatibility, mode selection functions are also
 * exported from the webhook module. The webhook module re-exports from here.
 *
 * @packageDocumentation
 */

// Primary exports - unified connection mode selection
export {
  selectConnectionMode,
  isDirectAvailable,
  isRelayAvailable,
  getFallbackMode,
  canUpgradeMode,
  getBestAvailableMode,
} from "./mode-selector.js"

// Legacy exports - for backward compatibility (also available via webhook module)
export { selectMode } from "./mode-selector.js"

// Type exports
export type {
  ConnectionPurpose,
  ConnectionModeSelectionResult,
  HealthCheckResult,
} from "./types.js"

// Constants
export { RELAY_URL } from "./constants.js"
