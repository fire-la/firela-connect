/**
 * Unified webhook manager
 *
 * Orchestrates webhook reception across Direct/Relay/Polling modes with
 * automatic mode switching, health monitoring, and connection recovery.
 *
 * @packageDocumentation
 */

import type { RuntimeContext } from "../runtime/types.js"
import type {
  InboundWebhookMode,
  ConnectionStatus,
  WebhookEvent,
} from "./config.js"
import type { ConnectionState } from "../relay/types.js"
import { RelayWebSocketClient, createRelayClient } from "../relay/client.js"
import {
  selectMode,
  getFallbackMode,
  canUpgradeMode,
  getBestAvailableMode,
  isDirectAvailable,
} from "../connection/mode-selector.js"

/**
 * Webhook manager state
 */
interface WebhookManagerState {
  currentMode: InboundWebhookMode
  connectionStatus: ConnectionStatus
  lastHealthCheck: number
  lastModeChange: number
  healthCheckInterval?: NodeJS.Timeout
}

/**
 * Webhook manager options
 */
export interface WebhookManagerOptions {
  /**
   * Health check interval in milliseconds
   */
  healthCheckInterval?: number
  /**
   * Enable automatic mode switching on failure
   */
  autoModeSwitching?: boolean
  /**
   * Enable automatic upgrade to better mode
   */
  autoUpgrade?: boolean
}

/**
 * Mode change event
 */
export interface ModeChangeEvent {
  from: InboundWebhookMode
  to: InboundWebhookMode
  reason: string
  timestamp: number
}

/**
 * Webhook manager
 *
 * Manages webhook reception across three modes with automatic fallback and recovery.
 */
export class WebhookManager {
  private context: RuntimeContext
  private options: Required<WebhookManagerOptions>
  private state: WebhookManagerState
  private relayClient: RelayWebSocketClient | null = null
  private eventHandlers = new Set<(event: WebhookEvent) => void>()
  private modeChangeHandlers = new Set<(event: ModeChangeEvent) => void>()
  private isStarted = false
  private isShuttingDown = false

  constructor(context: RuntimeContext, options: WebhookManagerOptions = {}) {
    this.context = context
    this.options = {
      healthCheckInterval: options.healthCheckInterval ?? 60000, // 1 minute
      autoModeSwitching: options.autoModeSwitching ?? true,
      autoUpgrade: options.autoUpgrade ?? true,
    }
    this.state = {
      currentMode: "polling",
      connectionStatus: "disconnected",
      lastHealthCheck: 0,
      lastModeChange: Date.now(),
    }
  }

  /**
   * Start webhook manager
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      this.context.logger.warn("Webhook manager already started")
      return
    }

    this.isStarted = true
    this.context.logger.info("Webhook manager starting...")

    // Select initial mode
    const selection = await selectMode(this.context)
    await this.switchMode(selection.mode, selection.reason)

    // Start health check interval
    if (this.options.healthCheckInterval > 0) {
      this.state.healthCheckInterval = setInterval(
        () => this.healthCheck(),
        this.options.healthCheckInterval,
      )
    }

    this.context.logger.info("Webhook manager started", {
      mode: this.state.currentMode,
    })
  }

  /**
   * Stop webhook manager
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return
    }

    this.isShuttingDown = true
    this.context.logger.info("Webhook manager stopping...")

    // Clear health check interval
    if (this.state.healthCheckInterval) {
      clearInterval(this.state.healthCheckInterval)
      this.state.healthCheckInterval = undefined
    }

    // Disconnect relay client
    if (this.relayClient) {
      this.relayClient.disconnect()
      this.relayClient = null
    }

    this.isStarted = false
    this.isShuttingDown = false
    this.context.logger.info("Webhook manager stopped")
  }

  /**
   * Register webhook event handler
   */
  onEvent(handler: (event: WebhookEvent) => void): void {
    this.eventHandlers.add(handler)
  }

  /**
   * Unregister webhook event handler
   */
  offEvent(handler: (event: WebhookEvent) => void): void {
    this.eventHandlers.delete(handler)
  }

  /**
   * Register mode change handler
   */
  onModeChange(handler: (event: ModeChangeEvent) => void): void {
    this.modeChangeHandlers.add(handler)
  }

  /**
   * Unregister mode change handler
   */
  offModeChange(handler: (event: ModeChangeEvent) => void): void {
    this.modeChangeHandlers.delete(handler)
  }

  /**
   * Get current state
   */
  getState(): WebhookManagerState {
    return { ...this.state }
  }

  /**
   * Get current mode
   */
  getCurrentMode(): InboundWebhookMode {
    return this.state.currentMode
  }

  /**
   * Force switch to specific mode
   */
  async forceMode(mode: InboundWebhookMode, reason?: string): Promise<void> {
    await this.switchMode(mode, reason ?? "Manual mode switch")
  }

  /**
   * Switch to different mode
   */
  private async switchMode(
    mode: InboundWebhookMode,
    reason: string,
  ): Promise<void> {
    if (this.isShuttingDown) {
      this.context.logger.debug("Skipping mode switch during shutdown")
      return
    }

    const from = this.state.currentMode
    if (from === mode) {
      return
    }

    this.context.logger.info(`Switching mode: ${from} → ${mode}`, { reason })

    // Disconnect current mode
    await this.disconnectMode()

    // Update state
    this.state.currentMode = mode
    this.state.lastModeChange = Date.now()

    // Connect new mode
    await this.connectMode()

    // Notify handlers
    const event: ModeChangeEvent = {
      from,
      to: mode,
      reason,
      timestamp: Date.now(),
    }
    for (const handler of this.modeChangeHandlers) {
      try {
        handler(event)
      } catch (error) {
        this.context.logger.error("Mode change handler error:", error)
      }
    }

    // Emit via RuntimeContext events
    this.context.events?.emit("webhook.mode_changed", event)
  }

