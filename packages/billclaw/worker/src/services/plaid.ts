/**
 * Plaid Service for Cloudflare Worker
 *
 * Provides Plaid API integration for the Worker environment.
 * Uses the plaid npm package with nodejs_compat flag.
 *
 * @packageDocumentation
 */

import type { Env } from "../types/env.js"

/**
 * Plaid API configuration derived from Worker environment
 */
export interface PlaidWorkerConfig {
  clientId: string
  secret: string
  env: "sandbox" | "development" | "production"
}

/**
 * Get Plaid configuration from Worker environment
 */
export function getPlaidConfig(env: Env): PlaidWorkerConfig {
  return {
    clientId: env.PLAID_CLIENT_ID,
    secret: env.PLAID_SECRET,
    env: env.PLAID_ENV,
  }
}

/**
 * Get Plaid API base URL for the environment
 */
export function getPlaidBaseUrl(env: Env): string {
  switch (env.PLAID_ENV) {
    case "production":
      return "https://production.plaid.com"
    case "development":
      return "https://development.plaid.com"
    case "sandbox":
    default:
      return "https://sandbox.plaid.com"
  }
}

/**
 * Create Plaid Link token
 *
 * @param env - Worker environment with Plaid credentials
 * @param userId - User ID for the Link token
 * @returns Link token for initializing Plaid Link frontend
 */
export async function createLinkToken(
  env: Env,
  userId: string,
): Promise<{ linkToken: string }> {
  const baseUrl = getPlaidBaseUrl(env)

  const response = await fetch(`${baseUrl}/link/token/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.PLAID_CLIENT_ID,
      secret: env.PLAID_SECRET,
      user: {
        client_user_id: userId,
      },
      client_name: "BillClaw",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create Plaid Link token: ${error}`)
  }

  const data = (await response.json()) as { link_token: string }
  return { linkToken: data.link_token }
}

/**
 * Exchange Plaid public token for access token
 *
 * @param env - Worker environment with Plaid credentials
 * @param publicToken - Public token from Plaid Link callback
 * @returns Access token and item ID
 */
export async function exchangePublicToken(
  env: Env,
  publicToken: string,
): Promise<{ accessToken: string; itemId: string }> {
  const baseUrl = getPlaidBaseUrl(env)

  const response = await fetch(
    `${baseUrl}/item/public_token/exchange`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: env.PLAID_CLIENT_ID,
        secret: env.PLAID_SECRET,
        public_token: publicToken,
      }),
    },
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange Plaid public token: ${error}`)
  }

  const data = (await response.json()) as {
    access_token: string
    item_id: string
  }
  return {
    accessToken: data.access_token,
    itemId: data.item_id,
  }
}

/**
 * Get item information from Plaid
 *
 * @param env - Worker environment with Plaid credentials
 * @param accessToken - Plaid access token
 * @returns Item information
 */
export async function getItem(
  env: Env,
  accessToken: string,
): Promise<{ itemId: string; institutionId: string; webhookUrl: string }> {
  const baseUrl = getPlaidBaseUrl(env)

  const response = await fetch(`${baseUrl}/item/get`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.PLAID_CLIENT_ID,
      secret: env.PLAID_SECRET,
      access_token: accessToken,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get Plaid item: ${error}`)
  }

  const data = (await response.json()) as {
    item: {
      item_id: string
      institution_id: string
      webhook: string
    }
  }
  return {
    itemId: data.item.item_id,
    institutionId: data.item.institution_id,
    webhookUrl: data.item.webhook,
  }
}

/**
 * Get institution name from Plaid
 *
 * @param env - Worker environment with Plaid credentials
 * @param institutionId - Plaid institution ID
 * @returns Institution name
 */
export async function getInstitution(
  env: Env,
  institutionId: string,
): Promise<{ name: string }> {
  const baseUrl = getPlaidBaseUrl(env)

  const response = await fetch(`${baseUrl}/institutions/get_by_id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.PLAID_CLIENT_ID,
      secret: env.PLAID_SECRET,
      institution_id: institutionId,
      country_codes: ["US"],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get Plaid institution: ${error}`)
  }

  const data = (await response.json()) as {
    institution: {
      name: string
    }
  }
  return { name: data.institution.name }
}
