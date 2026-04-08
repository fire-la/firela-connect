import { describe, it, expect } from "vitest"
import { CliRuntimeContext } from "./context.js"
import { FileStorageAdapter } from "@firela/billclaw-core"

describe("CliRuntimeContext", () => {
  describe("storage assignment", () => {
    it("should assign FileStorageAdapter to storage property", () => {
      const context = new CliRuntimeContext()
      expect(context.storage).toBeDefined()
      expect(context.storage).toBeInstanceOf(FileStorageAdapter)
    })

    it("should assign storage with empty options", () => {
      const context = new CliRuntimeContext({})
      expect(context.storage).toBeDefined()
      expect(context.storage).toBeInstanceOf(FileStorageAdapter)
    })

    it("should assign storage with custom config options", () => {
      const context = new CliRuntimeContext({
        configDir: "/tmp/test-billclaw-context",
      })
      expect(context.storage).toBeDefined()
      expect(context.storage).toBeInstanceOf(FileStorageAdapter)
    })

    it("should assign a unique FileStorageAdapter per instance", () => {
      const context1 = new CliRuntimeContext()
      const context2 = new CliRuntimeContext()
      expect(context1.storage).not.toBe(context2.storage)
    })
  })
})
