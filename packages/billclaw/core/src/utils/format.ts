/**
 * Format user code for display (XXXX-XXXX)
 *
 * Google OAuth user codes are 8 characters, formatted with a dash
 * in the middle for readability.
 *
 * @param code - The user code to format
 * @returns Formatted code (e.g., "ABCD-EFGH") or original if not 8 chars
 */
export function formatUserCode(code: string): string {
  if (code.length === 8) {
    return `${code.slice(0, 4)}-${code.slice(4)}`
  }
  return code
}
