/**
 * Tests for GoCardless relay type definitions
 *
 * These tests validate Zod schemas for GoCardless Bank Account Data API types
 * used in the firela-relay communication.
 */

import { describe, it, expect } from "vitest"
import {
  TokenResponseSchema,
  InstitutionSchema,
  RequisitionSchema,
  AccountSchema,
  GoCardlessTransactionSchema,
  TransactionsResponseSchema,
  CreateRequisitionRequestSchema,
  GetTransactionsRequestSchema,
} from "./gocardless-types.js"

describe("TokenResponse schema", () => {
  it("validates correct structure", () => {
    const validToken = {
      access: "access-token-123",
      access_expires: 86400,
      refresh: "refresh-token-456",
      refresh_expires: 2592000,
    }

    const result = TokenResponseSchema.safeParse(validToken)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.access).toBe("access-token-123")
      expect(result.data.access_expires).toBe(86400)
      expect(result.data.refresh).toBe("refresh-token-456")
      expect(result.data.refresh_expires).toBe(2592000)
    }
  })

  it("rejects missing required fields", () => {
    const invalidToken = {
      access: "access-token-123",
      // missing access_expires
      refresh: "refresh-token-456",
      refresh_expires: 2592000,
    }

    const result = TokenResponseSchema.safeParse(invalidToken)
    expect(result.success).toBe(false)
  })
})

describe("Institution schema", () => {
  it("validates all required fields", () => {
    const validInstitution = {
      id: "SANDBOXFINANCE_SFIN0000",
      name: "Sandbox Finance",
      bic: "SFIN0000",
      countries: ["GB", "DE"],
      logo: "https://example.com/logo.png",
      transaction_total_days: 90,
    }

    const result = InstitutionSchema.safeParse(validInstitution)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe("SANDBOXFINANCE_SFIN0000")
      expect(result.data.name).toBe("Sandbox Finance")
      expect(result.data.bic).toBe("SFIN0000")
      expect(result.data.countries).toEqual(["GB", "DE"])
      expect(result.data.logo).toBe("https://example.com/logo.png")
      expect(result.data.transaction_total_days).toBe(90)
    }
  })

  it("rejects missing id", () => {
    const invalidInstitution = {
      name: "Sandbox Finance",
      bic: "SFIN0000",
      countries: ["GB"],
    }

    const result = InstitutionSchema.safeParse(invalidInstitution)
    expect(result.success).toBe(false)
  })
})

describe("Requisition schema", () => {
  it("validates status and accounts array", () => {
    const validRequisition = {
      id: "requisition-uuid-123",
      redirect: "https://example.com/callback",
      status: "LN",
      accounts: ["account-uuid-1", "account-uuid-2"],
      reference: "ref-123",
      link: "https://ob.gocardless.com/link/123",
    }

    const result = RequisitionSchema.safeParse(validRequisition)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe("requisition-uuid-123")
      expect(result.data.status).toBe("LN")
      expect(result.data.accounts).toEqual(["account-uuid-1", "account-uuid-2"])
      expect(result.data.accounts).toBeInstanceOf(Array)
    }
  })

  it("accepts empty accounts array", () => {
    const requisitionWithNoAccounts = {
      id: "requisition-uuid-123",
      redirect: "https://example.com/callback",
      status: "CR",
      accounts: [],
      reference: "ref-123",
      link: "https://ob.gocardless.com/link/123",
    }

    const result = RequisitionSchema.safeParse(requisitionWithNoAccounts)
    expect(result.success).toBe(true)
  })

  it("rejects accounts as nested objects (key difference from Plaid)", () => {
    const invalidRequisition = {
      id: "requisition-uuid-123",
      redirect: "https://example.com/callback",
      status: "LN",
      accounts: [{ id: "account-1", name: "Account" }], // Should be string[]
      reference: "ref-123",
      link: "https://ob.gocardless.com/link/123",
    }

    const result = RequisitionSchema.safeParse(invalidRequisition)
    expect(result.success).toBe(false)
  })
})

describe("Account schema", () => {
  it("validates required fields", () => {
    const validAccount = {
      id: "account-uuid-123",
      created: "2024-01-15T10:30:00Z",
      last_accessed: "2024-01-20T14:45:00Z",
      iban: "GB29NWBK60161331926819",
      institution_id: "SANDBOXFINANCE_SFIN0000",
      status: "READY",
      owner_name: "John Doe",
    }

    const result = AccountSchema.safeParse(validAccount)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe("account-uuid-123")
      expect(result.data.iban).toBe("GB29NWBK60161331926819")
      expect(result.data.status).toBe("READY")
    }
  })
})

