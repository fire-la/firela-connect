/**
 * Tests for relay token storage in storage adapters
 *
 * Ensures relay tokens are stored locally and securely.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdir, rm, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import os from "node:os"
import { D1StorageAdapter } from "./d1-adapter.js"
import { FileStorageAdapter } from "./file-adapter.js"
import type { RelayTokenStorage, GoCardlessTokenStorage } from "./types.js"

// Helper to create a mock D1 database
function createMockD1Database(options?: { shouldError?: boolean }) {
  const tables: Map<string, Map<string, Record<string, unknown>>> = new Map()
  tables.set("relay_tokens", new Map())
  tables.set("gocardless_tokens", new Map())

  return {
    prepare: (query: string) => {
      const lowerQuery = query.toLowerCase()

      // Error simulation path: when shouldError is true, run() and first() throw
      if (options?.shouldError) {
        return {
          bind: function (...values: unknown[]) {
            this.values = values
            return this
          },
          run: async () => {
            throw new Error("D1 database error")
          },
          first: async () => {
            throw new Error("D1 database error")
          },
          values: [] as unknown[],
        }
      }

      return {
        bind: function (...values: unknown[]) {
          this.values = values
          return this
        },
        run: async function () {
          // gocardless_tokens table operations
          if (lowerQuery.includes("insert or replace into gocardless_tokens")) {
            const [accountId, accessToken, refreshToken, expiresAt] = this.values as [string, string, string, string]
            tables.get("gocardless_tokens")!.set(accountId, {
              account_id: accountId,
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            })
            return { success: true }
          }
          if (lowerQuery.includes("delete from gocardless_tokens")) {
            const [accountId] = this.values as [string]
            tables.get("gocardless_tokens")!.delete(accountId)
            return { success: true }
          }
          // relay_tokens table operations
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
          // gocardless_tokens table queries
          if (lowerQuery.includes("from gocardless_tokens where account_id = ?")) {
            const [accountId] = this.values as [string]
            const row = tables.get("gocardless_tokens")!.get(accountId)
            return row
              ? {
                access_token: row.access_token,
                refresh_token: row.refresh_token,
                expires_at: row.expires_at,
              } as T
              : null
          }

          // relay_tokens table queries
          if (lowerQuery.includes("from relay_tokens where provider = ? and account_id = ?")) {
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

describe("GoCardlessTokenStorage", () => {
  describe("FileStorageAdapter", () => {
    let adapter: FileStorageAdapter & GoCardlessTokenStorage
    let tempDir: string

    beforeEach(async () => {
      // Create a temporary directory for testing
      tempDir = path.join(os.tmpdir(), `gocardless-token-test-${Date.now()}`)
      await mkdir(tempDir, { recursive: true })

      adapter = new FileStorageAdapter({
        config: { path: tempDir, format: "json" },
      }) as FileStorageAdapter & GoCardlessTokenStorage
    })

    afterEach(async () => {
      // Clean up temp directory
      await rm(tempDir, { recursive: true, force: true })
    })

    describe("storeGoCardlessToken", () => {
      it("stores access_token, refresh_token, and expires_at in JSON file", async () => {
        const tokenData = {
          access_token: "access-token-123",
          refresh_token: "refresh-token-456",
          expires_at: "2024-01-01T12:00:00Z",
        }

        await adapter.storeGoCardlessToken("account-123", tokenData)

        const retrieved = await adapter.getGoCardlessToken("account-123")
        expect(retrieved).not.toBeNull()
        expect(retrieved!.access_token).toBe("access-token-123")
        expect(retrieved!.refresh_token).toBe("refresh-token-456")
        expect(retrieved!.expires_at).toBe("2024-01-01T12:00:00Z")
      })

      it("creates tokens directory if not exists", async () => {
        const tokensDir = path.join(tempDir, "tokens")
        expect(existsSync(tokensDir)).toBe(false)

        await adapter.storeGoCardlessToken("account-123", {
          access_token: "test-access",
          refresh_token: "test-refresh",
          expires_at: "2024-01-01T12:00:00Z",
        })

        expect(existsSync(tokensDir)).toBe(true)
      })

      it("updated token overwrites existing token data", async () => {
        const oldTokenData = {
          access_token: "old-access-token",
          refresh_token: "old-refresh-token",
          expires_at: "2024-01-01T12:00:00Z",
        }
        const newTokenData = {
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_at: "2024-01-02T12:00:00Z",
        }

        await adapter.storeGoCardlessToken("account-123", oldTokenData)
        await adapter.storeGoCardlessToken("account-123", newTokenData)

        const retrieved = await adapter.getGoCardlessToken("account-123")
        expect(retrieved!.access_token).toBe("new-access-token")
        expect(retrieved!.refresh_token).toBe("new-refresh-token")
        expect(retrieved!.expires_at).toBe("2024-01-02T12:00:00Z")
      })

      it("token file has 0o600 permissions (owner read/write only)", async () => {
        const tokenData = {
          access_token: "secure-token",
          refresh_token: "secure-refresh",
          expires_at: "2024-01-01T12:00:00Z",
        }

        await adapter.storeGoCardlessToken("account-123", tokenData)

        const tokenFile = path.join(tempDir, "tokens", "gocardless-account-123.json")
        const stats = await stat(tokenFile)

        // Check file permissions (mode & 0o777 gives the permission bits)
        const mode = stats.mode & 0o777
        expect(mode).toBe(0o600)
      })
    })

    describe("getGoCardlessToken", () => {
      it("returns null when file does not exist (ENOENT handling)", async () => {
        const retrieved = await adapter.getGoCardlessToken("nonexistent")
        expect(retrieved).toBeNull()
      })

      it("returns parsed GoCardlessTokenData when file exists", async () => {
        const tokenData = {
          access_token: "my-access-token",
          refresh_token: "my-refresh-token",
          expires_at: "2024-06-15T08:30:00Z",
        }

        await adapter.storeGoCardlessToken("account-456", tokenData)
        const retrieved = await adapter.getGoCardlessToken("account-456")

        expect(retrieved).toEqual({
          access_token: "my-access-token",
          refresh_token: "my-refresh-token",
          expires_at: "2024-06-15T08:30:00Z",
        })
      })
    })

    describe("deleteGoCardlessToken", () => {
      it("removes token file", async () => {
        const tokenData = {
          access_token: "token-to-delete",
          refresh_token: "refresh-to-delete",
          expires_at: "2024-01-01T12:00:00Z",
        }

        await adapter.storeGoCardlessToken("account-789", tokenData)
        await adapter.deleteGoCardlessToken("account-789")

        const retrieved = await adapter.getGoCardlessToken("account-789")
        expect(retrieved).toBeNull()
      })

      it("handles missing file gracefully", async () => {
        // Should not throw when deleting nonexistent token
        await expect(
          adapter.deleteGoCardlessToken("nonexistent"),
        ).resolves.not.toThrow()
      })
    })
  })

  describe("D1StorageAdapter", () => {
    let adapter: D1StorageAdapter & GoCardlessTokenStorage
    let mockDb: ReturnType<typeof createMockD1Database>

    beforeEach(() => {
      mockDb = createMockD1Database()
      adapter = new D1StorageAdapter({ db: mockDb as D1StorageAdapterOptions }) as D1StorageAdapter & GoCardlessTokenStorage
    })

    describe("storeGoCardlessToken", () => {
      it("stores token data with all fields", async () => {
        const tokenData = {
          access_token: "access-123",
          refresh_token: "refresh-456",
          expires_at: "2024-01-15T10:30:00Z",
        }
        await adapter.storeGoCardlessToken("account-1", tokenData)

        const retrieved = await adapter.getGoCardlessToken("account-1")
        expect(retrieved).toEqual({
          access_token: "access-123",
          refresh_token: "refresh-456",
          expires_at: "2024-01-15T10:30:00Z",
        })
      })

      it("updates existing token data (upsert)", async () => {
        await adapter.storeGoCardlessToken("account-1", {
          access_token: "old-access",
          refresh_token: "old-refresh",
          expires_at: "2024-01-15T10:00:00Z",
        })
        await adapter.storeGoCardlessToken("account-1", {
          access_token: "new-access",
          refresh_token: "new-refresh",
          expires_at: "2024-01-16T10:00:00Z",
        })

        const token = await adapter.getGoCardlessToken("account-1")
        expect(token?.access_token).toBe("new-access")
        expect(token?.refresh_token).toBe("new-refresh")
      })
    })

    describe("getGoCardlessToken", () => {
      it("returns null for missing account", async () => {
        const token = await adapter.getGoCardlessToken("nonexistent")
        expect(token).toBeNull()
      })

      it("returns GoCardlessTokenData when row exists", async () => {
        await adapter.storeGoCardlessToken("account-2", {
          access_token: "my-access",
          refresh_token: "my-refresh",
          expires_at: "2024-06-15T08:30:00Z",
        })
        const token = await adapter.getGoCardlessToken("account-2")
        expect(token).toEqual({
          access_token: "my-access",
          refresh_token: "my-refresh",
          expires_at: "2024-06-15T08:30:00Z",
        })
      })
    })

    describe("deleteGoCardlessToken", () => {
      it("deletes stored token", async () => {
        await adapter.storeGoCardlessToken("account-3", {
          access_token: "to-delete",
          refresh_token: "refresh-to-delete",
          expires_at: "2024-01-01T12:00:00Z",
        })
        await adapter.deleteGoCardlessToken("account-3")

        const token = await adapter.getGoCardlessToken("account-3")
        expect(token).toBeNull()
      })

      it("does not throw when deleting nonexistent token", async () => {
        await expect(
          adapter.deleteGoCardlessToken("nonexistent"),
        ).resolves.not.toThrow()
      })
    })

    describe("error handling", () => {
      let errorAdapter: D1StorageAdapter & GoCardlessTokenStorage

      beforeEach(() => {
        const errorDb = createMockD1Database({ shouldError: true })
        errorAdapter = new D1StorageAdapter({ db: errorDb as unknown as Parameters<typeof D1StorageAdapter>[0]["db"] }) as D1StorageAdapter & GoCardlessTokenStorage
      })

      it("propagates database error during storeGoCardlessToken", async () => {
        await expect(
          errorAdapter.storeGoCardlessToken("account-1", {
            access_token: "test-access",
            refresh_token: "test-refresh",
            expires_at: "2024-01-01T00:00:00Z",
          }),
        ).rejects.toThrow("D1 database error")
      })

      it("propagates database error during getGoCardlessToken", async () => {
        await expect(
          errorAdapter.getGoCardlessToken("account-1"),
        ).rejects.toThrow("D1 database error")
      })

      it("propagates database error during deleteGoCardlessToken", async () => {
        await expect(
          errorAdapter.deleteGoCardlessToken("account-1"),
        ).rejects.toThrow("D1 database error")
      })
    })
  })
})
