/**
 * @firela/runtime-adapters - Platform-agnostic runtime abstraction
 *
 * This package provides interfaces and implementations for abstracting
 * platform-specific capabilities across different runtime environments.
 *
 * ## Available Adapters
 *
 * - **Cloudflare Workers**: `import { createCloudflareAdapter } from '@firela/runtime-adapters/cloudflare'`
 * - **Node.js**: `import { createNodeAdapter } from '@firela/runtime-adapters/node'`
 *
 * ## Usage
 *
 * ```typescript
 * // For Cloudflare Workers
 * import { createCloudflareAdapter } from '@firela/runtime-adapters/cloudflare'
 *
 * export default {
 *   async fetch(request, env) {
 *     const adapter = createCloudflareAdapter(env)
 *     await adapter.kv.set('key', 'value')
 *     return new Response('OK')
 *   }
 * }
 *
 * // For Node.js
 * import { createNodeAdapter } from '@firela/runtime-adapters/node'
 *
 * const adapter = createNodeAdapter()
 * await adapter.kv.set('key', 'value')
 * ```
 */

// Export all types
export type { KVStore, CryptoAdapter, Logger, RuntimeAdapter } from './types.js'

// Re-export adapters for convenience (sub-path exports recommended)
export { createCloudflareAdapter, CloudflareKVStore, CloudflareCryptoAdapter, ConsoleLogger as CloudflareConsoleLogger } from './cloudflare.js'
export { createNodeAdapter, MemoryKVStore, NodeCryptoAdapter, ConsoleLogger } from './node.js'
