import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock jose before importing the module under test
vi.mock("jose", () => ({
  decodeProtectedHeader: vi.fn(),
  importJWK: vi.fn(),
  jwtVerify: vi.fn(),
}))

import * as jose from "jose"
import { PlaidWebhookVerifier } from "./security.js"
import type { Logger } from "../errors/errors.js"

const mockDecodeProtectedHeader = vi.mocked(jose.decodeProtectedHeader)
const mockImportJWK = vi.mocked(jose.importJWK)
const mockJwtVerify = vi.mocked(jose.jwtVerify)

function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

function createMockFetchKey() {
  return vi.fn()
}

describe("PlaidWebhookVerifier", () => {
  let verifier: PlaidWebhookVerifier
  let logger: Logger
  let fetchVerificationKey: ReturnType<typeof createMockFetchKey>

  const fakeJWK = { kty: "EC", crv: "P-256", x: "test", y: "test", kid: "key-1" }
  const fakePublicKey = Symbol("publicKey") as unknown as Awaited<
    ReturnType<typeof jose.importJWK>
  >
  const fakePayload = {
    request_body_sha256:
      "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f",
    iat: Math.floor(Date.now() / 1000),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    logger = createMockLogger()
    fetchVerificationKey = createMockFetchKey()
    verifier = new PlaidWebhookVerifier(logger, fetchVerificationKey)
  })

  describe("verify()", () => {
    it("Test 1: returns true for valid ES256 JWT with matching body hash", async () => {
      const rawBody = "Hello, World!"

      mockDecodeProtectedHeader.mockReturnValue({ kid: "key-1", alg: "ES256" })
      fetchVerificationKey.mockResolvedValue({ key: fakeJWK })
      mockImportJWK.mockResolvedValue(fakePublicKey)
      mockJwtVerify.mockResolvedValue({
        payload: fakePayload,
        protectedHeader: { kid: "key-1", alg: "ES256" },
      } as Awaited<ReturnType<typeof jose.jwtVerify>>)

      const result = await verifier.verify(rawBody, "valid-jwt-token")
      expect(result).toBe(true)

      expect(mockDecodeProtectedHeader).toHaveBeenCalledWith("valid-jwt-token")
      expect(fetchVerificationKey).toHaveBeenCalledWith("key-1")
      expect(mockImportJWK).toHaveBeenCalledWith(fakeJWK, "ES256")
      expect(mockJwtVerify).toHaveBeenCalledWith(
        "valid-jwt-token",
        fakePublicKey,
        { maxTokenAge: "5m" },
      )
    })

    it("Test 2: returns false when JWT algorithm is not ES256", async () => {
      mockDecodeProtectedHeader.mockReturnValue({ kid: "key-1", alg: "RS256" })

      const result = await verifier.verify("body", "jwt-token")
      expect(result).toBe(false)

      expect(fetchVerificationKey).not.toHaveBeenCalled()
    })

    it("Test 3: returns false when JWT is older than 5 minutes (maxTokenAge)", async () => {
      mockDecodeProtectedHeader.mockReturnValue({ kid: "key-1", alg: "ES256" })
      fetchVerificationKey.mockResolvedValue({ key: fakeJWK })
      mockImportJWK.mockResolvedValue(fakePublicKey)
      // jwtVerify throws when maxTokenAge is exceeded
      mockJwtVerify.mockRejectedValue(new Error("too old"))

      const result = await verifier.verify("body", "expired-jwt")
      expect(result).toBe(false)
    })

    it("Test 4: returns false when request_body_sha256 does not match computed body hash", async () => {
      mockDecodeProtectedHeader.mockReturnValue({ kid: "key-1", alg: "ES256" })
      fetchVerificationKey.mockResolvedValue({ key: fakeJWK })
      mockImportJWK.mockResolvedValue(fakePublicKey)
      mockJwtVerify.mockResolvedValue({
        payload: { request_body_sha256: "wrong-hash", iat: Math.floor(Date.now() / 1000) },
        protectedHeader: { kid: "key-1", alg: "ES256" },
      } as Awaited<ReturnType<typeof jose.jwtVerify>>)

      const result = await verifier.verify("body", "jwt-with-wrong-hash")
      expect(result).toBe(false)
    })

    it("Test 5: returns false when Plaid-Verification header is missing (empty string)", async () => {
      // decodeProtectedHeader will throw on invalid/empty input
      mockDecodeProtectedHeader.mockImplementation(() => {
        throw new Error("Invalid JWT")
      })

      const result = await verifier.verify("body", "")
      expect(result).toBe(false)
    })

    it("Test 5b: returns false when kid is missing from header", async () => {
      mockDecodeProtectedHeader.mockReturnValue({ alg: "ES256" })

      const result = await verifier.verify("body", "jwt-no-kid")
      expect(result).toBe(false)
    })
  })

  describe("JWK caching (getOrFetchKey)", () => {
    it("Test 6: returns cached key when cache is valid and kid matches", async () => {
      mockDecodeProtectedHeader.mockReturnValue({ kid: "key-1", alg: "ES256" })
      fetchVerificationKey.mockResolvedValue({ key: fakeJWK })
      mockImportJWK.mockResolvedValue(fakePublicKey)
      mockJwtVerify.mockResolvedValue({
        payload: fakePayload,
        protectedHeader: { kid: "key-1", alg: "ES256" },
      } as Awaited<ReturnType<typeof jose.jwtVerify>>)

      // First call - should fetch
      await verifier.verify("Hello, World!", "jwt-1")
      expect(fetchVerificationKey).toHaveBeenCalledTimes(1)

      // Second call with same kid - should use cache
      await verifier.verify("Hello, World!", "jwt-2")
      expect(fetchVerificationKey).toHaveBeenCalledTimes(1) // Still 1, not 2
    })

    it("Test 7: fetches new key when kid changes", async () => {
      const newJWK = { kty: "EC", crv: "P-256", x: "new", y: "new", kid: "key-2" }

      mockDecodeProtectedHeader.mockReturnValue({ kid: "key-1", alg: "ES256" })
      fetchVerificationKey.mockResolvedValue({ key: fakeJWK })
      mockImportJWK.mockResolvedValue(fakePublicKey)
      mockJwtVerify.mockResolvedValue({
        payload: fakePayload,
        protectedHeader: { kid: "key-1", alg: "ES256" },
      } as Awaited<ReturnType<typeof jose.jwtVerify>>)

      // First call with kid=key-1
      await verifier.verify("Hello, World!", "jwt-1")

      // Change kid and setup for new key
      mockDecodeProtectedHeader.mockReturnValue({ kid: "key-2", alg: "ES256" })
      fetchVerificationKey.mockResolvedValue({ key: newJWK })

      // Second call with kid=key-2 - should fetch new key
      await verifier.verify("Hello, World!", "jwt-2")
      expect(fetchVerificationKey).toHaveBeenCalledTimes(2)
    })

    it("Test 8: fetches new key when cache TTL expires (>1 hour)", async () => {
      vi.useFakeTimers()

      mockDecodeProtectedHeader.mockReturnValue({ kid: "key-1", alg: "ES256" })
      fetchVerificationKey.mockResolvedValue({ key: fakeJWK })
      mockImportJWK.mockResolvedValue(fakePublicKey)
      mockJwtVerify.mockResolvedValue({
        payload: fakePayload,
        protectedHeader: { kid: "key-1", alg: "ES256" },
      } as Awaited<ReturnType<typeof jose.jwtVerify>>)

      // First call
      await verifier.verify("Hello, World!", "jwt-1")
      expect(fetchVerificationKey).toHaveBeenCalledTimes(1)

      // Advance time by more than 1 hour
      vi.advanceTimersByTime(60 * 60 * 1000 + 1)

      // Second call - cache should be expired, should re-fetch
      await verifier.verify("Hello, World!", "jwt-2")
      expect(fetchVerificationKey).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })
  })
})
