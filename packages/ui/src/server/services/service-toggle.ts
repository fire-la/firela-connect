/**
 * Service Toggle Store
 *
 * KV-based storage for runtime service toggle state.
 * Merges stored state with environment variable defaults.
 *
 * @packageDocumentation
 */

import type { Env } from "../index.js"
import type { ServiceState, ServiceId } from "../../types/services.js"

/**
 * KV key for storing service toggle state
 */
const KV_KEY = "service-toggles"

/**
 * Get the current service toggle state
 *
 * Merges KV-stored state with environment variable defaults.
 * If no state is stored, uses environment variables as defaults.
 *
 * @param env - Cloudflare Worker environment bindings
 * @returns Current service toggle state
 */
export async function getServiceState(env: Env): Promise<ServiceState> {
  const stored = await env.CONFIG.get<ServiceState>(KV_KEY, "json")

  return {
    billclaw: stored?.billclaw ?? env.BILLCLAW_ENABLED !== "false",
    firelaBot: stored?.firelaBot ?? env.FIRELA_BOT_ENABLED !== "false",
  }
}

/**
 * Update a single service toggle state
 *
 * Stores the updated state in KV. The change takes effect immediately.
 *
 * @param env - Cloudflare Worker environment bindings
 * @param serviceId - Service to toggle
 * @param enabled - New enabled state
 * @returns Updated service toggle state
 */
export async function setServiceEnabled(env: Env, serviceId: ServiceId, enabled: boolean): Promise<ServiceState> {
  const current = await getServiceState(env)
  const updated: ServiceState = { ...current, [serviceId]: enabled }

  await env.CONFIG.put(KV_KEY, JSON.stringify(updated))

  return updated
}

/**
 * Check if a specific service is enabled
 *
 * Convenience function for single-service checks.
 *
 * @param env - Cloudflare Worker environment bindings
 * @param serviceId - Service to check
 * @returns true if service is enabled
 */
export async function isServiceEnabled(env: Env, serviceId: ServiceId): Promise<boolean> {
  const state = await getServiceState(env)
  return state[serviceId]
}