  /**
   * Connect current mode
   */
  private async connectMode(): Promise<void> {
    const mode = this.state.currentMode

    switch (mode) {
      case "relay":
        await this.connectRelay()
        break

      case "direct":
        // Direct mode uses Connect service, no client needed here
        this.state.connectionStatus = "connected"
        break

      case "polling":
        // Polling mode uses sync service, no persistent connection
        this.state.connectionStatus = "connected"
        break
    }
  }

  /**
   * Disconnect current mode
   */
  private async disconnectMode(): Promise<void> {
    if (this.relayClient) {
      this.relayClient.offEvent(this.handleRelayEvent)
      this.relayClient.offStateChange(this.handleRelayStateChange)
      this.relayClient.offError(this.handleRelayError)
      this.relayClient.disconnect()
      this.relayClient = null
    }

    this.state.connectionStatus = "disconnected"
  }

  /**
   * Connect relay client
   */
  private async connectRelay(): Promise<void> {
    const client = await createRelayClient(this.context)

    if (!client) {
      this.context.logger.warn("Failed to create relay client")
      this.state.connectionStatus = "failed"
      return
    }

    // Register handlers
    client.onEvent(this.handleRelayEvent)
    client.onStateChange(this.handleRelayStateChange)
    client.onError(this.handleRelayError)

    try {
      await client.connect()
      this.relayClient = client
      this.state.connectionStatus = "connected"
    } catch (error) {
      this.context.logger.error("Failed to connect relay client:", error)
      this.state.connectionStatus = "failed"
    }
  }

  /**
   * Handle relay event
   */
  private handleRelayEvent = (event: WebhookEvent): void => {
    // Notify all event handlers
    for (const handler of this.eventHandlers) {
      try {
        handler(event)
      } catch (error) {
        this.context.logger.error("Event handler error:", error)
      }
    }

    // Emit via RuntimeContext events
    this.context.events?.emit("webhook.received", {
      mode: "relay",
      source: event.source,
      timestamp: event.timestamp,
    })
  }

  /**
   * Handle relay state change
   */
  private handleRelayStateChange = (
    state: ConnectionState,
    reason?: string,
  ): void => {
    this.context.logger.debug(`Relay state: ${state}`, { reason })

    const statusMap: Record<ConnectionState, ConnectionStatus> = {
      disconnected: "disconnected",
      connecting: "connecting",
      connected: "connected",
      reconnecting: "reconnecting",
      failed: "failed",
      closed: "disconnected",
    }

    this.state.connectionStatus = statusMap[state] || "disconnected"

    // Auto-fallback on connection failure
    if (
      this.options.autoModeSwitching &&
      (state === "failed" || state === "closed")
    ) {
      const fallbackMode = getFallbackMode(this.state.currentMode, "webhook")
      if (fallbackMode !== this.state.currentMode) {
        this.context.logger.warn(
          `Relay connection failed, falling back to ${fallbackMode}`,
        )
        this.switchMode(fallbackMode, reason ?? "Connection failed")
      }
    }
  }

  /**
   * Handle relay error
   */
  private handleRelayError = (error: Error): void => {
    this.context.logger.error("Relay client error:", error)
  }

  /**
   * Health check
   */
  private async healthCheck(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    this.state.lastHealthCheck = Date.now()

    // Check if we can upgrade to a better mode
    if (this.options.autoUpgrade) {
      const canUpgrade = await canUpgradeMode(
        this.state.currentMode,
        this.context,
      )

      if (canUpgrade) {
        const bestMode = await getBestAvailableMode(this.context)
        if (bestMode !== this.state.currentMode) {
          this.context.logger.info(
            `Upgrading mode: ${this.state.currentMode} → ${bestMode}`,
          )
          await this.switchMode(bestMode, "Better mode available")
          return
        }
      }
    }

    // Check current mode health
    const isHealthy = await this.checkCurrentModeHealth()

    if (!isHealthy && this.options.autoModeSwitching) {
      const fallbackMode = getFallbackMode(this.state.currentMode, "webhook")
      if (fallbackMode !== this.state.currentMode) {
        this.context.logger.warn(
          `Current mode unhealthy, falling back to ${fallbackMode}`,
        )
        await this.switchMode(fallbackMode, "Health check failed")
      }
    }
  }

  /**
   * Check current mode health
   */
  private async checkCurrentModeHealth(): Promise<boolean> {
    switch (this.state.currentMode) {
      case "direct":
        return (await isDirectAvailable(this.context)).available

      case "relay":
        if (!this.relayClient) {
          return false
        }
        return this.relayClient.isConnected()

      case "polling":
        // Polling is always healthy
        return true

      default:
        return false
    }
  }
}

/**
 * Create webhook manager from context
 */
export async function createWebhookManager(
  context: RuntimeContext,
  options?: WebhookManagerOptions,
): Promise<WebhookManager> {
  return new WebhookManager(context, options)
}
