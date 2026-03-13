/**
 * Config command
 *
 * Manage plugin configuration.
 */

import type { CliCommand, CliContext } from "./registry.js"
import { success, error } from "../utils/format.js"

/**
 * Run config command
 */
async function runConfig(
  context: CliContext,
  args?: { key?: string; value?: string; list?: boolean },
): Promise<void> {
  const { runtime } = context

  const list = args?.list ?? false
  const key = args?.key
  const value = args?.value

  if (list || (!key && !value)) {
    await listConfig(runtime)
  } else if (key && value) {
    await setConfig(runtime, key, value)
  } else if (key) {
    await getConfig(runtime, key)
  }
}

/**
 * List all configuration
 */
async function listConfig(runtime: CliContext["runtime"]): Promise<void> {
  const config = await runtime.config.getConfig()
  console.log(JSON.stringify(config, null, 2))
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
  ],
  handler: (context: CliContext, args?: Record<string, unknown>) => {
    const typedArgs = args as {
      key?: string
      value?: string
      list?: boolean
    } | undefined
    return runConfig(context, typedArgs ?? {})
  },
}
