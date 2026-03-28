/**
 * Storage layer for BillClaw
 *
 * Provides both low-level file operations and the StorageAdapter abstraction
 * for framework-independent storage across Node.js and Cloudflare Workers.
 *
 * @packageDocumentation
 */

// StorageAdapter abstraction (for framework independence)
export * from "./types.js"

// File-based storage adapter (Node.js default)
export * from "./file-adapter.js"

// Legacy file-based storage (backward compatible)
export * from "./transaction-storage.js"
export * from "./cache.js"
