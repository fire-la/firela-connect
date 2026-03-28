/**
 * Integration tests for Plaid relay sync flow
 *
 * Tests the Billclaw.syncPlaid() method using createPlaidAdapter factory
 * for automatic mode selection (direct/relay).
 *
 * Tests are skipped if FIRELA_RELAY_API_KEY is not set.
 *
 * Run with: pnpm --filter @firela/billclaw-core test -- --run plaid-relay-sync
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest"
import { Billclaw } from "../billclaw.js"
import type { RuntimeContext } from "../runtime/types.js"
import type { Logger } from "../errors/errors.js"

// Test configuration from environment
const RELAY_API_KEY = process.env.FIRELA_RELAY_API_KEY || ""

// Skip all tests if API key not available
const shouldRunTests = RELAY_API_KEY.length > 0

// Mock logger for tests
const testLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}

// Mock RuntimeContext
const createMockContext = (config: any): RuntimeContext => ({
  config: {
    getConfig: vi.fn().mockResolvedValue(config),
    getStorageConfig: vi.fn().mockResolvedValue({ path: "/tmp/test-billclaw" }),
  },
  logger: testLogger,
  events: {
    emit: vi.fn(),
  },
} as any)

// Mock storage functions
vi.mock("../storage/transaction-storage.js", () => ({
  readSyncStates: vi.fn().mockResolvedValue([]),
  writeSyncState: vi.fn().mockResolvedValue(undefined),
  writeGlobalCursor: vi.fn().mockResolvedValue(undefined),
  appendTransactions: vi.fn().mockResolvedValue({ added: 1, updated: 0 }),
  deduplicateTransactions: vi.fn().mockImplementation((txns) => txns),
}))

// Mock event emitter
vi.mock("../services/event-emitter.js", () => ({
  emitEvent: vi.fn().mockResolvedValue(undefined),
}))

// Mock mode-selector
vi.mock("../connection/mode-selector.js", () => ({
  selectConnectionMode: vi.fn(),
}))

describe("Plaid Relay Sync Flow (Integration)", () => {
  let billclaw: Billclaw

  beforeAll(() => {
    if (!shouldRunTests) {
      console.log("Skipping Plaid relay sync integration tests: FIRELA_RELAY_API_KEY not set")
      return
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  describe("syncPlaid uses relay mode when relay configured", () => {
    it(
      "should use createPlaidAdapter factory for mode selection",
      async () => {
        if (!shouldRunTests) return

        const { selectConnectionMode } = await import(
          "../connection/mode-selector.js"
        )
        vi.mocked(selectConnectionMode).mockResolvedValueOnce({
          mode: "relay",
          reason: "Relay mode available",
          purpose: "oauth",
        })

        const context = createMockContext({
          accounts: [
            {
              id: "test-account-1",
              type: "plaid",
              enabled: true,
              plaidAccessToken: "access-sandbox-test-token",
            },
          ],
          relay: {
            url: "https://napi-dev.firela.io",
            apiKey: RELAY_API_KEY,
          },
          plaid: {},
          webhooks: [],
        })

        billclaw = new Billclaw(context)

        // Note: This will fail at the actual sync call since we don't have a real access token
        // But we can verify the mode selection happened
        try {
          await billclaw.syncPlaid(["test-account-1"])
        } catch {
          // Expected - the sync will fail with invalid token
          // But mode selection should have happened
        }

        // Verify logger shows relay mode was selected
        const infoCalls = vi.mocked(testLogger.info).mock.calls
        const modeCall = infoCalls.find((call) =>
          call[0]?.includes?.("relay mode"),
        )

        expect(modeCall).toBeDefined()
      },
      30000,
    )

    it(
      "should log the mode being used",
      async () => {
        if (!shouldRunTests) return

        const { selectConnectionMode } = await import(
          "../connection/mode-selector.js"
        )
        vi.mocked(selectConnectionMode).mockResolvedValueOnce({
          mode: "relay",
          reason: "Relay mode available",
          purpose: "oauth",
        })

        const context = createMockContext({
          accounts: [
            {
              id: "test-account-2",
              type: "plaid",
              enabled: true,
              plaidAccessToken: "access-sandbox-test-token",
            },
          ],
          relay: {
            url: "https://napi-dev.firela.io",
            apiKey: RELAY_API_KEY,
          },
          plaid: {},
          webhooks: [],
        })

        billclaw = new Billclaw(context)

        try {
          await billclaw.syncPlaid(["test-account-2"])
        } catch {
          // Expected
        }

        // Verify mode was logged
        const infoCalls = vi.mocked(testLogger.info).mock.calls
        const syncModeCall = infoCalls.find((call) =>
          call[0]?.includes?.("Syncing Plaid accounts using"),
        )

        expect(syncModeCall).toBeDefined()
        expect(syncModeCall?.[0]).toContain("relay")
      },
      30000,
    )
  })

  describe("syncPlaid falls back to direct mode when relay unavailable", () => {
    it(
      "should warn and fallback when relay fails but direct creds exist",
      async () => {
        if (!shouldRunTests) return

        const { selectConnectionMode } = await import(
          "../connection/mode-selector.js"
        )
        // First call throws relay error
        vi.mocked(selectConnectionMode).mockRejectedValueOnce(
          new Error("Relay mode selected but relay configuration is missing"),
        )

        const context = createMockContext({
          accounts: [
            {
              id: "test-account-3",
              type: "plaid",
              enabled: true,
              plaidAccessToken: "access-sandbox-test-token",
            },
          ],
          relay: {
            url: "https://napi-dev.firela.io",
            apiKey: "invalid-key", // This will cause relay to fail
          },
          plaid: {
            clientId: "test-client-id",
            secret: "test-secret",
            environment: "sandbox",
          },
          webhooks: [],
        })

        billclaw = new Billclaw(context)

        try {
          await billclaw.syncPlaid(["test-account-3"])
        } catch {
          // Expected - sync will fail, but we're testing the fallback logic
        }

        // Verify fallback warning was logged
        const warnCalls = vi.mocked(testLogger.warn).mock.calls
        const fallbackCall = warnCalls.find((call) =>
          call[0]?.includes?.("falling back to direct mode"),
        )

        expect(fallbackCall).toBeDefined()
      },
      30000,
    )
  })

  describe("syncPlaid throws error when no mode available", () => {
    it(
      "should throw actionable error when neither relay nor direct configured",
      async () => {
        if (!shouldRunTests) return

        const { selectConnectionMode } = await import(
          "../connection/mode-selector.js"
        )
        vi.mocked(selectConnectionMode).mockRejectedValueOnce(
          new Error(
            "Direct mode selected but Plaid credentials are missing. Configure plaid.clientId and plaid.secret, or use relay mode.",
          ),
        )

        const context = createMockContext({
          accounts: [
            {
              id: "test-account-4",
              type: "plaid",
              enabled: true,
              plaidAccessToken: "access-sandbox-test-token",
            },
          ],
          // No relay config
          // No Plaid credentials
          plaid: {},
          webhooks: [],
        })

        billclaw = new Billclaw(context)

        await expect(billclaw.syncPlaid(["test-account-4"])).rejects.toThrow()
      },
      30000,
    )

    it(
      "should return empty array when no accounts configured",
      async () => {
        if (!shouldRunTests) return

        const context = createMockContext({
          accounts: [], // No accounts
          plaid: {},
          webhooks: [],
        })

        billclaw = new Billclaw(context)

        const result = await billclaw.syncPlaid()

        expect(result).toEqual([])
        expect(testLogger.warn).toHaveBeenCalledWith("No enabled Plaid accounts found")
      },
      30000,
    )
  })
})

// Conditional describe for when API key is not available
describe("Plaid Relay Sync Flow (No API Key)", () => {
  it("should skip tests gracefully when FIRELA_RELAY_API_KEY not set", () => {
    if (RELAY_API_KEY) {
      // If API key is set, this test is not applicable
      return
    }

    // This documents the expected behavior
    expect(shouldRunTests).toBe(false)
    console.log("Integration tests require FIRELA_RELAY_API_KEY environment variable")
  })
})
