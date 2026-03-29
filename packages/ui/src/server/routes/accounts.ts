/**
 * Accounts API Routes
 *
 * REST endpoints for account management.
 * Provides endpoints to update account settings like enabled status.
 *
 * @packageDocumentation
 */

import { Hono } from "hono"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import type { Env } from "../index.js"

export const accountsRoutes = new Hono<{ Bindings: Env }>()

// KV key for accounts storage (same as sync.ts)
const ACCOUNTS_KEY = "billclaw:accounts"

// Account type definition
interface Account {
  id: string
  name: string
  provider: string
  status?: string // Connection status: 'connected' | 'disconnected' | 'error'
  enabled?: boolean
  lastSync?: string
  lastStatus?: string
}

// Validation schema for update request body
const updateAccountSchema = z.object({
  enabled: z.boolean(),
})

// Validation schema for path parameter
const accountIdSchema = z.object({
  id: z.string().min(1, "Account ID is required"),
})

/**
 * PUT /api/accounts/:id
 * Update account enabled status
 */
accountsRoutes.put(
  "/:id",
  zValidator("param", accountIdSchema),
  zValidator("json", updateAccountSchema),
  async (c) => {
    try {
      const { id: accountId } = c.req.valid("param")
      const { enabled } = c.req.valid("json")

      // Check if CONFIG KV namespace is available
      if (!c.env.CONFIG) {
        return c.json(
          {
            success: false,
            error: "KV storage not configured",
            errorCode: "KV_NOT_CONFIGURED",
          },
          500,
        )
      }

      // Get existing accounts from KV
      const storedAccounts = await c.env.CONFIG.get(ACCOUNTS_KEY, "json")

      if (!storedAccounts || !Array.isArray(storedAccounts)) {
        return c.json(
          {
            success: false,
            error: "No accounts found",
            errorCode: "ACCOUNTS_NOT_FOUND",
          },
          404,
        )
      }

      const accounts = storedAccounts as Account[]

      // Find the account to update
      const accountIndex = accounts.findIndex((acc) => acc.id === accountId)

      if (accountIndex === -1) {
        return c.json(
          {
            success: false,
            error: `Account with ID ${accountId} not found`,
            errorCode: "ACCOUNT_NOT_FOUND",
          },
          404,
        )
      }

      // Update the account's enabled status
      accounts[accountIndex] = {
        ...accounts[accountIndex],
        enabled,
      }

      // Save updated accounts back to KV
      await c.env.CONFIG.put(ACCOUNTS_KEY, JSON.stringify(accounts))

      return c.json({
        success: true,
        data: accounts[accountIndex],
        message: `Account ${accountId} ${enabled ? "enabled" : "disabled"} successfully`,
      })
    } catch (error) {
      console.error("Error updating account:", error)
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Failed to update account",
          errorCode: "INTERNAL_ERROR",
        },
        500,
      )
    }
  },
)

/**
 * GET /api/accounts
 * List all accounts
 */
accountsRoutes.get("/", async (c) => {
  try {
    // Check if CONFIG KV namespace is available
    if (!c.env.CONFIG) {
      return c.json({
        success: true,
        data: [],
        message: "KV storage not configured",
      })
    }

    // Get accounts from KV storage
    const accounts = await c.env.CONFIG.get(ACCOUNTS_KEY, "json")

    if (!accounts || !Array.isArray(accounts)) {
      return c.json({
        success: true,
        data: [],
      })
    }

    return c.json({
      success: true,
      data: accounts,
    })
  } catch (error) {
    console.error("Error listing accounts:", error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list accounts",
        errorCode: "INTERNAL_ERROR",
      },
      500,
    )
  }
})

/**
 * DELETE /api/accounts/:id
 * Remove an account from configuration
 */
accountsRoutes.delete(
  "/:id",
  zValidator("param", accountIdSchema),
  async (c) => {
    try {
      const { id: accountId } = c.req.valid("param")

      // Check if CONFIG KV namespace is available
      if (!c.env.CONFIG) {
        return c.json(
          {
            success: false,
            error: "KV storage not configured",
            errorCode: "KV_NOT_CONFIGURED",
          },
          500,
        )
      }

      const storedAccounts = await c.env.CONFIG.get(ACCOUNTS_KEY, "json")
      const accountList: Account[] = Array.isArray(storedAccounts)
        ? storedAccounts
        : []

      const accountIndex = accountList.findIndex((acc) => acc.id === accountId)

      if (accountIndex === -1) {
        return c.json(
          {
            success: false,
            error: "Account not found",
            errorCode: "ACCOUNT_NOT_FOUND",
          },
          404,
        )
      }

      accountList.splice(accountIndex, 1)
      await c.env.CONFIG.put(ACCOUNTS_KEY, JSON.stringify(accountList))

      return c.body(null, 204)
    } catch (error) {
      console.error("Error deleting account:", error)
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Failed to delete account",
          errorCode: "INTERNAL_ERROR",
        },
        500,
      )
    }
  },
)
