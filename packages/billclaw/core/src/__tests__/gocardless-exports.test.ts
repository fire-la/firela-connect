/**
 * Tests for GoCardless exports from core package
 *
 * Verifies that GoCardless adapter and types are properly exported
 * from the @firela/billclaw-core package.
 */

import { describe, it, expect } from "vitest"

// Import from core package - these should be available
import {
  createGoCardlessAdapter,
  type GoCardlessSyncAdapter,
} from "../index.js"

describe("GoCardless exports from core package", () => {
  describe("createGoCardlessAdapter", () => {
    it("is exported from core package", () => {
      expect(createGoCardlessAdapter).toBeDefined()
      expect(typeof createGoCardlessAdapter).toBe("function")
    })
  })

  describe("GoCardlessSyncAdapter type", () => {
    it("is available as a type export", () => {
      // Type-only import verification
      // This test ensures the type is exported correctly
      // We can't test types at runtime, but we can verify the import works
      type AdapterType = GoCardlessSyncAdapter

      // Create a value that satisfies the interface
      const mockAdapter: AdapterType = {
        getInstitutions: async () => [],
        createRequisition: async () =>
          ({
            id: "test",
            redirect: "",
            status: "CR",
            accounts: [],
            reference: "",
            link: "",
          }) as any,
        getRequisition: async () =>
          ({
            id: "test",
            redirect: "",
            status: "DN",
            accounts: [],
            reference: "",
            link: "",
          }) as any,
        getAccounts: async () => [],
        getTransactions: async () => ({ transactions: { booked: [], pending: [] } }),
        getMode: () => "relay",
      }

      expect(mockAdapter.getMode()).toBe("relay")
    })
  })
})
