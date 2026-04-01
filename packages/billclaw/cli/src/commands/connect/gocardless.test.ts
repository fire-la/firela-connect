/**
 * Tests for GoCardless connect command - polling behavior
 *
 * Tests real requisition status polling replacing placeholder sleep loop.
 * Covers: DN (success), RJ (rejected), EX (expired), non-terminal statuses,
 * timeout, poll error resilience, interval verification, and requisitionId usage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockCliContext } from "../../__tests__/test-utils.js"

// Mock Spinner - must return proper chainable methods
const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  succeed: vi.fn().mockReturnThis(),
  fail: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  stop: vi.fn().mockReturnThis(),
}

vi.mock("../../utils/progress.js", () => ({
  Spinner: vi.fn(() => mockSpinner),
}))

// Mock format utilities
vi.mock("../../utils/format.js", () => ({
  logError: vi.fn(),
}))

// Mock adapter factory - all mock refs must be hoisted
const { mockGetRequisition, mockCreateRequisition, mockAdapter } = vi.hoisted(() => {
  const getReq = vi.fn()
  const createReq = vi.fn()
  return {
    mockGetRequisition: getReq,
    mockCreateRequisition: createReq,
    mockAdapter: {
      getRequisition: getReq,
      createRequisition: createReq,
      getInstitutions: vi.fn(),
      getAccounts: vi.fn(),
      getTransactions: vi.fn(),
      ensureValidToken: vi.fn(),
    },
  }
})

vi.mock("@firela/billclaw-core", () => ({
  createGoCardlessAdapter: vi.fn().mockResolvedValue(mockAdapter),
}))

vi.mock("@firela/billclaw-core/relay", () => ({
  parseGoCardlessRelayError: vi.fn((err: unknown) => {
    if (err && typeof err === "object" && (err as Record<string, unknown>).type === "UserError") {
      return err
    }
    return {
      type: "UserError",
      errorCode: "GOCARDLESS_ERROR",
      humanReadable: {
        title: "GoCardless Error",
        message: String(err),
        suggestions: ["Please try again"],
      },
    }
  }),
}))

// Import after mocks are set up
import { runGoCardlessConnect } from "./gocardless.js"

// Capture process.exit calls
const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit")
})

describe("GoCardless connect polling", () => {
  let unhandledRejections: Error[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    unhandledRejections = []
    mockExit.mockImplementation(() => {
      throw new Error("process.exit")
    })

    // Suppress unhandled rejection warnings from process.exit throws
    process.on("unhandledRejection", (err: Error) => {
      if (err instanceof Error && err.message === "process.exit") {
        unhandledRejections.push(err)
      } else {
        throw err
      }
    })

    // Default: createRequisition succeeds
    mockCreateRequisition.mockResolvedValue({
      id: "req-123",
      link: "https://bank.example.com/oauth?ref=abc",
      status: "CR",
      accounts: [],
      reference: "billclaw-test",
      redirect: "https://relay.firela.io/callback/gocardless",
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    // Remove all unhandledRejection listeners added in beforeEach
    process.removeAllListeners("unhandledRejection")
  })

  describe("status DN (Linked) - success", () => {
    it("should complete with success showing linked account IDs", async () => {
      mockGetRequisition.mockResolvedValue({
        id: "req-123",
        status: "DN",
        accounts: ["acc-1", "acc-2"],
        redirect: "",
        reference: "billclaw-test",
        link: "",
      })

      const context = createMockCliContext()
      const promise = runGoCardlessConnect(context, {
        institution: "SANDBOX_Oj",
        timeout: 5,
      })

      // Advance past first poll interval (2s)
      await vi.advanceTimersByTimeAsync(2500)

      await promise

      expect(mockGetRequisition).toHaveBeenCalledWith("req-123", "")
      expect(mockSpinner.succeed).toHaveBeenCalled()
      // Should log account IDs
      expect(mockExit).not.toHaveBeenCalled()
    })
  })

  describe("status RJ (Rejected)", () => {
    it("should exit with rejection error and retry guidance", async () => {
      mockGetRequisition.mockResolvedValue({
        id: "req-123",
        status: "RJ",
        accounts: [],
        redirect: "",
        reference: "billclaw-test",
        link: "",
      })

      const context = createMockCliContext()
      const promise = runGoCardlessConnect(context, {
        institution: "SANDBOX_Oj",
        timeout: 5,
      })

      await vi.advanceTimersByTimeAsync(2500)

      await expect(promise).rejects.toThrow("process.exit")

      expect(mockSpinner.fail).toHaveBeenCalled()
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe("status EX (Expired)", () => {
    it("should exit with expired error and reconnect guidance", async () => {
      mockGetRequisition.mockResolvedValue({
        id: "req-123",
        status: "EX",
        accounts: [],
        redirect: "",
        reference: "billclaw-test",
        link: "",
      })

      const context = createMockCliContext()
      const promise = runGoCardlessConnect(context, {
        institution: "SANDBOX_Oj",
        timeout: 5,
      })

      await vi.advanceTimersByTimeAsync(2500)

      await expect(promise).rejects.toThrow("process.exit")

      expect(mockSpinner.fail).toHaveBeenCalled()
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe("non-terminal statuses (CR, GA, UA, SA)", () => {
    it("should continue polling through non-terminal statuses until DN", async () => {
      // First poll returns CR, second returns GA, third returns DN
      mockGetRequisition
        .mockResolvedValueOnce({
          id: "req-123",
          status: "CR",
          accounts: [],
          redirect: "",
          reference: "billclaw-test",
          link: "",
        })
        .mockResolvedValueOnce({
          id: "req-123",
          status: "GA",
          accounts: [],
          redirect: "",
          reference: "billclaw-test",
          link: "",
        })
        .mockResolvedValueOnce({
          id: "req-123",
          status: "DN",
          accounts: ["acc-final"],
          redirect: "",
          reference: "billclaw-test",
          link: "",
        })

      const context = createMockCliContext()
      const promise = runGoCardlessConnect(context, {
        institution: "SANDBOX_Oj",
        timeout: 5,
      })

      // Advance through 3 poll intervals
      await vi.advanceTimersByTimeAsync(2500) // 1st poll
      await vi.advanceTimersByTimeAsync(2000) // 2nd poll
      await vi.advanceTimersByTimeAsync(2000) // 3rd poll

      await promise

      expect(mockGetRequisition).toHaveBeenCalledTimes(3)
      expect(mockSpinner.update).toHaveBeenCalled()
      expect(mockSpinner.succeed).toHaveBeenCalled()
    })
  })

  describe("timeout (5 minutes)", () => {
    it("should fail with timeout message after timeout period", async () => {
      // Always return non-terminal status
      mockGetRequisition.mockResolvedValue({
        id: "req-123",
        status: "CR",
        accounts: [],
        redirect: "",
        reference: "billclaw-test",
        link: "",
      })

      const context = createMockCliContext()
      // Use very short timeout (0.05 minutes = 3 seconds) for fast test
      const promise = runGoCardlessConnect(context, {
        institution: "SANDBOX_Oj",
        timeout: 0.05,
      })

      // Advance timers incrementally to allow async resolution chain to complete
      // Each poll iteration: sleep(2000) -> getRequisition -> next iteration
      // Need to advance enough total time to exceed 3000ms timeout
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(1000)
      }

      await expect(promise).rejects.toThrow("process.exit")

      expect(mockSpinner.fail).toHaveBeenCalled()
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe("individual poll error resilience", () => {
    it("should catch poll error and continue polling", async () => {
      // First poll throws, second succeeds with DN
      mockGetRequisition
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockResolvedValueOnce({
          id: "req-123",
          status: "DN",
          accounts: ["acc-recovered"],
          redirect: "",
          reference: "billclaw-test",
          link: "",
        })

      const context = createMockCliContext()
      const promise = runGoCardlessConnect(context, {
        institution: "SANDBOX_Oj",
        timeout: 5,
      })

      await vi.advanceTimersByTimeAsync(2500) // 1st poll (error)
      await vi.advanceTimersByTimeAsync(2000) // 2nd poll (success)

      await promise

      expect(mockGetRequisition).toHaveBeenCalledTimes(2)
      expect(mockSpinner.succeed).toHaveBeenCalled()
      expect(mockExit).not.toHaveBeenCalled()
    })
  })

  describe("poll interval", () => {
    it("should use 2000ms poll interval", async () => {
      mockGetRequisition.mockResolvedValue({
        id: "req-123",
        status: "CR",
        accounts: [],
        redirect: "",
        reference: "billclaw-test",
        link: "",
      })

      const context = createMockCliContext()
      // Short timeout for quick test
      const promise = runGoCardlessConnect(context, {
        institution: "SANDBOX_Oj",
        timeout: 0.1, // 6 seconds
      })

      // Advance 6.5 seconds to let timeout kick in
      await vi.advanceTimersByTimeAsync(6500)

      await expect(promise).rejects.toThrow("process.exit")

      // With 2s interval and ~6s timeout, should get roughly 3 polls
      expect(mockGetRequisition.mock.calls.length).toBeGreaterThanOrEqual(2)
      expect(mockGetRequisition.mock.calls.length).toBeLessThanOrEqual(4)
    })
  })

  describe("requisitionId usage", () => {
    it("should pass requisitionId to adapter.getRequisition", async () => {
      mockCreateRequisition.mockResolvedValue({
        id: "req-specific-id",
        link: "https://bank.example.com/oauth",
        status: "CR",
        accounts: [],
        reference: "billclaw-test",
        redirect: "https://relay.firela.io/callback/gocardless",
      })

      mockGetRequisition.mockResolvedValue({
        id: "req-specific-id",
        status: "DN",
        accounts: ["acc-1"],
        redirect: "",
        reference: "billclaw-test",
        link: "",
      })

      const context = createMockCliContext()
      const promise = runGoCardlessConnect(context, {
        institution: "SANDBOX_Oj",
        timeout: 5,
      })

      await vi.advanceTimersByTimeAsync(2500)

      await promise

      expect(mockGetRequisition).toHaveBeenCalledWith("req-specific-id", "")
    })
  })
})
