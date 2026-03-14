/**
 * Deep merge utility for configuration objects
 *
 * Recursively merges source object into base object.
 * Source values take precedence over base values.
 * Arrays are not merged - they are replaced entirely.
 *
 * @packageDocumentation
 */

/**
 * Deep merge two objects recursively
 *
 * @param base - The base object to merge into
 * @param source - The source object with updates
 * @returns A new object with merged values
 *
 * @example
 * ```typescript
 * const base = { a: 1, b: { c: 2 } }
 * const source = { b: { d: 3 } }
 * const result = deepMerge(base, source)
 * // result = { a: 1, b: { c: 2, d: 3 } }
 * ```
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  source: Partial<T>,
): T {
  const result = { ...base } as T

  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key]
    const baseValue = result[key]

    if (
      sourceValue !== null &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      key in result &&
      baseValue !== null &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      // Recursively merge nested objects
      result[key] = deepMerge(
        baseValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      ) as T[keyof T]
    } else {
      // Override with source value (including null, arrays, primitives)
      result[key] = sourceValue as T[keyof T]
    }
  }

  return result
}
