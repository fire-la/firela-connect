/**
 * Tests for deep merge utility
 */

import { describe, it, expect } from "vitest"
import { deepMerge } from "./merge.js"

describe("deepMerge", () => {
  it("should merge flat objects", () => {
    const base = { a: 1, b: 2 }
    const source = { b: 3, c: 4 }
    const result = deepMerge(base, source)

    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })

  it("should merge nested objects recursively", () => {
    const base = { a: 1, nested: { x: 1, y: 2 } }
    const source = { nested: { y: 3, z: 4 } }
    const result = deepMerge(base, source)

    expect(result).toEqual({ a: 1, nested: { x: 1, y: 3, z: 4 } })
  })

  it("should replace arrays instead of merging", () => {
    const base = { arr: [1, 2, 3] }
    const source = { arr: [4, 5] }
    const result = deepMerge(base, source)

    expect(result).toEqual({ arr: [4, 5] })
  })

  it("should handle null source values", () => {
    const base = { a: 1, b: 2 }
    const source = { b: null }
    const result = deepMerge(base, source)

    expect(result).toEqual({ a: 1, b: null })
  })

  it("should not merge null objects", () => {
    const base = { nested: { x: 1 } }
    const source = { nested: null }
    const result = deepMerge(base, source as any)

    expect(result).toEqual({ nested: null })
  })

  it("should handle deeply nested objects", () => {
    const base = { level1: { level2: { level3: { a: 1 } } } }
    const source = { level1: { level2: { level3: { b: 2 } } } }
    const result = deepMerge(base, source)

    expect(result).toEqual({ level1: { level2: { level3: { a: 1, b: 2 } } } })
  })

  it("should not modify original objects", () => {
    const base = { a: 1, nested: { x: 1 } }
    const source = { nested: { y: 2 } }
    const result = deepMerge(base, source)

    expect(base).toEqual({ a: 1, nested: { x: 1 } })
    expect(source).toEqual({ nested: { y: 2 } })
    expect(result).toEqual({ a: 1, nested: { x: 1, y: 2 } })
  })

  it("should handle empty source", () => {
    const base = { a: 1, b: 2 }
    const source = {}
    const result = deepMerge(base, source)

    expect(result).toEqual({ a: 1, b: 2 })
  })

  it("should handle empty base", () => {
    const base = {}
    const source = { a: 1 }
    const result = deepMerge(base, source as any)

    expect(result).toEqual({ a: 1 })
  })

  it("should handle config-like nested structure", () => {
    const base = {
      connect: { port: 4456, host: "localhost" },
      accounts: [],
    }
    const source = {
      connect: { host: "example.com" },
    }
    const result = deepMerge(base, source)

    expect(result).toEqual({
      connect: { port: 4456, host: "example.com" },
      accounts: [],
    })
  })
})
