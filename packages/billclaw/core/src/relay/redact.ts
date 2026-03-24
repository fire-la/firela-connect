/**
 * Token redaction utilities for security
 *
 * Ensures sensitive tokens are never logged or exposed in output.
 * Redacts common token field names while preserving prefix for debugging.
 *
 * @packageDocumentation
 */

/**
 * Sensitive key patterns to redact from logs
 * Uses lowercase matching for case-insensitive detection
 */
const SENSITIVE_PATTERNS = [
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "api_key",
  "apikey",
  "secret",
  "password",
  "token",
  "authorization",
]

/**
 * Default number of characters to show before redaction
 */
const DEFAULT_VISIBLE_CHARS = 4

/**
 * Redact sensitive fields from an object before logging
 *
 * Recursively traverses objects and arrays, replacing sensitive
 * string values with a redacted version showing only the prefix.
 *
 * @param obj - Object to redact (original is not modified)
 * @param visibleChars - Number of characters to show before redaction
 * @returns Deep copy with sensitive values redacted
 *
 * @example
 * ```typescript
 * const data = { access_token: 'sk_live_secret123', name: 'test' };
 * const safe = redactSensitive(data);
 * // { access_token: 'sk_l***REDACTED***', name: 'test' }
 *
 * logger.debug('Request:', safe);
 * ```
 */
export function redactSensitive<T>(
  obj: T,
  visibleChars: number = DEFAULT_VISIBLE_CHARS,
): T {
  // Handle primitives and null/undefined
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj !== "object") {
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitive(item, visibleChars)) as T
  }

  // Handle objects
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = SENSITIVE_PATTERNS.some((pattern) =>
      lowerKey.includes(pattern),
    )

    if (isSensitive && typeof value === "string") {
      // Redact string values for sensitive keys
      result[key] =
        value.length > visibleChars
          ? `${value.slice(0, visibleChars)}***REDACTED***`
          : "***REDACTED***"
    } else if (typeof value === "object" && value !== null) {
      // Recurse into nested objects
      result[key] = redactSensitive(value, visibleChars)
    } else {
      // Keep non-sensitive values as-is
      result[key] = value
    }
  }

  return result as T
}

/**
 * Check if a string looks like a sensitive token
 *
 * @param value - String to check
 * @returns true if the string matches common token patterns
 */
export function isSensitiveValue(value: string): boolean {
  const lowerValue = value.toLowerCase()
  return SENSITIVE_PATTERNS.some((pattern) => lowerValue.includes(pattern))
}
