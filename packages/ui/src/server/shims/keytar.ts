/**
 * Keytar shim for Cloudflare Workers
 *
 * The keytar module is a Node.js native module that doesn't work in Workers.
 * This shim provides stub implementations that throw errors if called.
 * In Workers, credentials should be stored in KV or D1 instead.
 *
 * @module shims/keytar
 */

/**
 * Set a password in the keychain (not supported in Workers)
 *
 * @throws Error explaining Workers incompatibility
 */
export async function setPassword(
  _service: string,
  _account: string,
  _password: string,
): Promise<void> {
  throw new Error(
    "keytar is not available in Cloudflare Workers. Use KV or D1 for credential storage.",
  )
}

/**
 * Get a password from the keychain (not supported in Workers)
 *
 * @throws Error explaining Workers incompatibility
 */
export async function getPassword(
  _service: string,
  _account: string,
): Promise<string | null> {
  throw new Error(
    "keytar is not available in Cloudflare Workers. Use KV or D1 for credential storage.",
  )
}

/**
 * Delete a password from the keychain (not supported in Workers)
 *
 * @throws Error explaining Workers incompatibility
 */
export async function deletePassword(
  _service: string,
  _account: string,
): Promise<boolean> {
  throw new Error(
    "keytar is not available in Cloudflare Workers. Use KV or D1 for credential storage.",
  )
}

/**
 * Find credentials in the keychain (not supported in Workers)
 *
 * @throws Error explaining Workers incompatibility
 */
export async function findCredentials(
  _service: string,
): Promise<Array<{ account: string; password: string }>> {
  throw new Error(
    "keytar is not available in Cloudflare Workers. Use KV or D1 for credential storage.",
  )
}

/**
 * Find a password in the keychain (not supported in Workers)
 *
 * @throws Error explaining Workers incompatibility
 */
export async function findPassword(_service: string): Promise<string | null> {
  throw new Error(
    "keytar is not available in Cloudflare Workers. Use KV or D1 for credential storage.",
  )
}

// Default export for compatibility
export default {
  setPassword,
  getPassword,
  deletePassword,
  findCredentials,
  findPassword,
}
