/**
 * Config command
 *
 * Manage plugin configuration.
 */

import type { CliCommand, CliContext } from "./registry.js"
import { maskApiKey } from "@firela/billclaw-core/relay"
import type { RelayConfig } from "@firela/billclaw-core"
import {
  validateRelayConnection,
  classifyRelayError,
} from "../utils/relay-config.js"
import { success, error, warn, info, formatStatus } from "../utils/format.js"

/**
 * Run config command
 */
async function runConfig(
  context: CliContext,
  args?: { key?: string; value?: string; list?: boolean; verbose?: boolean },
): Promise<void> {
  const { runtime } = context

  const list = args?.list ?? false
  const key = args?.key
  const value = args?.value
  const verbose = args?.verbose ?? false

  if (list || (!key && !value)) {
    await listConfig(runtime, verbose)
  } else if (key && value) {
    await setConfig(runtime, key, value)
  } else if (key) {
    await getConfig(runtime, key)
  }
}

/**
 * List all configuration
 */
async function listConfig(
  runtime: CliContext["runtime"],
  verbose: boolean = false,
): Promise<void> {
  // Use getEffectiveConfig to include environment variable overrides
  // This is important for relay configuration which can be set via env vars
  const configProvider = runtime.config as {
    getConfig: () => Promise<any>
    getConfigManager?: () => { getEffectiveConfig: () => Promise<any> }
  }

  let config: any
  if (configProvider.getConfigManager) {
    // Use getEffectiveConfig to merge env overrides (e.g., FIRELA_RELAY_URL)
    config = await configProvider.getConfigManager().getEffectiveConfig()
  } else {
    // Fallback to getConfig if getConfigManager not available
    config = await configProvider.getConfig()
  }

  // Display relay configuration with health check
  await displayRelayConfig(config, runtime, verbose)

  // Display rest of config as JSON (existing behavior)
  console.log("")
  console.log("Full Configuration:")
  console.log(JSON.stringify(config, null, 2))
}

/**
 * Display relay configuration with health check
 */
async function displayRelayConfig(
  config: { relay?: RelayConfig },
  runtime: CliContext["runtime"],
  verbose: boolean = false,
): Promise<void> {
  const relay = config.relay

  console.log("") // Blank line for readability
  console.log("Relay Configuration:")

  // Not configured
  if (!relay?.url && !relay?.apiKey) {
    console.log("  Status: Not configured")
    if (verbose) {
      info("Set FIRELA_RELAY_URL and FIRELA_RELAY_API_KEY to enable relay mode")
    }
    return
  }

  // Display URL (not masked)
  console.log(`  URL: ${relay.url || "Not set"}`)

  // Display masked API key
  console.log(`  API Key: ${relay.apiKey ? maskApiKey(relay.apiKey) : "Not set"}`)

  // Verbose mode: show additional config
  if (verbose) {
    console.log(`  Timeout: ${relay.timeout ?? 30000}ms`)
    console.log(`  Retries: ${relay.maxRetries ?? 3}`)
  }

  // Perform health check
  const healthResult = await validateRelayConnection(relay, runtime.logger)

  // Display status with color
  if (healthResult.available) {
    const latency = healthResult.latency ? ` (${healthResult.latency}ms)` : ""
    console.log(`  Status: ${formatStatus("Connected")}${verbose ? latency : ""}`)
  } else {
    console.log(`  Status: ${formatStatus("Failed")}`)

    // Show error guidance (action always visible for fix commands)
    const guidance = classifyRelayError(healthResult, relay)
    error(guidance.message)
    console.log(guidance.action)

    // Show fallback warning
    warn("Relay unavailable, falling back to direct/polling mode")
  }
}

/**
 * Get a config value
 */
async function getConfig(
  runtime: CliContext["runtime"],
  key: string,
): Promise<void> {
  const config = await runtime.config.getConfig()

  // Support dot notation for nested keys
  const keys = key.split(".")
  let value: any = config

  for (const k of keys) {
    value = value?.[k]
  }

  if (value === undefined) {
    console.log(`Config key '${key}' not found`)
    return
  }

  if (typeof value === "object") {
    console.log(JSON.stringify(value, null, 2))
  } else {
    console.log(String(value))
  }
}

/**
 * Set a config value
 */
async function setConfig(
  runtime: CliContext["runtime"],
  key: string,
  valueStr: string,
): Promise<void> {
  const config = await runtime.config.getConfig()

  // Support dot notation for nested keys
  const keys = key.split(".")
  let target: any = config

  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in target)) {
      target[keys[i]] = {}
    }
    target = target[keys[i]]
  }

  // Try to parse as JSON first
  let parsedValue: unknown
  try {
    parsedValue = JSON.parse(valueStr)
  } catch {
    parsedValue = valueStr
  }

  target[keys[keys.length - 1]] = parsedValue

  // Save the updated config
  const provider = runtime.config as any
  if (typeof provider.saveConfig === "function") {
    await provider.saveConfig(config)
    success(`Config '${key}' updated`)
  } else {
    error("Saving config not supported")
  }
}

/**
 * Config command definition
 */
export const configCommand: CliCommand = {
  name: "config",
  description: "Manage plugin configuration",
  options: [
    {
      flags: "-l, --list",
      description: "List all configuration",
    },
    {
      flags: "-k, --key <key>",
      description: "Config key to view/set",
    },
    {
      flags: "-v, --value <value>",
      description: "Config value to set",
    },
    {
      flags: "-V, --verbose",
      description: "Show detailed output",
    },
  ],
  handler: (context: CliContext, args?: Record<string, unknown>) => {
    const typedArgs = args as {
      key?: string
      value?: string
      list?: boolean
      verbose?: boolean
    } | undefined
    return runConfig(context, typedArgs ?? {})
  },
}
