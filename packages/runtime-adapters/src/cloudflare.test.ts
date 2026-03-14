/**
 * Tests for Cloudflare Workers Runtime Adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CloudflareKVStore, CloudflareCryptoAdapter, ConsoleLogger, createCloudflareAdapter } from './cloudflare.js'

// Mock KVNamespace
const createMockKV = () => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
})

describe('CloudflareKVStore', () => {
  let mockKV: ReturnType<typeof createMockKV>
  let store: CloudflareKVStore

  beforeEach(() => {
    mockKV = createMockKV()
    store = new CloudflareKVStore(mockKV as unknown as KVNamespace)
  })

  describe('get', () => {
    it('should return parsed JSON value', async () => {
      const testData = { foo: 'bar' }
      mockKV.get.mockResolvedValue(testData)

      const result = await store.get<{ foo: string }>('test-key')

      expect(mockKV.get).toHaveBeenCalledWith('test-key', 'json')
      expect(result).toEqual(testData)
    })

    it('should return null for missing key', async () => {
      mockKV.get.mockResolvedValue(null)

      const result = await store.get('missing-key')

      expect(result).toBeNull()
    })
  })

  describe('set', () => {
    it('should store value as JSON', async () => {
      const testData = { foo: 'bar' }

      await store.set('test-key', testData)

      expect(mockKV.put).toHaveBeenCalledWith('test-key', JSON.stringify(testData), undefined)
    })

    it('should convert TTL ms to seconds for expirationTtl', async () => {
      const testData = { foo: 'bar' }
      const ttlMs = 60000 // 60 seconds

      await store.set('test-key', testData, { ttl: ttlMs })

      expect(mockKV.put).toHaveBeenCalledWith('test-key', JSON.stringify(testData), {
        expirationTtl: 60, // converted to seconds
      })
    })

    it('should handle TTL of 0', async () => {
      const testData = { foo: 'bar' }

      await store.set('test-key', testData, { ttl: 0 })

      // TTL of 0 should be converted to 0 seconds
      expect(mockKV.put).toHaveBeenCalledWith('test-key', JSON.stringify(testData), {
        expirationTtl: 0,
      })
    })
  })

  describe('delete', () => {
    it('should return true when key existed', async () => {
      mockKV.get.mockResolvedValue('exists')

      const result = await store.delete('existing-key')

      expect(mockKV.delete).toHaveBeenCalledWith('existing-key')
      expect(result).toBe(true)
    })

    it('should return false when key did not exist', async () => {
      mockKV.get.mockResolvedValue(null)

      const result = await store.delete('missing-key')

      expect(mockKV.delete).toHaveBeenCalledWith('missing-key')
      expect(result).toBe(false)
    })
  })
})

describe('CloudflareCryptoAdapter', () => {
  let crypto: CloudflareCryptoAdapter

  beforeEach(() => {
    crypto = new CloudflareCryptoAdapter()
  })

  describe('hmacSha256', () => {
    it('should produce consistent HMAC signature', async () => {
      const data = 'test-payload'
      const secret = 'test-secret'

      const signature = await crypto.hmacSha256(data, secret)

      // Same input should produce same output
      const signature2 = await crypto.hmacSha256(data, secret)
      expect(signature).toBe(signature2)
    })

    it('should produce different signatures for different secrets', async () => {
      const data = 'test-payload'

      const sig1 = await crypto.hmacSha256(data, 'secret1')
      const sig2 = await crypto.hmacSha256(data, 'secret2')

      expect(sig1).not.toBe(sig2)
    })

    it('should return base64 encoded string', async () => {
      const signature = await crypto.hmacSha256('data', 'secret')

      // Base64 strings contain only these characters
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

describe('createCloudflareAdapter', () => {
  it('should create adapter with KV namespace', () => {
    const mockKV = createMockKV()
    const env = { KV: mockKV as unknown as KVNamespace }

    const adapter = createCloudflareAdapter(env)

    expect(adapter.platform).toBe('cloudflare')
    expect(adapter.kv).toBeInstanceOf(CloudflareKVStore)
    expect(adapter.logger).toBeInstanceOf(ConsoleLogger)
    expect(adapter.crypto).toBeInstanceOf(CloudflareCryptoAdapter)
  })

  it('should throw if KV namespace not found', () => {
    const env = {}

    expect(() => createCloudflareAdapter(env)).toThrow(
      "KV namespace 'KV' not found in environment bindings"
    )
  })

  it('should support custom KV namespace name', () => {
    const mockKV = createMockKV()
    const env = { CUSTOM_KV: mockKV as unknown as KVNamespace }

    const adapter = createCloudflareAdapter(env, 'CUSTOM_KV')

    expect(adapter.kv).toBeInstanceOf(CloudflareKVStore)
  })
})
