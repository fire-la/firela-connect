# @firela/runtime-adapters

Platform-agnostic runtime adapters for Cloudflare Workers, Node.js, and edge runtimes.

## Overview

This package provides a unified abstraction layer for runtime-specific capabilities, allowing your code to run seamlessly across different JavaScript environments:

- **Cloudflare Workers** - KV storage, Web Crypto API
- **Node.js** - File-based storage, Node crypto module
- **Edge runtimes** - Any environment implementing the adapter interfaces

## Installation

```bash
npm install @firela/runtime-adapters
# or
pnpm add @firela/runtime-adapters
```

## Quick Start

### Cloudflare Workers

```typescript
import { createCloudflareAdapter } from '@firela/runtime-adapters/cloudflare'

export default {
  async fetch(request, env, ctx) {
    const adapter = createCloudflareAdapter(env)

    // Use KV store
    await adapter.kv.set('session:abc', { userId: 'user1' }, { ttl: 3600000 })

    // Use crypto
    const signature = await adapter.crypto.hmacSha256('payload', 'secret')

    // Log messages
    adapter.logger.info('Request processed')

    return new Response('OK')
  }
}
```

### Node.js

```typescript
import { createNodeAdapter } from '@firela/runtime-adapters/node'

const adapter = createNodeAdapter()

// Use in-memory KV store (useful for development/testing)
await adapter.kv.set('key', 'value')

// Use Node.js crypto
const bytes = adapter.crypto.randomBytes(16)

// Console logging
adapter.logger.info('Application started')
```

## API Reference

### Types

```typescript
interface KVStore {
  get<T = unknown>(key: string): Promise<T | null>
  set<T>(key: string, value: T, options?: { ttl?: number }): Promise<void>
  delete(key: string): Promise<boolean>
}

interface CryptoAdapter {
  hmacSha256(data: string, secret: string): Promise<string>
  randomBytes(length: number): Uint8Array
}

interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

interface RuntimeAdapter {
  kv: KVStore
  crypto: CryptoAdapter
  logger: Logger
  platform: string
}
```

### Cloudflare Adapter

```typescript
import { createCloudflareAdapter } from '@firela/runtime-adapters/cloudflare'

const adapter = createCloudflareAdapter(env, 'KV') // 'KV' is the default namespace
```

**Features:**
- `CloudflareKVStore` - Wraps KVNamespace for key-value storage
- `CloudflareCryptoAdapter` - Uses Web Crypto API
- `ConsoleLogger` - Console-based logging

### Node.js Adapter

```typescript
import { createNodeAdapter } from '@firela/runtime-adapters/node'

const adapter = createNodeAdapter()
```

**Features:**
- `MemoryKVStore` - In-memory key-value storage (useful for development)
- `NodeCryptoAdapter` - Uses Node.js crypto module
- `ConsoleLogger` - Console-based logging

## Usage Examples

### Rate Limiting with KV Storage

```typescript
import { createCloudflareAdapter } from '@firela/runtime-adapters/cloudflare'

const adapter = createCloudflareAdapter(env)

async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const count = await adapter.kv.get<number>(key) || 0

  if (count >= limit) {
    return false
  }

  await adapter.kv.set(key, count + 1, { ttl: windowMs })
  return true
}
```

### HMAC Signature Verification

```typescript
import { createCloudflareAdapter } from '@firela/runtime-adapters/cloudflare'

const adapter = createCloudflareAdapter(env)

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await adapter.crypto.hmacSha256(payload, secret)
  return expected === signature
}
```

## License

AGPL-3.0
