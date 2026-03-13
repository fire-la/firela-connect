/**
 * Tests for Upload Service
 *
 * Orchestrates the upload flow from BillClaw transactions to IGN.
 * Handles loading, transformation, upload, and status tracking.
 *
 * On upload failure, local data is always preserved
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { UploadService } from "./upload-service.js"
import type { IgnConfig, StorageConfig } from "../models/config.js"
import type { Logger } from "../errors/errors.js"
import {
  createCredentialStore,
  CredentialStrategy,
  type CredentialStore,
} from "../credentials/store.js"

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock logger
const mockLogger: Logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}

// Mock config
const ignConfig: IgnConfig = {
  apiUrl: "http://localhost:3000/api/v1",
  accessToken: "test-access-token",
  region: "us",
  upload: {
    mode: "auto",
    sourceAccount: "Assets:Bank",
    defaultCurrency: "USD",
    defaultExpenseAccount: "Expenses:Unknown",
    defaultIncomeAccount: "Income:Unknown",
    filterPending: true,
  },
}

const storageConfig: StorageConfig | undefined = undefined

describe("UploadService", () => {
  let mockCredentialStore: CredentialStore

  beforeEach(async () => {
    mockCredentialStore = await createCredentialStore({
      strategy: CredentialStrategy.MEMORY,
      logger: mockLogger,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("shouldUpload", () => {
    let service: UploadService

    beforeEach(() => {
      service = new UploadService(
        ignConfig,
        storageConfig,
        mockCredentialStore,
        mockLogger,
      )
    })

    it("should return true when configured with auto mode", async () => {
      const result = await service.shouldUpload()
      expect(result).toBe(true)
    })

    it("should return false when accessToken is missing", async () => {
      const configWithoutToken = {
        ...ignConfig,
        accessToken: undefined,
      } as IgnConfig
      const serviceWithoutToken = new UploadService(
        configWithoutToken,
        storageConfig,
        mockCredentialStore,
        mockLogger,
      )

      const result = await serviceWithoutToken.shouldUpload()
      expect(result).toBe(false)
    })

    it("should return false when upload config is missing", async () => {
      const configWithoutUpload = { ...ignConfig }
      configWithoutUpload.upload = undefined
      const serviceWithoutUpload = new UploadService(
        configWithoutUpload,
        storageConfig,
        mockCredentialStore,
        mockLogger,
      )

      const result = await serviceWithoutUpload.shouldUpload()
      expect(result).toBe(false)
    })

    it("should return false when mode is disabled", async () => {
      const configDisabled = { ...ignConfig }
      configDisabled.upload!.mode = "disabled"
      const serviceDisabled = new UploadService(
        configDisabled,
        storageConfig,
        mockCredentialStore,
        mockLogger,
      )

      const result = await serviceDisabled.shouldUpload()
      expect(result).toBe(false)
    })
  })

  describe("uploadAccountTransactions", () => {
    let _service: UploadService

    beforeEach(() => {
      _service = new UploadService(
        ignConfig,
        storageConfig,
        mockCredentialStore,
        mockLogger,
      )
    })

    it("should throw when accessToken is missing", async () => {
      const configWithoutToken = {
        ...ignConfig,
        accessToken: undefined,
      } as IgnConfig
      const serviceWithoutToken = new UploadService(
        configWithoutToken,
        storageConfig,
        mockCredentialStore,
        mockLogger,
      )

      const error = await serviceWithoutToken
        .uploadAccountTransactions("acc-1")
        .catch((e) => e)

      expect(error.type).toBe("UserError")
      expect(error.humanReadable.title).toBe("Firela Vault Not Configured")
      expect(error.humanReadable.message).toContain("access token is not configured")
    })

    it("should throw when upload config is missing", async () => {
      const configWithoutUpload = { ...ignConfig }
      configWithoutUpload.upload = undefined
      const serviceWithoutUpload = new UploadService(
        configWithoutUpload,
        storageConfig,
        mockCredentialStore,
        mockLogger,
      )

      const error = await serviceWithoutUpload
        .uploadAccountTransactions("acc-1")
        .catch((e) => e)

      expect(error.type).toBe("UserError")
      expect(error.humanReadable.title).toBe("Firela Vault Upload Not Configured")
      expect(error.humanReadable.message).toContain("upload configuration is missing")
    })
  })

  describe("getUploadStatus", () => {
    let service: UploadService

    beforeEach(() => {
      service = new UploadService(
        ignConfig,
        storageConfig,
        mockCredentialStore,
        mockLogger,
      )
    })

    it("should return null when no status file exists", async () => {
      const status = await service.getUploadStatus("nonexistent")
      expect(status).toBeNull()
    })
  })
})