describe("GoCardlessTransaction schema", () => {
  it("validates amount structure", () => {
    const validTransaction = {
      transactionId: "tx-123",
      bookingDate: "2024-01-15",
      valueDate: "2024-01-15",
      transactionAmount: {
        amount: "-50.00",
        currency: "EUR",
      },
      remittanceInformationUnstructured: "Payment to merchant",
    }

    const result = GoCardlessTransactionSchema.safeParse(validTransaction)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.transactionAmount.amount).toBe("-50.00")
      expect(result.data.transactionAmount.currency).toBe("EUR")
      expect(result.data.remittanceInformationUnstructured).toBe(
        "Payment to merchant",
      )
    }
  })

  it("accepts transactions with optional fields missing", () => {
    const minimalTransaction = {
      transactionId: "tx-456",
      bookingDate: "2024-01-15",
      valueDate: "2024-01-15",
      transactionAmount: {
        amount: "100.00",
        currency: "EUR",
      },
    }

    const result = GoCardlessTransactionSchema.safeParse(minimalTransaction)
    expect(result.success).toBe(true)
  })
})

describe("TransactionsResponse schema", () => {
  it("validates booked and pending arrays", () => {
    const validResponse = {
      transactions: {
        booked: [
          {
            transactionId: "tx-1",
            bookingDate: "2024-01-15",
            valueDate: "2024-01-15",
            transactionAmount: { amount: "-50.00", currency: "EUR" },
          },
        ],
        pending: [
          {
            transactionId: "tx-2",
            bookingDate: "2024-01-16",
            valueDate: "2024-01-16",
            transactionAmount: { amount: "25.00", currency: "EUR" },
          },
        ],
      },
    }

    const result = TransactionsResponseSchema.safeParse(validResponse)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.transactions.booked).toHaveLength(1)
      expect(result.data.transactions.pending).toHaveLength(1)
    }
  })

  it("accepts empty arrays", () => {
    const emptyResponse = {
      transactions: {
        booked: [],
        pending: [],
      },
    }

    const result = TransactionsResponseSchema.safeParse(emptyResponse)
    expect(result.success).toBe(true)
  })
})

describe("CreateRequisitionRequest schema", () => {
  it("validates redirect and reference", () => {
    const validRequest = {
      institution_id: "SANDBOXFINANCE_SFIN0000",
      redirect: "https://example.com/callback",
      reference: "ref-123",
      user_language: "en",
    }

    const result = CreateRequisitionRequestSchema.safeParse(validRequest)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.institution_id).toBe("SANDBOXFINANCE_SFIN0000")
      expect(result.data.redirect).toBe("https://example.com/callback")
      expect(result.data.reference).toBe("ref-123")
    }
  })

  it("accepts request without optional user_language", () => {
    const minimalRequest = {
      institution_id: "SANDBOXFINANCE_SFIN0000",
      redirect: "https://example.com/callback",
      reference: "ref-123",
    }

    const result = CreateRequisitionRequestSchema.safeParse(minimalRequest)
    expect(result.success).toBe(true)
  })

  it("rejects missing institution_id", () => {
    const invalidRequest = {
      redirect: "https://example.com/callback",
      reference: "ref-123",
    }

    const result = CreateRequisitionRequestSchema.safeParse(invalidRequest)
    expect(result.success).toBe(false)
  })
})

describe("GetTransactionsRequest schema", () => {
  it("validates access_token and account_id", () => {
    const validRequest = {
      access_token: "access-token-123",
      account_id: "account-uuid-456",
      date_from: "2024-01-01",
      date_to: "2024-01-31",
    }

    const result = GetTransactionsRequestSchema.safeParse(validRequest)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.access_token).toBe("access-token-123")
      expect(result.data.account_id).toBe("account-uuid-456")
    }
  })

  it("accepts request without optional date filters", () => {
    const minimalRequest = {
      access_token: "access-token-123",
      account_id: "account-uuid-456",
    }

    const result = GetTransactionsRequestSchema.safeParse(minimalRequest)
    expect(result.success).toBe(true)
  })

  it("rejects missing access_token", () => {
    const invalidRequest = {
      account_id: "account-uuid-456",
    }

    const result = GetTransactionsRequestSchema.safeParse(invalidRequest)
    expect(result.success).toBe(false)
  })

  it("rejects missing account_id", () => {
    const invalidRequest = {
      access_token: "access-token-123",
    }

    const result = GetTransactionsRequestSchema.safeParse(invalidRequest)
    expect(result.success).toBe(false)
  })
})
