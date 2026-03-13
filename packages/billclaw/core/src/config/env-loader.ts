/**
 * Environment variable loader for BillClaw configuration
 *
 * Maps environment variables to configuration paths with type conversion.
 */

/**
 * Environment variable mapping to config paths
 *
 * Format: "ENV_VAR_NAME" -> "config.path.to.value"
 */
const ENV_MAPPINGS: Record<string, string> = {
  // Connect service
  PORT: "connect.port",
  HOST: "connect.host",
  PUBLIC_URL: "connect.publicUrl",

  // TLS/SSL
  TLS_ENABLED: "connect.tls.enabled",
  TLS_KEY_PATH: "connect.tls.keyPath",
  TLS_CERT_PATH: "connect.tls.certPath",

  // Plaid
  PLAID_CLIENT_ID: "plaid.clientId",
  PLAID_SECRET: "plaid.secret",
  PLAID_ENVIRONMENT: "plaid.environment",

  // Gmail
  GMAIL_CLIENT_ID: "gmail.clientId",
  GMAIL_CLIENT_SECRET: "gmail.clientSecret",
}

/**
 * Type conversion for environment variable values
 */
function convertEnvValue(value: string, path: string): unknown {
  // Port number conversion
  if (path.endsWith(".port")) {
    const num = parseInt(value, 10)
    if (isNaN(num)) {
      throw new Error(`Invalid port number: ${value}`)
    }
    return num
  }

  // Boolean conversion
  if (value.toLowerCase() === "true") return true
  if (value.toLowerCase() === "false") return false

  // Number conversion
  const num = Number(value)
  if (!isNaN(num) && value !== "") {
    return num
  }

  // Default: string
  return value
}

/**
 * Get configuration overrides from environment variables
 *
 * Returns a partial config object with values from environment variables.
 * These values take precedence over config file values.
 */
export function loadEnvOverrides(): Record<string, unknown> {
  const overrides: Record<string, unknown> = {}

  for (const [envVar, configPath] of Object.entries(ENV_MAPPINGS)) {
    const envValue = process.env[envVar]
    if (envValue !== undefined) {
      // Convert path like "connect.port" to nested object
      const pathParts = configPath.split(".")
      let current = overrides

      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i]
        if (!(part in current)) {
          current[part] = {}
        }
        current = current[part] as Record<string, unknown>
      }

      const lastPart = pathParts[pathParts.length - 1]
      current[lastPart] = convertEnvValue(envValue, configPath)
    }
  }

  return overrides
}

/**
 * Get a specific environment variable value with type conversion
 *
 * @param envVar - Environment variable name
 * @param configPath - Config path for type inference
 * @returns The converted value or undefined if not set
 */
export function getEnvValue(
  envVar: string,
  configPath?: string,
): unknown | undefined {
  const envValue = process.env[envVar]
  if (envValue === undefined) {
    return undefined
  }
  return convertEnvValue(envValue, configPath || envVar)
}

/**
 * Check if any BillClaw-related environment variables are set
 *
 * Useful for determining if env var overrides are active.
 */
export function hasEnvOverrides(): boolean {
  for (const envVar of Object.keys(ENV_MAPPINGS)) {
    if (process.env[envVar] !== undefined) {
      return true
    }
  }
  return false
}

/**
 * Get all environment variable mappings
 *
 * Returns the mapping of env var names to config paths.
 */
export function getEnvMappings(): Record<string, string> {
  return { ...ENV_MAPPINGS }
}
