/**
 * Tests for Full Jitter backoff algorithm
 */

import { describe, it, expect } from "vitest"
import { calculateBackoffDelay } from "./backoff.js"

describe("Full Jitter backoff algorithm", () => {
  describe("calculateBackoffDelay", () => {
    const baseDelay = 1000
    const maxDelay = 30000

    it("should return delay between 0 and baseDelay on first attempt", () => {
      for (let i = 0; i < 100; i++) {
        const delay = calculateBackoffDelay(baseDelay, maxDelay, 0)
        expect(delay).toBeGreaterThanOrEqual(0)
        expect(delay).toBeLessThanOrEqual(baseDelay)
      }
    })

    it("should exponentially increase delay cap with subsequent attempts", () => {
      // Attempt 0: cap = 1000
      // Attempt 1: cap = 2000
      // Attempt 2: cap = 4000
      // Attempt 3: cap = 8000
      // etc.

      const caps = [1000, 2000, 4000, 8000, 16000, 30000, 30000]

      for (let attempt = 0; attempt < caps.length; attempt++) {
        const expectedCap = caps[attempt]
        let maxObserved = 0

        // Sample multiple times to find approximate max
        for (let i = 0; i < 1000; i++) {
          const delay = calculateBackoffDelay(baseDelay, maxDelay, attempt)
          maxObserved = Math.max(maxObserved, delay)
        }

        // Max observed should be close to the cap (within 5% due to randomness)
        expect(maxObserved).toBeGreaterThan(expectedCap * 0.9)
        expect(maxObserved).toBeLessThanOrEqual(expectedCap)
      }
    })

    it("should cap delay at maxDelay", () => {
      // With high attempt count, exponential would exceed maxDelay
      for (let i = 0; i < 100; i++) {
        const delay = calculateBackoffDelay(baseDelay, maxDelay, 100)
        expect(delay).toBeGreaterThanOrEqual(0)
        expect(delay).toBeLessThanOrEqual(maxDelay)
      }
    })

    it("should return different values on repeated calls (jitter effect)", () => {
      const delays = new Set<number>()

      for (let i = 0; i < 100; i++) {
        delays.add(Math.round(calculateBackoffDelay(baseDelay, maxDelay, 2)))
      }

      // With jitter, we should see many different values
      expect(delays.size).toBeGreaterThan(50)
    })

    it("should handle edge case: attempt 0", () => {
      const delay = calculateBackoffDelay(baseDelay, maxDelay, 0)
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(baseDelay)
    })

    it("should handle edge case: baseDelay equals maxDelay", () => {
      const delay = calculateBackoffDelay(5000, 5000, 5)
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(5000)
    })

    it("should never return negative values", () => {
      for (let attempt = 0; attempt < 20; attempt++) {
        for (let i = 0; i < 100; i++) {
          const delay = calculateBackoffDelay(baseDelay, maxDelay, attempt)
          expect(delay).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })
})
