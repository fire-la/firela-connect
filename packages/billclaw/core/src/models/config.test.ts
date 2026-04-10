/**
 * Tests for configuration schemas
 */

import { describe, it, expect } from "vitest"
import {
  AccountTypeSchema,
  AccountConfigSchema,
  SyncFrequencySchema,
  WebhookConfigSchema,
  StorageConfigSchema,
  SyncConfigSchema,
  PlaidConfigSchema,
  GmailConfigSchema,
  BillclawConfigSchema,
  ConnectionModeSchema,
  RelayConfigSchema,
  type AccountConfig,
  type BillclawConfig,
} from "../index"

describe("AccountTypeSchema", () => {
  const validTypes = ["plaid", "gocardless", "gmail"]

  it("should accept valid account types", () => {
    validTypes.forEach((type) => {
      const result = AccountTypeSchema.safeParse(type)
      expect(result.success).toBe(true)
    })
  })

  it("should reject invalid account types", () => {
    const result = AccountTypeSchema.safeParse("invalid")
    expect(result.success).toBe(false)
  })
})

describe("SyncFrequencySchema", () => {
  const validFrequencies = ["realtime", "hourly", "daily", "weekly", "manual"]

  it("should accept valid sync frequencies", () => {
    validFrequencies.forEach((freq) => {
      const result = SyncFrequencySchema.safeParse(freq)
      expect(result.success).toBe(true)
    })
  })

  it("should reject invalid sync frequencies", () => {
    const result = SyncFrequencySchema.safeParse("invalid")
    expect(result.success).toBe(false)
  })
})

describe("AccountConfigSchema", () => {
  const validAccount: AccountConfig = {
    id: "test-account-1",
    type: "plaid",
    name: "Test Bank",
    enabled: true,
    syncFrequency: "daily",
  }

  it("should accept valid account config", () => {
    const result = AccountConfigSchema.safeParse(validAccount)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validAccount)
    }
  })

  it("should require id field", () => {
    const { id: _id, ...invalid } = validAccount
    const result = AccountConfigSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it("should require type field", () => {
    const { type: _type, ...invalid } = validAccount as any
    const result = AccountConfigSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it("should accept Plaid-specific fields", () => {
    const plaidAccount = {
      ...validAccount,
      plaidItemId: "item-123",
      plaidAccessToken: "access-sandbox-123",
    }
    const result = AccountConfigSchema.safeParse(plaidAccount)
    expect(result.success).toBe(true)
  })

  it("should accept Gmail-specific fields", () => {
    const gmailAccount = {
      ...validAccount,
      type: "gmail" as const,
      gmailEmailAddress: "test@example.com",
      gmailFilters: ["from:billing@company.com"],
    }
    const result = AccountConfigSchema.safeParse(gmailAccount)
    expect(result.success).toBe(true)
  })

  it("should apply defaults for optional fields", () => {
    const minimalAccount = {
      id: "test-2",
      type: "plaid" as const,
      name: "Test",
    }
    const result = AccountConfigSchema.safeParse(minimalAccount)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.enabled).toBe(false)
      expect(result.data.syncFrequency).toBe("daily")
    }
  })
})

describe("WebhookConfigSchema", () => {
  const validWebhook = {
    enabled: true,
    url: "https://example.com/webhook",
    secret: "webhook-secret",
  }

  it("should accept valid webhook config", () => {
    const result = WebhookConfigSchema.safeParse(validWebhook)
    expect(result.success).toBe(true)
  })

  it("should require valid URL", () => {
    const invalidWebhook = { ...validWebhook, url: "not-a-url" }
    const result = WebhookConfigSchema.safeParse(invalidWebhook)
    expect(result.success).toBe(false)
  })

  it("should apply retryPolicy defaults", () => {
    const minimalWebhook = {
      enabled: false,
    }
    const result = WebhookConfigSchema.safeParse(minimalWebhook)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.retryPolicy.maxRetries).toBe(3)
    }
  })
})

describe("StorageConfigSchema", () => {
  const validStorage = {
    path: "~/.firela/billclaw",
    format: "json" as const,
    encryption: { enabled: false },
  }

  it("should accept valid storage config", () => {
    const result = StorageConfigSchema.safeParse(validStorage)
    expect(result.success).toBe(true)
  })

  it("should accept csv format", () => {
    const csvStorage = { ...validStorage, format: "csv" as const }
    const result = StorageConfigSchema.safeParse(csvStorage)
    expect(result.success).toBe(true)
  })

  it("should accept both format", () => {
    const bothStorage = { ...validStorage, format: "both" as const }
    const result = StorageConfigSchema.safeParse(bothStorage)
    expect(result.success).toBe(true)
  })
})

describe("SyncConfigSchema", () => {
  const validSync = {
    defaultFrequency: "daily" as const,
    maxRetries: 3,
    retryOnFailure: true,
  }

  it("should accept valid sync config", () => {
    const result = SyncConfigSchema.safeParse(validSync)
    expect(result.success).toBe(true)
  })

  it("should apply defaults", () => {
    const result = SyncConfigSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.defaultFrequency).toBe("daily")
      expect(result.data.maxRetries).toBe(3)
      expect(result.data.retryOnFailure).toBe(true)
    }
  })
})

