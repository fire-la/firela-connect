/**
 * Authentication Routes
 *
 * Provides endpoints for JWT token management.
 *
 * Migrated from packages/billclaw/worker/src/routes/auth.ts
 *
 * @packageDocumentation
 */

import { Hono } from "hono"
import { sign, verify } from "hono/jwt"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import type { Env } from "../index.js"

export const authRoutes = new Hono<{ Bindings: Env }>()

/**
 * Request schema for POST /auth/setup
 */
const setupRequestSchema = z.object({
  password: z.string().min(1, "Password is required"),
})

/**
 * POST /auth/setup
 *
 * One-time setup endpoint to generate the initial JWT token.
 *
 * This endpoint is used during initial deployment to generate
 * a long-lived JWT token for the owner. The token can then be
 * used for all subsequent API calls.
 *
 * Request body:
 * - password: The setup password (must match SETUP_PASSWORD env var)
 *
 * Response:
 * - success: true
 * - token: JWT token (valid for 1 year)
 * - expiresIn: Token expiration time in seconds
 *
 * Security:
 * - SETUP_PASSWORD should be a strong password
 * - After setup, consider rotating SETUP_PASSWORD
 * - The generated JWT is long-lived (1 year) for self-hosted convenience
 */
authRoutes.post("/setup", zValidator("json", setupRequestSchema), async (c) => {
  const { password } = c.req.valid("json")
  const env = c.env

  // Verify the setup password
  if (password !== env.SETUP_PASSWORD) {
    return c.json(
      {
        success: false,
        error: "Invalid setup password",
        errorCode: "SETUP_INVALID_PASSWORD",
      },
      401,
    )
  }

  // Create JWT payload
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = 365 * 24 * 60 * 60 // 1 year in seconds

  const payload = {
    sub: "owner", // User ID
    role: "owner", // Full access role
    iat: now,
    exp: now + expiresIn,
  }

  // Sign the JWT with HS256 algorithm
  const token = await sign(payload, env.JWT_SECRET, "HS256")

  return c.json({
    success: true,
    token,
    expiresIn,
    tokenType: "Bearer",
    user: {
      id: "owner",
      role: "owner",
    },
  })
})

/**
 * POST /auth/verify
 *
 * Verify a JWT token and return its payload.
 *
 * This endpoint can be used to check if a token is still valid.
 *
 * Request header:
 * - Authorization: Bearer <token>
 *
 * Response:
 * - success: true
 * - payload: Decoded JWT payload
 */
authRoutes.post("/verify", async (c) => {
  const authHeader = c.req.header("Authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json(
      {
        success: false,
        error: "Missing or invalid Authorization header",
        errorCode: "AUTH_MISSING",
      },
      401,
    )
  }

  try {
    const token = authHeader.slice(7)
    const payload = await verify(token, c.env.JWT_SECRET, "HS256")

    return c.json({
      success: true,
      payload: {
        sub: payload.sub,
        role: payload.role,
        iat: payload.iat,
        exp: payload.exp,
      },
    })
  } catch {
    return c.json(
      {
        success: false,
        error: "Invalid or expired token",
        errorCode: "AUTH_INVALID",
      },
      401,
    )
  }
})

/**
 * GET /auth/status
 *
 * Get authentication status and configuration info.
 */
authRoutes.get("/status", (c) => {
  return c.json({
    success: true,
    configured: !!c.env.JWT_SECRET && !!c.env.SETUP_PASSWORD,
    authType: "jwt",
    setupRequired: !c.env.SETUP_PASSWORD,
  })
})
