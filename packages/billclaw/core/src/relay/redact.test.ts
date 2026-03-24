/**
 * Tests for redactSensitive utility
 *
 * Ensures sensitive tokens are never logged or exposed in output.
 */

import { describe, it, expect } from "vitest"
import { redactSensitive, isSensitiveValue } from "./redact.js"

describe("redactSensitive", () => {
  describe("basic redaction", () => {
    it("redacts access_token field", () => {
      const data = { access_token: "sk_live_secret123", name: "test" }
      const safe = redactSensitive(data)
      expect(safe.access_token).toBe("sk_l***REDACTED***")
      expect(safe.name).toBe("test")
    })

    it("redacts accessToken field (camelCase)", () => {
      const data = { accessToken: "token123", userId: "user1" }
      const safe = redactSensitive(data)
      expect(safe.accessToken).toBe("toke***REDACTED***")
      expect(safe.userId).toBe("user1")
    })

    it("redacts refresh_token field", () => {
      const data = { refresh_token: "refresh_secret", count: 5 }
      const safe = redactSensitive(data)
      expect(safe.refresh_token).toBe("refr***REDACTED***")
      expect(safe.count).toBe(5)
    })

    it("redacts apiKey field", () => {
      const data = { apiKey: "api_key_secret", enabled: true }
      const safe = redactSensitive(data)
      expect(safe.apiKey).toBe("api_***REDACTED***")
      expect(safe.enabled).toBe(true)
    })
  })

  describe("prefix preservation", () => {
    it("preserves first 4 characters of token", () => {
      const data = { access_token: "sk_live_abc123xyz" }
      const safe = redactSensitive(data)
      expect(safe.access_token).toBe("sk_l***REDACTED***")
    })

    it("handles short tokens (less than 4 chars)", () => {
      const data = { access_token: "abc" }
      const safe = redactSensitive(data)
      expect(safe.access_token).toBe("***REDACTED***")
    })
  })

  describe("nested structures", () => {
    it("handles nested objects", () => {
      const data = {
        user: {
          access_token: "nested_token",
          name: "John",
        },
        count: 10,
      }
      const safe = redactSensitive(data)
      expect(safe.user.access_token).toBe("nest***REDACTED***")
      expect(safe.user.name).toBe("John")
      expect(safe.count).toBe(10)
    })

    it("handles arrays containing sensitive data", () => {
      const data = {
        items: [
          { access_token: "token1", name: "item1" },
          { name: "item2" },
        ],
      }
      const safe = redactSensitive(data)
      expect(safe.items[0].access_token).toBe("toke***REDACTED***")
      expect(safe.items[0].name).toBe("item1")
      expect(safe.items[1].name).toBe("item2")
    })
  })

  describe("edge cases", () => {
    it("returns primitives unchanged", () => {
      expect(redactSensitive("string")).toBe("string")
      expect(redactSensitive(123)).toBe(123)
      expect(redactSensitive(true)).toBe(true)
    })

    it("handles null and undefined", () => {
      expect(redactSensitive(null)).toBe(null)
      expect(redactSensitive(undefined)).toBe(undefined)
    })

    it("is case-insensitive for key matching", () => {
      const data1 = { ACCESS_TOKEN: "upper_case" }
      const data2 = { Access_Token: "mixed_case" }
      const data3 = { access_TOKEN: "weird_case" }

      expect(redactSensitive(data1).ACCESS_TOKEN).toBe("uppe***REDACTED***")
      expect(redactSensitive(data2).Access_Token).toBe("mixe***REDACTED***")
      expect(redactSensitive(data3).access_TOKEN).toBe("weir***REDACTED***")
    })

    it("handles empty objects", () => {
      expect(redactSensitive({})).toEqual({})
    })

    it("handles empty arrays", () => {
      expect(redactSensitive([])).toEqual([])
    })
  })

  describe("custom visible chars", () => {
    it("allows customizing visible characters count", () => {
      const data = { access_token: "sk_live_abc123" }
      const safe = redactSensitive(data, 6)
      expect(safe.access_token).toBe("sk_liv***REDACTED***")
    })

    it("handles zero visible chars", () => {
      const data = { access_token: "sk_live_abc123" }
      const safe = redactSensitive(data, 0)
      expect(safe.access_token).toBe("***REDACTED***")
    })
  })
})

describe("isSensitiveValue", () => {
  it("detects token-like values", () => {
    expect(isSensitiveValue("access_token_123")).toBe(true)
    expect(isSensitiveValue("my_api_key")).toBe(true)
    expect(isSensitiveValue("refresh_token")).toBe(true)
  })

  it("returns false for non-sensitive values", () => {
    expect(isSensitiveValue("normal_string")).toBe(false)
    expect(isSensitiveValue("user_id")).toBe(false)
    expect(isSensitiveValue("account_name")).toBe(false)
  })

  it("is case-insensitive", () => {
    expect(isSensitiveValue("ACCESS_TOKEN")).toBe(true)
    expect(isSensitiveValue("ApiKey")).toBe(true)
  })
})
