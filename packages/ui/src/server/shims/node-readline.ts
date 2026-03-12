/**
 * Shim for node:readline module in Cloudflare Workers
 *
 * This module is not available in Workers. Provides stubs that throw helpful errors.
 */

const notAvailable = () => {
  throw new Error(
    "node:readline is not available in Cloudflare Workers. " +
    "Use Web Streams API for line-by-line processing."
  )
}

export const createInterface = notAvailable
export const createInterfacePromise = notAvailable
export const clearLine = notAvailable
export const clearScreenDown = notAvailable
export const cursorTo = notAvailable
export const moveCursor = notAvailable

export default {
  createInterface,
  clearLine,
  clearScreenDown,
  cursorTo,
  moveCursor,
}
