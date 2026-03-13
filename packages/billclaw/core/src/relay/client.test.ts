/**
 * Tests for Relay WebSocket client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { RelayWebSocketClient } from "./client.js"
import type { RuntimeContext, Logger, ConfigProvider } from "../runtime/types.js"

function createMockContext(): RuntimeContext {
  const logger: Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }

  const config: ConfigProvider = {
    getConfig: vi.fn().mockResolvedValue({
      connect: {
        receiver: {
          relay: {
            enabled: true,
            wsUrl: "wss://relay.test.io/ws",
            webhookId: "test-webhook-id",
            apiKey: "test-api-key",
            reconnect: true,
            reconnectDelay: 1000,
            maxReconnectDelay: 30000,
          },
        },
      },
    }),
    saveConfig: vi.fn(),
    getConfigPath: vi.fn().mockReturnValue("/test/config.json"),
  }

  return { logger, config }
}

describe("RelayWebSocketClient", () => {
  let client: RelayWebSocketClient
  let mockContext: RuntimeContext

  const defaultConfig = {
    wsUrl: "wss://relay.test.io/ws",
    webhookId: "test-webhook-id",
    apiKey: "test-api-key",
    reconnect: true,
    reconnectDelay: 1000,
    maxReconnectDelay: 30000,
    autoFallbackToPolling: true,
  }

  beforeEach(() => {
    vi.useFakeTimers()
    mockContext = createMockContext()
    client = new RelayWebSocketClient(defaultConfig, mockContext)
  })

  afterEach(() => {
    client.disconnect()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe("connection", () => {
    it("should start in disconnected state", () => {
      const stats = client.getStats()
      expect(stats.state).toBe("disconnected")
      expect(stats.reconnectAttempts).toBe(0)
    })

    it("should not be connected initially", () => {
      expect(client.isConnected()).toBe(false)
    })
  })

  describe("manual disconnect", () => {
    it("should not trigger reconnect when manually disconnected", () => {
      client.disconnect()
      const stats = client.getStats()
      expect(stats.state).toBe("closed")
    })
  })

  describe("event handlers", () => {
    it("should register and unregister event handlers", () => {
      const eventHandler = vi.fn()
      client.onEvent(eventHandler)
      client.offEvent(eventHandler)
    })

    it("should register and unregister state change handlers", () => {
      const stateHandler = vi.fn()
      client.onStateChange(stateHandler)
      client.offStateChange(stateHandler)
    })

    it("should register and unregister error handlers", () => {
      const errorHandler = vi.fn()
      client.onError(errorHandler)
      client.offError(errorHandler)
    })
  })

  describe("stats", () => {
    it("should track connection stats", () => {
      const stats = client.getStats()
      expect(stats.state).toBe("disconnected")
      expect(stats.reconnectAttempts).toBe(0)
      expect(stats.eventsReceived).toBe(0)
      expect(stats.eventsAcked).toBe(0)
      expect(stats.eventsRecovered).toBe(0)
    })
  })
})
