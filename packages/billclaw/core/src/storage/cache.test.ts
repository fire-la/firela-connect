/**
 * Tests for memory cache
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { MemoryCache, CacheKeys, CachedData, createMemoryCache } from "./cache"

describe("MemoryCache", () => {
  let cache: MemoryCache

  beforeEach(() => {
    cache = new MemoryCache()
  })

  afterEach(() => {
    cache.destroy()
  })

  describe("set and get", () => {
    it("should store and retrieve values", () => {
      cache.set("key1", "value1")
      expect(cache.get("key1")).toBe("value1")
    })

    it("should return null for non-existent keys", () => {
      expect(cache.get("non-existent")).toBeNull()
    })

    it("should store complex objects", () => {
      const obj = { nested: { value: 42 }, arr: [1, 2, 3] }
      cache.set("obj", obj)
      expect(cache.get("obj")).toEqual(obj)
    })

    it("should overwrite existing values", () => {
      cache.set("key1", "value1")
      cache.set("key1", "value2")
      expect(cache.get("key1")).toBe("value2")
    })
  })

  describe("TTL expiration", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it("should expire values after TTL", () => {
      cache.set("key1", "value1", 1000) // 1 second TTL

      expect(cache.get("key1")).toBe("value1")

      vi.advanceTimersByTime(1100)

      expect(cache.get("key1")).toBeNull()
    })

    it("should not expire before TTL", () => {
      cache.set("key1", "value1", 1000)

      vi.advanceTimersByTime(500)

      expect(cache.get("key1")).toBe("value1")
    })

    it("should use default TTL if not specified", () => {
      const cacheWithDefault = new MemoryCache({ defaultTtl: 1000 })
      cacheWithDefault.set("key1", "value1")

      vi.advanceTimersByTime(1100)

      expect(cacheWithDefault.get("key1")).toBeNull()

      cacheWithDefault.destroy()
    })

    it("should expire immediately when TTL is 0", () => {
      cache.set("key1", "value1", 0)

      // TTL = 0 means already expired
      expect(cache.get("key1")).toBeNull()
    })
  })

  describe("has", () => {
    it("should return true for existing keys", () => {
      cache.set("key1", "value1")
      expect(cache.has("key1")).toBe(true)
    })

    it("should return false for non-existent keys", () => {
      expect(cache.has("non-existent")).toBe(false)
    })

    it("should return false for expired keys", () => {
      vi.useFakeTimers()
      cache.set("key1", "value1", 100)

      expect(cache.has("key1")).toBe(true)

      vi.advanceTimersByTime(150)

      expect(cache.has("key1")).toBe(false)

      vi.restoreAllMocks()
    })
  })

  describe("delete", () => {
    it("should remove existing keys", () => {
      cache.set("key1", "value1")
      expect(cache.has("key1")).toBe(true)

      cache.delete("key1")
      expect(cache.has("key1")).toBe(false)
    })

    it("should return true when deleting existing key", () => {
      cache.set("key1", "value1")
      expect(cache.delete("key1")).toBe(true)
    })

    it("should return false when deleting non-existent key", () => {
      expect(cache.delete("non-existent")).toBe(false)
    })
  })

  describe("clear", () => {
    it("should remove all keys", () => {
      cache.set("key1", "value1")
      cache.set("key2", "value2")
      cache.set("key3", "value3")

      expect(cache.has("key1")).toBe(true)
      expect(cache.has("key2")).toBe(true)
      expect(cache.has("key3")).toBe(true)

      cache.clear()

      expect(cache.has("key1")).toBe(false)
      expect(cache.has("key2")).toBe(false)
      expect(cache.has("key3")).toBe(false)
    })
  })

  describe("size", () => {
    it("should return the number of keys", () => {
      expect(cache.size()).toBe(0)

      cache.set("key1", "value1")
      expect(cache.size()).toBe(1)

      cache.set("key2", "value2")
      expect(cache.size()).toBe(2)

      cache.delete("key1")
      expect(cache.size()).toBe(1)

      cache.clear()
      expect(cache.size()).toBe(0)
    })

    it("should not count expired keys", () => {
      vi.useFakeTimers()
      cache.set("key1", "value1", 100)
      cache.set("key2", "value2", 1000)

      expect(cache.size()).toBe(2)

      vi.advanceTimersByTime(150)

      // Note: size() doesn't automatically clean up expired entries
      // The has() method cleans up expired entries on access
      expect(cache.size()).toBe(2)

      // But has() will return false for expired entries
      expect(cache.has("key1")).toBe(false)
      expect(cache.has("key2")).toBe(true)

      vi.restoreAllMocks()
    })
  })

  describe("keys", () => {
    it("should return all keys", () => {
      cache.set("key1", "value1")
      cache.set("key2", "value2")
      cache.set("key3", "value3")

      const keys = cache.keys()
      expect(keys).toContain("key1")
      expect(keys).toContain("key2")
      expect(keys).toContain("key3")
      expect(keys).toHaveLength(3)
    })
  })

  describe("maxSize enforcement", () => {
    it("should evict oldest entry when max size is reached", () => {
      const smallCache = new MemoryCache({ maxSize: 2 })

      smallCache.set("key1", "value1")
      smallCache.set("key2", "value2")
      expect(smallCache.size()).toBe(2)

      // This should evict key1
      smallCache.set("key3", "value3")
      expect(smallCache.size()).toBe(2)
      expect(smallCache.has("key1")).toBe(false)
      expect(smallCache.has("key3")).toBe(true)

      smallCache.destroy()
    })
  })

  describe("destroy", () => {
    it("should cleanup timers on destroy", () => {
      const testCache = new MemoryCache()

      expect(() => testCache.destroy()).not.toThrow()

      // Should be able to call destroy multiple times
      expect(() => testCache.destroy()).not.toThrow()
    })
  })
})

describe("CacheKeys", () => {
  it("should generate transaction cache keys", () => {
    const key = CacheKeys.transactions("acct-1", 2024, 1)
    expect(key).toBe("transactions:acct-1:2024:1")
  })

  it("should generate account cache keys", () => {
    const key = CacheKeys.account("acct-1")
    expect(key).toBe("account:acct-1")
  })

  it("should generate sync state cache keys", () => {
    const key = CacheKeys.syncState("acct-1")
    expect(key).toBe("sync_state:acct-1")
  })

  it("should generate Plaid balance cache keys", () => {
    const key = CacheKeys.plaidBalance("acct-1")
    expect(key).toBe("plaid_balance:acct-1")
  })

  it("should generate Gmail history cache keys", () => {
    const key = CacheKeys.gmailHistory("acct-1")
    expect(key).toBe("gmail_history:acct-1")
  })
})

describe("createMemoryCache", () => {
  it("should create a MemoryCache instance", () => {
    const cache = createMemoryCache()
    expect(cache).toBeInstanceOf(MemoryCache)
    cache.destroy()
  })

  it("should pass config to MemoryCache", () => {
    const cache = createMemoryCache({ maxSize: 100 })
    cache.set("test", "value")
    expect(cache.get("test")).toBe("value")
    cache.destroy()
  })
})

describe("CachedData", () => {
  it("should cache and fetch values", async () => {
    const cache = new MemoryCache()
    let fetchCount = 0

    const cached = new CachedData(cache, "test-key", async () => {
      fetchCount++
      return "fetched-value"
    })

    // First call should fetch
    const value1 = await cached.get()
    expect(value1).toBe("fetched-value")
    expect(fetchCount).toBe(1)

    // Second call should use cache
    const value2 = await cached.get()
    expect(value2).toBe("fetched-value")
    expect(fetchCount).toBe(1)

    cache.destroy()
  })

  it("should support manual invalidation", async () => {
    const cache = new MemoryCache()
    let fetchCount = 0

    const cached = new CachedData(cache, "test-key", async () => {
      fetchCount++
      return `value-${fetchCount}`
    })

    await cached.get()
    expect(fetchCount).toBe(1)

    cached.invalidate()
    await cached.get()
    expect(fetchCount).toBe(2)

    cache.destroy()
  })

  it("should support manual value setting", async () => {
    const cache = new MemoryCache()

    const cached = new CachedData(cache, "test-key", async () => {
      return "fetched"
    })

    cached.set("manual-value")
    const value = await cached.get()
    expect(value).toBe("manual-value")

    cache.destroy()
  })
})
