/**
 * Authentication endpoint tests
 *
 * Tests for POST /auth/setup, GET /auth/status, and POST /auth/verify endpoints
 */

import { describe, it, expect, beforeAll } from "vitest"
import { SELF, env } from "cloudflare:test"
import { warmUp } from "./setup"
import type { Env } from "../src/types/env"

describe("Auth Endpoints", () => {
  let testEnv: Env

  beforeAll(async () => {
    // Warm up worker to avoid cold start issues
    await warmUp()
    testEnv = env as Env
  })

  describe("POST /auth/setup", () => {
    it("should return 401 with invalid password", async () => {
      const response = await SELF.fetch("http://localhost/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "invalid-password" }),
      })

      expect(response.status).toBe(401)
      const body = (await response.json()) as {
        success: boolean
        error: string
        errorCode: string
      }
      expect(body.success).toBe(false)
      expect(body.error).toBe("Invalid setup password")
      expect(body.errorCode).toBe("SETUP_INVALID_PASSWORD")
    })

    it("should return JWT token with valid password", async () => {
      const response = await SELF.fetch("http://localhost/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: testEnv.SETUP_PASSWORD }),
      })

      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        success: boolean
        token: string
        expiresIn: number
        tokenType: string
        user: { id: string; role: string }
      }
      expect(body.success).toBe(true)
      expect(body.token).toBeDefined()
      expect(typeof body.token).toBe("string")
      expect(body.expiresIn).toBe(365 * 24 * 60 * 60) // 1 year
      expect(body.tokenType).toBe("Bearer")
      expect(body.user).toMatchObject({ id: "owner", role: "owner" })
    })
  })

  describe("GET /auth/status", () => {
    it("should return setup status", async () => {
      const response = await SELF.fetch("http://localhost/auth/status")

      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        success: boolean
        configured: boolean
        authType: string
        setupRequired: boolean
      }
      expect(body.success).toBe(true)
      expect(body.configured).toBe(true)
      expect(body.authType).toBe("jwt")
      expect(typeof body.setupRequired).toBe("boolean")
    })
  })

  describe("POST /auth/verify", () => {
    it("should return 401 without JWT token", async () => {
      const response = await SELF.fetch("http://localhost/auth/verify", {
        method: "POST",
      })

      expect(response.status).toBe(401)
      const body = (await response.json()) as {
        success: boolean
        error: string
        errorCode: string
      }
      expect(body.success).toBe(false)
      expect(body.error).toBe("Missing or invalid Authorization header")
      expect(body.errorCode).toBe("AUTH_MISSING")
    })

    it("should return success with valid JWT token", async () => {
      // First get a token via setup
      const setupResponse = await SELF.fetch("http://localhost/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: testEnv.SETUP_PASSWORD }),
      })

      const setupBody = (await setupResponse.json()) as { token: string }
      const token = setupBody.token

      // Now verify with the token
      const response = await SELF.fetch("http://localhost/auth/verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        success: boolean
        payload: { sub: string; role: string; iat: number; exp: number }
      }
      expect(body.success).toBe(true)
      expect(body.payload.sub).toBe("owner")
      expect(body.payload.role).toBe("owner")
      expect(body.payload.iat).toBeDefined()
      expect(body.payload.exp).toBeDefined()
    })

    it("should return 401 with invalid JWT token", async () => {
      const response = await SELF.fetch("http://localhost/auth/verify", {
        method: "POST",
        headers: { Authorization: "Bearer invalid-token" },
      })

      expect(response.status).toBe(401)
      const body = (await response.json()) as {
        success: boolean
        error: string
        errorCode: string
      }
      expect(body.success).toBe(false)
      expect(body.error).toBe("Invalid or expired token")
      expect(body.errorCode).toBe("AUTH_INVALID")
    })
  })
})
