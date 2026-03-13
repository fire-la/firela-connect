/**
 * Relay WebSocket client
 *
 * Manages WebSocket connection to Firela Relay service for receiving webhook events.
 *
 * @packageDocumentation
 */

import { WebSocket } from "ws"
import type { RuntimeContext } from "../runtime/types.js"
import type {
  RelayConnectionConfig,
  ConnectionState,
  RelayConnectionStats,
  RelayMessage,
  AuthMessage,
  WebhookEvent,
  RelayEventHandler,
  RelayStateChangeHandler,
  RelayErrorHandler,
} from "./types.js"
import { MessageDirectionSchema } from "./types.js"
import { calculateBackoffDelay } from "./backoff.js"

/**
 * WebSocket client for Firela Relay service
 */
export class RelayWebSocketClient {
  private ws: WebSocket | null = null
  private config: RelayConnectionConfig
  private context: RuntimeContext
  private stats: RelayConnectionStats
  private reconnectTimeout: NodeJS.Timeout | null = null
  private heartbeatTimeout: NodeJS.Timeout | null = null
  private eventHandlers: Set<RelayEventHandler> = new Set()
  private stateChangeHandlers: Set<RelayStateChangeHandler> = new Set()
  private errorHandlers: Set<RelayErrorHandler> = new Set()
  private pendingEvents = new Map<string, WebhookEvent>()

  constructor(config: RelayConnectionConfig, context: RuntimeContext) {
    this.config = config
    this.context = context
    this.stats = {
      state: "disconnected",
      reconnectAttempts: 0,
      eventsReceived: 0,
      eventsAcked: 0,
      eventsRecovered: 0,
    }
  }

  /**
   * Connect to relay service
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.context.logger.debug("Relay client: already connected")
      return
    }

    this.setState("connecting")

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.config.wsUrl)
        this.ws = ws

        ws.on("open", () => {
          this.context.logger.debug("Relay client: WebSocket connected")
          // Send auth message
          this.authenticate()
          resolve()
        })

        ws.on("message", (data: Buffer) => {
          this.handleMessage(data)
        })

        ws.on("error", (error: Error) => {
          this.context.logger.error("Relay client: WebSocket error", error)
          this.notifyError(error)
        })

        ws.on("close", () => {
          this.context.logger.debug("Relay client: WebSocket closed")
          this.handleClose()
        })

        ws.on("ping", () => {
          // Respond to ping with pong
          ws.pong()
        })
      } catch (error) {
        this.setState("failed", String(error))
        reject(error)
      }
    })
  }

  /**
   * Disconnect from relay service
   */
  disconnect(): void {
    this.clearReconnectTimeout()
    this.clearHeartbeatTimeout()

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.setState("closed", "Disconnected by client")
  }

  /**
   * Register event handler
   */
  onEvent(handler: RelayEventHandler): void {
    this.eventHandlers.add(handler)
  }

  /**
   * Unregister event handler
   */
  offEvent(handler: RelayEventHandler): void {
    this.eventHandlers.delete(handler)
  }

  /**
   * Register state change handler
   */
  onStateChange(handler: RelayStateChangeHandler): void {
    this.stateChangeHandlers.add(handler)
  }

  /**
   * Unregister state change handler
   */
  offStateChange(handler: RelayStateChangeHandler): void {
    this.stateChangeHandlers.delete(handler)
  }

  /**
   * Register error handler
   */
  onError(handler: RelayErrorHandler): void {
    this.errorHandlers.add(handler)
  }

  /**
   * Unregister error handler
   */
  offError(handler: RelayErrorHandler): void {
    this.errorHandlers.delete(handler)
  }

  /**
   * Get current connection stats
   */
  getStats(): RelayConnectionStats {
    return { ...this.stats }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.stats.state === "connected"
  }

  /**
   * Send authentication message
   */
  private authenticate(): void {
    const authMessage: AuthMessage = {
      type: MessageDirectionSchema.AUTH,
      webhookId: this.config.webhookId,
      apiKey: this.config.apiKey,
      timestamp: Date.now(),
    }

    this.sendMessage(authMessage)
    this.context.logger.debug("Relay client: authentication sent")
  }

  /**
   * Send message to server
   */
  private sendMessage(message: RelayMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: Buffer): void {
    try {
      const message: RelayMessage = JSON.parse(data.toString())

      switch (message.type) {
        case MessageDirectionSchema.AUTH_SUCCESS:
          this.handleAuthSuccess(message)
          break

        case MessageDirectionSchema.AUTH_ERROR:
          this.handleAuthError(message)
          break

        case MessageDirectionSchema.HEARTBEAT:
          this.handleHeartbeat(message)
          break

        case MessageDirectionSchema.WEBHOOK_EVENT:
          this.handleWebhookEvent(message)
          break

        case MessageDirectionSchema.STATE_CHANGE:
          this.handleStateChange(message)
          break

        default:
          this.context.logger.warn("Relay client: unknown message type", message)
      }
    } catch (error) {
      this.context.logger.error("Relay client: failed to parse message", error)
    }
  }

