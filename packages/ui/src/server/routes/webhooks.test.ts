/**
 * Unit tests for webhook routes — createPlaidVerifier wiring
 *
 * Tests the RelayClient-backed JWK fetch integration:
 * - RelayClient is constructed with env credentials
 * - fetchVerificationKey calls correct relay proxy endpoint
 * - RelayJwkProxyResponse is mapped correctly to { key }
 * - Fail-closed behavior when RelayClient throws
 */

import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock RelayClient before importing the module under test
const mockRequest = vi.fn()
vi.mock("@firela/billclaw-core/relay", () => ({
  RelayClient: vi.fn().mockImplementation((config: { url: string; apiKey: string }) => {
    // Capture constructor args for assertions
    mockRequest._constructorArgs = config
    return {
      request: mockRequest,
      healthCheck: vi.fn(),
    }
  }),
}))

// Mock PlaidWebhookVerifier to capture the fetchVerificationKey callback
const mockVerify = vi.fn()
vi.mock("@firela/billclaw-core", () => ({
  PlaidWebhookVerifier: vi.fn().mockImplementation(
    (_logger: unknown, fetchVerificationKey: (kid: string) => Promise<{ key: unknown }>) => {
      mockVerify._fetchVerificationKey = fetchVerificationKey
      return {
        verify: mockVerify,
      }
    },
  ),
}))

// Import after mocks are set up
import { RelayClient } from "@firela/billclaw-core/relay"
import { createPlaidVerifier } from "./webhooks.js"
import type { RelayJwkProxyResponse } from "@firela/billclaw-core/relay"

const mockEnv = {
  DB: {} as unknown as D1Database,
  CONFIG: {} as unknown as KVNamespace,
  PLAID_CLIENT_ID: "test-client-id",
  PLAID_SECRET: "test-secret",
  PLAID_ENV: "sandbox",
  PLAID_WEBHOOK_SECRET: "test-webhook-secret",
  JWT_SECRET: "test-jwt-secret",
  FIRELA_RELAY_URL: "https://relay.example.com",
  FIRELA_RELAY_API_KEY: "relay-api-key-12345",
}

describe("createPlaidVerifier", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates RelayClient with env credentials", () => {
    createPlaidVerifier(mockEnv)

    expect(RelayClient).toHaveBeenCalledWith({
      url: mockEnv.FIRELA_RELAY_URL,
      apiKey: mockEnv.FIRELA_RELAY_API_KEY,
    })
  })

  it("fetchVerificationKey calls relay proxy endpoint with correct kid", async () => {
    const mockKeyResponse: RelayJwkProxyResponse = {
      key: {
        kid: "test-kid-123",
        kty: "EC",
        alg: "ES256",
        use: "sig",
        crv: "P-256",
        x: "test-x-coordinate",
        y: "test-y-coordinate",
        created_at: 1700000000,
        expired_at: null,
      },
    }
    mockRequest.mockResolvedValue(mockKeyResponse)

    createPlaidVerifier(mockEnv)

    // Call the captured fetchVerificationKey callback
    const fetchKey = mockVerify._fetchVerificationKey as (
      kid: string,
    ) => Promise<{ key: unknown }>
    const result = await fetchKey("test-kid-123")

    expect(mockRequest).toHaveBeenCalledWith<
      [string, RequestInit | undefined]
    >("/api/open-banking/plaid/webhook-key/test-kid-123", undefined)
    expect(result).toEqual({ key: mockKeyResponse.key })
  })

  it("maps RelayJwkProxyResponse key to { key: response.key }", async () => {
    const mockKeyResponse: RelayJwkProxyResponse = {
      key: {
        kid: "another-kid",
        kty: "EC",
        alg: "ES256",
        use: "sig",
        crv: "P-256",
        x: "x-value",
        y: "y-value",
        created_at: 1700000000,
        expired_at: 1735689600,
      },
    }
    mockRequest.mockResolvedValue(mockKeyResponse)

    createPlaidVerifier(mockEnv)

    const fetchKey = mockVerify._fetchVerificationKey as (
      kid: string,
    ) => Promise<{ key: unknown }>
    const result = await fetchKey("another-kid")

    expect(result.key).toBe(mockKeyResponse.key)
  })

  it("propagates error when RelayClient.request throws (fail-closed)", async () => {
    const relayError = new Error("HTTP 404: key not found")
    mockRequest.mockRejectedValue(relayError)

    createPlaidVerifier(mockEnv)

    const fetchKey = mockVerify._fetchVerificationKey as (
      kid: string,
    ) => Promise<{ key: unknown }>

    await expect(fetchKey("unknown-kid")).rejects.toThrow(
      "HTTP 404: key not found",
    )
  })

  it("propagates network error when RelayClient.request fails (fail-closed)", async () => {
    const networkError = new Error("ECONNREFUSED")
    mockRequest.mockRejectedValue(networkError)

    createPlaidVerifier(mockEnv)

    const fetchKey = mockVerify._fetchVerificationKey as (
      kid: string,
    ) => Promise<{ key: unknown }>

    await expect(fetchKey("any-kid")).rejects.toThrow("ECONNREFUSED")
  })
})