describe("PlaidConfigSchema", () => {
  it("should accept valid Plaid config", () => {
    const config = {
      clientId: "test-client-id",
      secret: "test-secret",
      environment: "sandbox" as const,
    }
    const result = PlaidConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it("should apply default environment", () => {
    const result = PlaidConfigSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.environment).toBe("sandbox")
    }
  })
})

describe("GmailConfigSchema", () => {
  it("should accept valid Gmail config", () => {
    const config = {
      senderWhitelist: ["billing@company.com"],
      keywords: ["invoice", "receipt"],
    }
    const result = GmailConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it("should apply default keywords", () => {
    const result = GmailConfigSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.keywords).toContain("invoice")
      expect(result.data.keywords).toContain("receipt")
    }
  })
})

describe("ConnectionModeSchema", () => {
  it("should accept 'relay' as valid connection mode", () => {
    const result = ConnectionModeSchema.safeParse("relay")
    expect(result.success).toBe(true)
  })

  it("should accept all valid connection modes", () => {
    const validModes = ["auto", "direct", "relay", "polling"]
    validModes.forEach((mode) => {
      const result = ConnectionModeSchema.safeParse(mode)
      expect(result.success).toBe(true)
    })
  })
})

describe("RelayConfigSchema", () => {
  it("should validate url as optional URL string", () => {
    const result = RelayConfigSchema.safeParse({ url: "https://relay.firela.io" })
    expect(result.success).toBe(true)
  })

  it("should reject invalid url", () => {
    const result = RelayConfigSchema.safeParse({ url: "not-a-url" })
    expect(result.success).toBe(false)
  })

  it("should validate apiKey as optional string", () => {
    const result = RelayConfigSchema.safeParse({ apiKey: "test-api-key" })
    expect(result.success).toBe(true)
  })

  it("should default timeout to 30000", () => {
    const result = RelayConfigSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.timeout).toBe(30000)
    }
  })

  it("should default maxRetries to 3", () => {
    const result = RelayConfigSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.maxRetries).toBe(3)
    }
  })

  it("should accept valid relay config with all fields", () => {
    const config = {
      url: "https://relay.firela.io",
      apiKey: "test-api-key",
      timeout: 60000,
      maxRetries: 5,
    }
    const result = RelayConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(config)
    }
  })
})

describe("BillclawConfigSchema", () => {
  const validConfig: BillclawConfig = {
    accounts: [],
    webhooks: [],
    storage: {
      path: "~/.firela/billclaw",
      format: "json",
      encryption: { enabled: false },
    },
    sync: {
      defaultFrequency: "daily",
      maxRetries: 3,
      retryOnFailure: true,
    },
    plaid: {
      environment: "sandbox",
    },
  }

  it("should accept relay config when provided", () => {
    const configWithRelay = {
      ...validConfig,
      relay: {
        url: "https://relay.firela.io",
        apiKey: "test-api-key",
      },
    }
    const result = BillclawConfigSchema.safeParse(configWithRelay)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.relay).toBeDefined()
      expect(result.data.relay?.url).toBe("https://relay.firela.io")
    }
  })

  it("should accept config with connection mode set to relay", () => {
    const configWithRelay = {
      ...validConfig,
      connect: {
        port: 4456,
        host: "localhost",
        connection: {
          mode: "relay" as const,
        },
      },
      relay: {
        url: "https://relay.firela.io",
        apiKey: "test-key",
      },
    }
    const result = BillclawConfigSchema.safeParse(configWithRelay)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.connect?.connection?.mode).toBe("relay")
      expect(result.data.relay?.url).toBe("https://relay.firela.io")
    }
  })

  it("should accept valid full config", () => {
    const result = BillclawConfigSchema.safeParse(validConfig)
    expect(result.success).toBe(true)
  })

  it("should apply all defaults", () => {
    const result = BillclawConfigSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.accounts).toEqual([])
      expect(result.data.webhooks).toEqual([])
      expect(result.data.storage.format).toBe("json")
      expect(result.data.sync.defaultFrequency).toBe("daily")
      expect(result.data.plaid.environment).toBe("sandbox")
    }
  })

  it("should accept config with multiple accounts", () => {
    const configWithAccounts = {
      ...validConfig,
      accounts: [
        {
          id: "plaid-1",
          type: "plaid" as const,
          name: "Bank Account",
          enabled: true,
          syncFrequency: "daily" as const,
        },
        {
          id: "gmail-1",
          type: "gmail" as const,
          name: "Email Bills",
          enabled: true,
          syncFrequency: "weekly" as const,
        },
      ],
    }
    const result = BillclawConfigSchema.safeParse(configWithAccounts)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.accounts).toHaveLength(2)
    }
  })

  it("should accept GoCardless config when provided", () => {
    const configWithGoCardless = {
      ...validConfig,
      gocardless: {
        accessToken: "gc-token",
        environment: "sandbox" as const,
      },
    }
    const result = BillclawConfigSchema.safeParse(configWithGoCardless)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.gocardless).toBeDefined()
    }
  })

  it("should accept Gmail config when provided", () => {
    const configWithGmail = {
      ...validConfig,
      gmail: {
        keywords: ["invoice"],
      },
    }
    const result = BillclawConfigSchema.safeParse(configWithGmail)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.gmail).toBeDefined()
    }
  })
})
