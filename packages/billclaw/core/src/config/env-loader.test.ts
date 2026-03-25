/**
 * Tests for environment variable loader
 *
 * Ensures environment variables are correctly mapped to config paths.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  loadEnvOverrides,
  getEnvValue,
  hasEnvOverrides,
  getEnvMappings,
} from "./env-loader.js"

describe("env-loader", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clear any test env vars
    delete process.env.FIRELA_RELAY_URL
    delete process.env.FIRELA_RELAY_API_KEY
    delete process.env.FIRELA_RELAY_TIMEOUT
    delete process.env.FIRELA_RELAY_MAX_RETRIES
  })

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv }
  })

  describe("relay environment variables", () => {
    it("maps FIRELA_RELAY_URL to relay.url", () => {
      process.env.FIRELA_RELAY_URL = "https://relay.firela.io"
      const overrides = loadEnvOverrides()
      expect(overrides.relay).toBeDefined()
      expect((overrides.relay as Record<string, unknown>).url).toBe(
        "https://relay.firela.io",
      )
    })

    it("maps FIRELA_RELAY_API_KEY to relay.apiKey", () => {
      process.env.FIRELA_RELAY_API_KEY = "test-api-key-12345"
      const overrides = loadEnvOverrides()
      expect(overrides.relay).toBeDefined()
      expect((overrides.relay as Record<string, unknown>).apiKey).toBe(
        "test-api-key-12345",
      )
    })

    it("maps FIRELA_RELAY_TIMEOUT to relay.timeout as number", () => {
      process.env.FIRELA_RELAY_TIMEOUT = "5000"
      const overrides = loadEnvOverrides()
      expect(overrides.relay).toBeDefined()
      expect((overrides.relay as Record<string, unknown>).timeout).toBe(5000)
    })

    it("maps FIRELA_RELAY_MAX_RETRIES to relay.maxRetries as number", () => {
      process.env.FIRELA_RELAY_MAX_RETRIES = "3"
      const overrides = loadEnvOverrides()
      expect(overrides.relay).toBeDefined()
      expect((overrides.relay as Record<string, unknown>).maxRetries).toBe(3)
    })

    it("hasEnvOverrides returns true when FIRELA_RELAY_URL is set", () => {
      expect(hasEnvOverrides()).toBe(false)
      process.env.FIRELA_RELAY_URL = "https://relay.firela.io"
      expect(hasEnvOverrides()).toBe(true)
    })

    it("hasEnvOverrides returns true when FIRELA_RELAY_API_KEY is set", () => {
      expect(hasEnvOverrides()).toBe(false)
      process.env.FIRELA_RELAY_API_KEY = "test-key"
      expect(hasEnvOverrides()).toBe(true)
    })

    it("combines multiple relay env vars into single relay object", () => {
      process.env.FIRELA_RELAY_URL = "https://relay.example.com"
      process.env.FIRELA_RELAY_API_KEY = "key123"
      process.env.FIRELA_RELAY_TIMEOUT = "3000"

      const overrides = loadEnvOverrides()
      expect(overrides.relay).toEqual({
        url: "https://relay.example.com",
        apiKey: "key123",
        timeout: 3000,
      })
    })
  })

  describe("existing functionality", () => {
    it("maps PLAID_CLIENT_ID to plaid.clientId", () => {
      process.env.PLAID_CLIENT_ID = "test-client-id"
      const overrides = loadEnvOverrides()
      expect((overrides.plaid as Record<string, unknown>).clientId).toBe(
        "test-client-id",
      )
    })

    it("hasEnvOverrides returns true for existing env vars", () => {
      process.env.PLAID_CLIENT_ID = "test"
      expect(hasEnvOverrides()).toBe(true)
    })
  })

  describe("getEnvMappings", () => {
    it("includes relay mappings", () => {
      const mappings = getEnvMappings()
      expect(mappings.FIRELA_RELAY_URL).toBe("relay.url")
      expect(mappings.FIRELA_RELAY_API_KEY).toBe("relay.apiKey")
      expect(mappings.FIRELA_RELAY_TIMEOUT).toBe("relay.timeout")
      expect(mappings.FIRELA_RELAY_MAX_RETRIES).toBe("relay.maxRetries")
    })
  })

  describe("getEnvValue", () => {
    it("returns converted value for relay URL", () => {
      process.env.FIRELA_RELAY_URL = "https://test.relay.io"
      const value = getEnvValue("FIRELA_RELAY_URL", "relay.url")
      expect(value).toBe("https://test.relay.io")
    })

    it("returns undefined for unset env var", () => {
      const value = getEnvValue("FIRELA_RELAY_URL", "relay.url")
      expect(value).toBeUndefined()
    })
  })
})
