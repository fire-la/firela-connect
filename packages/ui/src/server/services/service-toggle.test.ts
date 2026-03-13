/**
 * Service Toggle Store Tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

import { getServiceState, setServiceEnabled, isServiceEnabled } from "./service-toggle.js"
import type { Env } from "../index.js"

/**
 * Mock KV namespace for testing
 */
function createMockKV() {
  const store: Record<string, string> = {}
  return {
    get: vi.fn(async (key: string, type: string) => {
      if (type === "json") {
        return store[key] ? JSON.parse(store[key]) : null
      }
      return store[key] || null
    }),
    put: vi.fn(async (key: string, value: string) => {
      store[key] = value
    }),
  }
}

describe("service-toggle", () => {
  let mockKV: ReturnType<typeof createMockKV>

  beforeEach(() => {
    mockKV = createMockKV()
  })

  describe("getServiceState", () => {
    it("should return default values when no state is stored", async () => {
      const env = {
        CONFIG: mockKV,
        BILLCLAW_ENABLED: "true",
        FIRELA_BOT_ENABLED: "true",
      } as unknown as Env

      const state = await getServiceState(env)

      expect(state.billclaw).toBe(true)
      expect(state.firelaBot).toBe(true)
    })

    it("should return false when env var is 'false'", async () => {
      const env = {
        CONFIG: mockKV,
        BILLCLAW_ENABLED: "false",
        FIRELA_BOT_ENABLED: "true",
      } as unknown as Env

      const state = await getServiceState(env)

      expect(state.billclaw).toBe(false)
      expect(state.firelaBot).toBe(true)
    })

    it("should return stored state when available", async () => {
      await mockKV.put("service-toggles", JSON.stringify({ billclaw: false, firelaBot: false }))

      const env = {
        CONFIG: mockKV,
        BILLCLAW_ENABLED: "true",
        FIRELA_BOT_ENABLED: "true",
      } as unknown as Env

      const state = await getServiceState(env)

      expect(state.billclaw).toBe(false)
      expect(state.firelaBot).toBe(false)
    })
  })

  describe("setServiceEnabled", () => {
    it("should update service state in KV", async () => {
      const env = {
        CONFIG: mockKV,
        BILLCLAW_ENABLED: "true",
        FIRELA_BOT_ENABLED: "true",
      } as unknown as Env

      const state = await setServiceEnabled(env, "billclaw", false)

      expect(state.billclaw).toBe(false)
      expect(state.firelaBot).toBe(true)
      expect(mockKV.put).toHaveBeenCalledWith("service-toggles", JSON.stringify({ billclaw: false, firelaBot: true }))
    })

    it("should preserve other service states when updating", async () => {
      // First set billclaw to false
      const env = {
        CONFIG: mockKV,
        BILLCLAW_ENABLED: "true",
        FIRELA_BOT_ENABLED: "true",
      } as unknown as Env

      await setServiceEnabled(env, "billclaw", false)

      // Now disable firelaBot
      const state = await setServiceEnabled(env, "firelaBot", false)

      expect(state.billclaw).toBe(false)
      expect(state.firelaBot).toBe(false)
    })
  })

  describe("isServiceEnabled", () => {
    it("should return true for enabled service", async () => {
      const env = {
        CONFIG: mockKV,
        BILLCLAW_ENABLED: "true",
        FIRELA_BOT_ENABLED: "true",
      } as unknown as Env

      const enabled = await isServiceEnabled(env, "billclaw")

      expect(enabled).toBe(true)
    })

    it("should return false for disabled service", async () => {
      await mockKV.put("service-toggles", JSON.stringify({ billclaw: false, firelaBot: true }))

      const env = {
        CONFIG: mockKV,
        BILLCLAW_ENABLED: "true",
        FIRELA_BOT_ENABLED: "true",
      } as unknown as Env

      const enabled = await isServiceEnabled(env, "billclaw")

      expect(enabled).toBe(false)
    })
  })
})
