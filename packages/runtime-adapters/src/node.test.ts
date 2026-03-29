/**
 * Tests for Node.js Runtime Adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryKVStore, NodeCryptoAdapter, ConsoleLogger, createNodeAdapter } from './node.js'

describe('MemoryKVStore', () => {
  let store: MemoryKVStore

  beforeEach(() => {
    store = new MemoryKVStore()
  })

  describe('get', () => {
    it('should return stored value', async () => {
      await store.set('key', { foo: 'bar' })

      const result = await store.get<{ foo: string }>('key')

      expect(result).toEqual({ foo: 'bar' })
    })

    it('should return null for missing key', async () => {
      const result = await store.get('missing-key')

      expect(result).toBeNull()
    })

    it('should return null for expired TTL entry', async () => {
      await store.set('key', 'value', { ttl: 1 })

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 10))

      const result = await store.get('key')

      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('should store value', async () => {
      await store.set('key', 'value')

      const result = await store.get('key')

      expect(result).toBe('value')
    })

    it('should apply TTL in milliseconds', async () => {
      await store.set('key', 'value', { ttl: 5000 })

      const result = await store.get('key')

      expect(result).toBe('value')
    })
  })

  describe('delete', () => {
    it('should return true when key existed', async () => {
      await store.set('key', 'value')

      const result = await store.delete('key')

      expect(result).toBe(true)
      expect(await store.get('key')).toBeNull()
    })

    it('should return false when key did not exist', async () => {
      const result = await store.delete('missing-key')

      expect(result).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear all entries', async () => {
      await store.set('key1', 'value1')
      await store.set('key2', 'value2')

      store.clear()

      expect(store.size).toBe(0)
      expect(await store.get('key1')).toBeNull()
    })
  })

  describe('size', () => {
    it('should return number of entries', async () => {
      expect(store.size).toBe(0)

      await store.set('key1', 'value1')
      await store.set('key2', 'value2')

      expect(store.size).toBe(2)
    })
  })
})

describe('NodeCryptoAdapter', () => {
  let crypto: NodeCryptoAdapter

  beforeEach(() => {
    crypto = new NodeCryptoAdapter()
  })

  describe('hmacSha256', () => {
    it('should produce consistent HMAC signature', async () => {
      const signature = await crypto.hmacSha256('test-payload', 'test-secret')
      const signature2 = await crypto.hmacSha256('test-payload', 'test-secret')

      expect(signature).toBe(signature2)
    })

    it('should produce different signatures for different secrets', async () => {
      const sig1 = await crypto.hmacSha256('data', 'secret1')
      const sig2 = await crypto.hmacSha256('data', 'secret2')

      expect(sig1).not.toBe(sig2)
    })

    it('should return base64 encoded string', async () => {
      const signature = await crypto.hmacSha256('data', 'secret')

      expect(signature).toMatch(/^[A-Za-z0-9+/]+=*$/)
    })
  })

  describe('randomBytes', () => {
    it('should return bytes of requested length', () => {
      const bytes = crypto.randomBytes(16)

      expect(bytes).toBeInstanceOf(Uint8Array)
      expect(bytes.length).toBe(16)
    })

    it('should produce different values on each call', () => {
      const bytes1 = crypto.randomBytes(16)
      const bytes2 = crypto.randomBytes(16)

      expect(bytes1).not.toEqual(bytes2)
    })
  })
})

describe('ConsoleLogger', () => {
  let logger: ConsoleLogger

  beforeEach(() => {
    logger = new ConsoleLogger()
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should call console.debug', () => {
    logger.debug('test message', 'arg1')
    expect(console.debug).toHaveBeenCalledWith('test message', 'arg1')
  })

  it('should call console.info', () => {
    logger.info('test message', 'arg1')
    expect(console.info).toHaveBeenCalledWith('test message', 'arg1')
  })

  it('should call console.warn', () => {
    logger.warn('test message', 'arg1')
    expect(console.warn).toHaveBeenCalledWith('test message', 'arg1')
  })

  it('should call console.error', () => {
    logger.error('test message', 'arg1')
    expect(console.error).toHaveBeenCalledWith('test message', 'arg1')
  })
})

describe('createNodeAdapter', () => {
  it('should create adapter with defaults', () => {
    const adapter = createNodeAdapter()

    expect(adapter.platform).toBe('node')
    expect(adapter.kv).toBeInstanceOf(MemoryKVStore)
    expect(adapter.logger).toBeInstanceOf(ConsoleLogger)
    expect(adapter.crypto).toBeInstanceOf(NodeCryptoAdapter)
  })

  it('should accept custom kv and logger', () => {
    const customKV = new MemoryKVStore()
    const customLogger = new ConsoleLogger()

    const adapter = createNodeAdapter({ kv: customKV, logger: customLogger })

    expect(adapter.kv).toBe(customKV)
    expect(adapter.logger).toBe(customLogger)
  })
})