  /**
   * Handle auth success
   */
  private handleAuthSuccess(_message: any): void {
    this.context.logger.info("Relay client: authenticated successfully")
    this.setState("connected")
    this.stats.reconnectAttempts = 0
    this.startHeartbeat()
  }

  /**
   * Handle auth error
   */
  private handleAuthError(message: any): void {
    this.context.logger.error("Relay client: authentication failed", message.error)
    this.setState("failed", message.error)
    this.notifyError(new Error(message.error))
    this.scheduleReconnect()
  }

  /**
   * Handle heartbeat
   */
  private handleHeartbeat(message: any): void {
    this.stats.lastHeartbeat = message.timestamp

    // Send heartbeat ack
    this.sendMessage({
      type: MessageDirectionSchema.HEARTBEAT_ACK,
      timestamp: Date.now(),
    })

    // Reset heartbeat timeout
    this.startHeartbeat()
  }

  /**
   * Handle webhook event
   */
  private handleWebhookEvent(message: any): void {
    this.stats.eventsReceived++

    // Store pending event
    this.pendingEvents.set(message.eventId, message.event)

    // Notify handlers
    for (const handler of this.eventHandlers) {
      try {
        handler(message.event)
      } catch (error) {
        this.context.logger.error("Relay client: event handler error", error)
      }
    }

    // Send ack
    this.sendMessage({
      type: MessageDirectionSchema.EVENT_ACK,
      eventId: message.eventId,
      timestamp: Date.now(),
    })

    this.stats.eventsAcked++
    this.pendingEvents.delete(message.eventId)
  }

  /**
   * Handle state change from server
   */
  private handleStateChange(message: any): void {
    this.setState(message.state, message.reason)
  }

  /**
   * Handle connection close
   */
  private handleClose(): void {
    this.setState("disconnected", "Connection closed")
    this.scheduleReconnect()
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (!this.config.reconnect || this.stats.state === "closed") {
      return
    }

    this.clearReconnectTimeout()

    // Calculate delay using Full Jitter backoff
    const delay = calculateBackoffDelay(
      this.config.reconnectDelay,
      this.config.maxReconnectDelay,
      this.stats.reconnectAttempts
    )

    this.context.logger.debug(`Relay client: scheduling reconnect in ${delay}ms`)

    this.setState("reconnecting", `Reconnecting in ${delay}ms`)

    this.reconnectTimeout = setTimeout(async () => {
      this.stats.reconnectAttempts++
      try {
        await this.connect()
      } catch (error) {
        this.context.logger.error("Relay client: reconnect failed", error)
        this.scheduleReconnect()
      }
    }, delay)
  }

  /**
   * Clear reconnect timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }

  /**
   * Start heartbeat timeout
   */
  private startHeartbeat(): void {
    this.clearHeartbeatTimeout()

    // Expect heartbeat every 30 seconds
    this.heartbeatTimeout = setTimeout(() => {
      this.context.logger.warn("Relay client: heartbeat timeout")
      this.setState("failed", "Heartbeat timeout")
      this.ws?.close()
    }, 30000)
  }

  /**
   * Clear heartbeat timeout
   */
  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }
  }

  /**
   * Set connection state
   */
  private setState(state: ConnectionState, reason?: string): void {
    const oldState = this.stats.state
    this.stats.state = state

    if (reason) {
      this.stats.lastError = reason
    }

    if (state === "connected") {
      this.stats.connectedAt = Date.now()
    }

    // Notify handlers if state changed
    if (oldState !== state) {
      this.context.logger.debug(`Relay client: state ${oldState} → ${state}`)
      for (const handler of this.stateChangeHandlers) {
        try {
          handler(state, reason)
        } catch (error) {
          this.context.logger.error("Relay client: state change handler error", error)
        }
      }
    }
  }

  /**
   * Notify error handlers
   */
  private notifyError(error: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error)
      } catch (err) {
        this.context.logger.error("Relay client: error handler error", err)
      }
    }
  }
}

/**
 * Create relay client from context configuration
 */
export async function createRelayClient(
  context: RuntimeContext,
): Promise<RelayWebSocketClient | null> {
  const config = await context.config.getConfig()
  const relayConfig = config.connect?.receiver?.relay

  if (!relayConfig?.enabled || !relayConfig.webhookId || !relayConfig.apiKey) {
    return null
  }

  return new RelayWebSocketClient(
    {
      wsUrl: relayConfig.wsUrl,
      webhookId: relayConfig.webhookId,
      apiKey: relayConfig.apiKey,
      reconnect: relayConfig.reconnect ?? true,
      reconnectDelay: relayConfig.reconnectDelay ?? 1000,
      maxReconnectDelay: relayConfig.maxReconnectDelay ?? 300000,
      autoFallbackToPolling: relayConfig.autoFallbackToPolling ?? true,
      enableRecovery: relayConfig.enableRecovery ?? true,
      maxRecoveryEvents: relayConfig.maxRecoveryEvents ?? 100,
    },
    context,
  )
}
