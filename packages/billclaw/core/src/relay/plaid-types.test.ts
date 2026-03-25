/**
 * Tests for Plaid relay type definitions
 */

import { describe, it, expect } from "vitest"
import {
  LinkTokenCreateRequestSchema,
  LinkTokenCreateResponseSchema,
  PublicTokenExchangeRequestSchema,
  PublicTokenExchangeResponseSchema,
  AccountsGetRequestSchema,
  AccountsGetResponseSchema,
  TransactionsSyncRequestSchema,
  TransactionsSyncResponseSchema,
  type LinkTokenCreateRequest,
  type LinkTokenCreateResponse,
  type PublicTokenExchangeRequest,
  type PublicTokenExchangeResponse,
  type AccountsGetRequest,
  type AccountsGetResponse,
  type TransactionsSyncRequest,
  type TransactionsSyncResponse,
} from "./plaid-types.js"

describe("Plaid relay type definitions", () => {
  describe("LinkTokenCreateRequest", () => {
    it("validates required fields (client_name, language, country_codes, user)", () => {
      const validRequest: LinkTokenCreateRequest = {
        client_name: "BillClaw",
        language: "en",
        country_codes: ["US"],
        user: { client_user_id: "user-123" },
      }

      const result = LinkTokenCreateRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it("rejects missing required fields", () => {
      const invalidRequest = {
        client_name: "BillClaw",
        // missing language
        country_codes: ["US"],
        user: { client_user_id: "user-123" },
      }

      const result = LinkTokenCreateRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it("accepts optional fields (products, webhook, redirect_uri)", () => {
      const requestWithOptional: LinkTokenCreateRequest = {
        client_name: "BillClaw",
        language: "en",
        country_codes: ["US"],
        user: { client_user_id: "user-123" },
        products: ["transactions"],
        webhook: "https://example.com/webhook",
        redirect_uri: "https://example.com/callback",
      }

      const result = LinkTokenCreateRequestSchema.safeParse(requestWithOptional)
      expect(result.success).toBe(true)
    })
  })

  describe("LinkTokenCreateResponse", () => {
    it("contains link_token and expiration", () => {
      const validResponse: LinkTokenCreateResponse = {
        link_token: "link-sandbox-123",
        expiration: "2024-01-01T00:00:00Z",
      }

      const result = LinkTokenCreateResponseSchema.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it("accepts optional request_id", () => {
      const responseWithRequestId: LinkTokenCreateResponse = {
        link_token: "link-sandbox-123",
        expiration: "2024-01-01T00:00:00Z",
        request_id: "req-456",
      }

      const result = LinkTokenCreateResponseSchema.safeParse(responseWithRequestId)
      expect(result.success).toBe(true)
    })
  })

  describe("PublicTokenExchangeRequest", () => {
    it("requires public_token", () => {
      const validRequest: PublicTokenExchangeRequest = {
        public_token: "public-sandbox-123",
      }

      const result = PublicTokenExchangeRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it("rejects missing public_token", () => {
      const invalidRequest = {}

      const result = PublicTokenExchangeRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  describe("PublicTokenExchangeResponse", () => {
    it("contains access_token and item_id", () => {
      const validResponse: PublicTokenExchangeResponse = {
        access_token: "access-sandbox-123",
        item_id: "item-456",
      }

      const result = PublicTokenExchangeResponseSchema.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it("accepts optional request_id", () => {
      const responseWithRequestId: PublicTokenExchangeResponse = {
        access_token: "access-sandbox-123",
        item_id: "item-456",
        request_id: "req-789",
      }

      const result = PublicTokenExchangeResponseSchema.safeParse(responseWithRequestId)
      expect(result.success).toBe(true)
    })
  })

  describe("AccountsGetRequest", () => {
    it("requires access_token", () => {
      const validRequest: AccountsGetRequest = {
        access_token: "access-sandbox-123",
      }

      const result = AccountsGetRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it("accepts optional options with account_ids", () => {
      const requestWithOptions: AccountsGetRequest = {
        access_token: "access-sandbox-123",
        options: {
          account_ids: ["acc-1", "acc-2"],
        },
      }

      const result = AccountsGetRequestSchema.safeParse(requestWithOptions)
      expect(result.success).toBe(true)
    })
  })

  describe("TransactionsSyncRequest", () => {
    it("requires access_token", () => {
      const validRequest: TransactionsSyncRequest = {
        access_token: "access-sandbox-123",
      }

      const result = TransactionsSyncRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it("accepts optional cursor", () => {
      const requestWithCursor: TransactionsSyncRequest = {
        access_token: "access-sandbox-123",
        cursor: "cursor-abc",
      }

      const result = TransactionsSyncRequestSchema.safeParse(requestWithCursor)
      expect(result.success).toBe(true)
    })

    it("accepts optional count", () => {
      const requestWithCount: TransactionsSyncRequest = {
        access_token: "access-sandbox-123",
        count: 100,
      }

      const result = TransactionsSyncRequestSchema.safeParse(requestWithCount)
      expect(result.success).toBe(true)
    })
  })

  describe("TransactionsSyncResponse", () => {
    it("contains added, modified, removed, next_cursor, has_more", () => {
      const validResponse: TransactionsSyncResponse = {
        added: [],
        modified: [],
        removed: [],
        next_cursor: "cursor-next",
        has_more: false,
      }

      const result = TransactionsSyncResponseSchema.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it("parses transaction objects in added array", () => {
      const responseWithTransactions: TransactionsSyncResponse = {
        added: [
          {
            transaction_id: "txn-1",
            account_id: "acc-1",
            amount: 100.50,
            date: "2024-01-15",
            name: "Merchant Name",
            merchant_name: "Merchant",
            iso_currency_code: "USD",
            category: ["Food", "Restaurants"],
            pending: false,
            payment_channel: "in_store",
          },
        ],
        modified: [],
        removed: [],
        next_cursor: "cursor-next",
        has_more: false,
      }

      const result = TransactionsSyncResponseSchema.safeParse(responseWithTransactions)
      expect(result.success).toBe(true)
    })

    it("parses removed transaction ids", () => {
      const responseWithRemoved: TransactionsSyncResponse = {
        added: [],
        modified: [],
        removed: [{ transaction_id: "txn-removed" }],
        next_cursor: "cursor-next",
        has_more: false,
      }

      const result = TransactionsSyncResponseSchema.safeParse(responseWithRemoved)
      expect(result.success).toBe(true)
    })
  })

  describe("AccountsGetResponse", () => {
    it("contains accounts and item", () => {
      const validResponse: AccountsGetResponse = {
        accounts: [
          {
            account_id: "acc-1",
            balances: {
              available: 100.00,
              current: 150.00,
              iso_currency_code: "USD",
            },
            name: "Checking Account",
            mask: "1234",
            type: "depository",
            subtype: "checking",
          },
        ],
        item: {
          item_id: "item-1",
          institution_id: "ins-1",
        },
      }

      const result = AccountsGetResponseSchema.safeParse(validResponse)
      expect(result.success).toBe(true)
    })
  })
})
