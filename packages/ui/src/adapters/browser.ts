/**
 * Browser Adapter
 *
 * Implementation of UIAdapter for browser environments.
 * Uses fetch API for HTTP communication with backend services.
 */
import type {
  UIAdapter,
  BillclawConfig,
  Account,
  SyncResult,
  SyncStatus,
  SystemStatus,
} from "./types"
import type { RelayHealthInfo, GoCardlessInstitution, GoCardlessRequisition } from "../types/relay"

// API response wrapper types
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Browser-based adapter using fetch API
 */
export class BrowserAdapter implements UIAdapter {
  private baseUrl = "/api"

  async getConfig(): Promise<BillclawConfig> {
    const res = await fetch(`${this.baseUrl}/config`)
    const json: ApiResponse<BillclawConfig> = await res.json()
    if (!json.data) throw new Error("No config data returned")
    return json.data
  }

  async updateConfig(config: Partial<BillclawConfig>): Promise<void> {
    const res = await fetch(`${this.baseUrl}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    })
    if (!res.ok) {
      const json: ApiResponse<unknown> = await res.json()
      throw new Error(json.error || "Failed to update config")
    }
  }

  async listAccounts(): Promise<Account[]> {
    const res = await fetch(`${this.baseUrl}/accounts`)
    const json: ApiResponse<Account[]> = await res.json()
    return json.data || []
  }

  async connectAccount(provider: "plaid" | "gmail"): Promise<{ url: string }> {
    const res = await fetch(`${this.baseUrl}/connect/${provider}`, {
      method: "POST",
    })
    const json: ApiResponse<{ url: string }> = await res.json()
    if (!json.data) throw new Error("No connection URL returned")
    return json.data
  }

  async disconnectAccount(accountId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/accounts/${accountId}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      const json: ApiResponse<unknown> = await res.json()
      throw new Error(json.error || "Failed to disconnect account")
    }
  }

  async syncAccount(accountId: string): Promise<SyncResult> {
    const res = await fetch(`${this.baseUrl}/sync/${accountId}`, {
      method: "POST",
    })
    const json: ApiResponse<SyncResult> = await res.json()
    if (!json.data) throw new Error("No sync result returned")
    return json.data
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const res = await fetch(`${this.baseUrl}/sync/status`)
    const json: ApiResponse<SyncStatus> = await res.json()
    if (!json.data) throw new Error("No sync status returned")
    return json.data
  }

  async getSystemStatus(): Promise<SystemStatus> {
    const res = await fetch(`${this.baseUrl}/system/status`)
    const json: ApiResponse<SystemStatus> = await res.json()
    if (!json.data) throw new Error("No system status returned")
    return json.data
  }

  async refreshGmailToken(accountId: string): Promise<{
    success: boolean
    accessToken?: string
    expiresIn?: number
    error?: string
  }> {
    const res = await fetch(`${this.baseUrl}/oauth/gmail/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountId }),
    })
    return res.json()
  }

  async updateAccount(accountId: string, enabled: boolean): Promise<{
    success: boolean
    data?: Account
    error?: string
  }> {
    const res = await fetch(`${this.baseUrl}/accounts/${accountId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    })
    return res.json()
  }

  async searchInstitutions(country: string): Promise<GoCardlessInstitution[]> {
    const res = await fetch(`${this.baseUrl}/oauth/gocardless/institutions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country }),
    })
    const json: ApiResponse<GoCardlessInstitution[]> = await res.json()
    return json.data || []
  }

  async createRequisition(institutionId: string, redirectUrl: string): Promise<GoCardlessRequisition> {
    const res = await fetch(`${this.baseUrl}/oauth/gocardless/requisitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ institution_id: institutionId, redirect_url: redirectUrl }),
    })
    const json: ApiResponse<GoCardlessRequisition> = await res.json()
    if (!json.data) throw new Error("No requisition data returned")
    return json.data
  }

  async pollRequisitionStatus(requisitionId: string, accessToken: string): Promise<GoCardlessRequisition> {
    const res = await fetch(`${this.baseUrl}/oauth/gocardless/requisitions/${requisitionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    })
    const json: ApiResponse<GoCardlessRequisition> = await res.json()
    if (!json.data) throw new Error("No requisition status returned")
    return json.data
  }

  async getRelayHealth(): Promise<RelayHealthInfo> {
    const res = await fetch(`${this.baseUrl}/relay/health`)
    const json: ApiResponse<RelayHealthInfo> = await res.json()
    // Health endpoint always returns data even when not configured
    return json.data || { available: false, configured: false }
  }
}
