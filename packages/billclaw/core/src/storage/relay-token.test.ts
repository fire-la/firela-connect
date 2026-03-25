/**
 * Tests for relay token storage in storage adapters
 *
 * Ensures relay tokens are stored locally and securely.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdir, rm, writeFile, readFile, mkdirSync } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import os from "node:os"
import { D1StorageAdapter } from "./d1-adapter.js"
import { FileStorageAdapter } from "./file-adapter.js"
import type { RelayTokenStorage } from "./types.js"

// Helper to create a mock D1 database
function createMockD1Database() {
  const tables: Map<string, Map<string, Record<string, unknown>>> = new Map()
  tables.set("relay_tokens", new Map())

  return {
    prepare: (query: string) => {
      const lowerQuery = query.toLowerCase()

      return {
        bind: function (...values: unknown[]) {
          this.values = values
          return this
        },
        run: async function () {
          if (lowerQuery.includes("insert or replace into relay_tokens")) {
            const [provider, accountId, token] = this.values as [string, string, string]
            const key = `${provider}:${accountId}`
            tables.get("relay_tokens")!.set(key, {
              provider,
              account_id: accountId,
              token,
              updated_at: new Date().toISOString(),
            })
            return { success: true }
          }
          if (lowerQuery.includes("delete from relay_tokens")) {
            const [provider, accountId] = this.values as [string, string]
            const key = `${provider}:${accountId}`
            tables.get("relay_tokens")!.delete(key)
            return { success: true }
          }
          return { success: true }
        },
        first: async function <T = unknown>(): Promise<T | null> {
          if (lowerQuery.includes("select token from relay_tokens")) {
            const [provider, accountId] = this.values as [string, string]
            const key = `${provider}:${accountId}`
            const row = tables.get("relay_tokens")!.get(key)
            return row ? { token: row.token } as T : null
          }
          return null
        },
        values: [] as unknown[],
      }
    },
    exec: async () => ({ success: true }),
    batch: async () => [],
  }
}

describe("RelayTokenStorage", () => {
  describe("D1StorageAdapter", () => {
    let adapter: D1StorageAdapter & RelayTokenStorage
    let mockDb: ReturnType<typeof createMockD1Database>

    beforeEach(() => {
      mockDb = createMockD1Database()
      adapter = new D1StorageAdapter({ db: mockDb as unknown as Parameters<typeof D1StorageAdapter>[0]["db"] }) as D1StorageAdapter & RelayTokenStorage
    })

    describe("storeRelayToken", () => {
      it("stores token for plaid provider", async () => {
        await adapter.storeRelayToken("plaid", "account-123", "plaid-token-secret")

        const token = await adapter.getRelayToken("plaid", "account-123")
        expect(token).toBe("plaid-token-secret")
      })

      it("stores token for gocardless provider", async () => {
        await adapter.storeRelayToken("gocardless", "account-456", "gocardless-token-secret")

        const token = await adapter.getRelayToken("gocardless", "account-456")
        expect(token).toBe("gocardless-token-secret")
      })

      it("updates existing token", async () => {
        await adapter.storeRelayToken("plaid", "account-123", "old-token")
        await adapter.storeRelayToken("plaid", "account-123", "new-token")

        const token = await adapter.getRelayToken("plaid", "account-123")
        expect(token).toBe("new-token")
      })
    })

    describe("getRelayToken", () => {
      it("returns null for missing token", async () => {
        const token = await adapter.getRelayToken("plaid", "nonexistent")
        expect(token).toBeNull()
      })

      it("returns stored token", async () => {
        await adapter.storeRelayToken("plaid", "account-123", "my-token")
        const token = await adapter.getRelayToken("plaid", "account-123")
        expect(token).toBe("my-token")
      })
    })

    describe("deleteRelayToken", () => {
      it("deletes stored token", async () => {
        await adapter.storeRelayToken("plaid", "account-123", "token-to-delete")
        await adapter.deleteRelayToken("plaid", "account-123")

        const token = await adapter.getRelayToken("plaid", "account-123")
        expect(token).toBeNull()
      })

      it("does not throw when deleting nonexistent token", async () => {
        await expect(
          adapter.deleteRelayToken("plaid", "nonexistent"),
        ).resolves.not.toThrow()
      })
    })
  })

  describe("FileStorageAdapter", () => {
    let adapter: FileStorageAdapter & RelayTokenStorage
    let tempDir: string

    beforeEach(async () => {
      // Create a temporary directory for testing
      tempDir = path.join(os.tmpdir(), `relay-token-test-${Date.now()}`)
      await mkdir(tempDir, { recursive: true })

      adapter = new FileStorageAdapter({
        config: { path: tempDir, format: "json" },
      }) as FileStorageAdapter & RelayTokenStorage
    })

    afterEach(async () => {
      // Clean up temp directory
      await rm(tempDir, { recursive: true, force: true })
    })

    describe("storeRelayToken", () => {
      it("stores token for plaid provider", async () => {
        await adapter.storeRelayToken("plaid", "account-123", "plaid-token-secret")

        const token = await adapter.getRelayToken("plaid", "account-123")
        expect(token).toBe("plaid-token-secret")
      })

      it("stores token for gocardless provider", async () => {
        await adapter.storeRelayToken("gocardless", "account-456", "gocardless-token-secret")

        const token = await adapter.getRelayToken("gocardless", "account-456")
        expect(token).toBe("gocardless-token-secret")
      })

      it("creates tokens directory if not exists", async () => {
        const tokensDir = path.join(tempDir, "tokens")
        expect(existsSync(tokensDir)).toBe(false)

        await adapter.storeRelayToken("plaid", "account-123", "my-token")

        expect(existsSync(tokensDir)).toBe(true)
      })

      it("updates existing token", async () => {
        await adapter.storeRelayToken("plaid", "account-123", "old-token")
        await adapter.storeRelayToken("plaid", "account-123", "new-token")

        const token = await adapter.getRelayToken("plaid", "account-123")
        expect(token).toBe("new-token")
      })
    })

    describe("getRelayToken", () => {
      it("returns null for missing token", async () => {
        const token = await adapter.getRelayToken("plaid", "nonexistent")
        expect(token).toBeNull()
      })

      it("returns stored token", async () => {
        await adapter.storeRelayToken("plaid", "account-123", "my-token")
        const token = await adapter.getRelayToken("plaid", "account-123")
        expect(token).toBe("my-token")
      })
    })

    describe("deleteRelayToken", () => {
      it("deletes stored token", async () => {
        await adapter.storeRelayToken("plaid", "account-123", "token-to-delete")
        await adapter.deleteRelayToken("plaid", "account-123")

        const token = await adapter.getRelayToken("plaid", "account-123")
        expect(token).toBeNull()
      })

      it("does not throw when deleting nonexistent token", async () => {
        await expect(
          adapter.deleteRelayToken("plaid", "nonexistent"),
        ).resolves.not.toThrow()
      })
    })
  })
})
