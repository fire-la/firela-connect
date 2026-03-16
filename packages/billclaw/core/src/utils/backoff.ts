/**
 * Full Jitter backoff algorithm
 *
 * Implements AWS-recommended Full Jitter for exponential backoff.
 * Full Jitter: sleep = random(0, min(cap, base * 2 ** attempt))
 *
 * @packageDocumentation
 */

/**
 * Calculate backoff delay using Full Jitter algorithm
 *
 * The Full Jitter algorithm spreads reconnection attempts evenly,
 * reducing server load by 50%+ compared to no-jitter approaches.
 * It prevents thundering herd when multiple clients disconnect simultaneously.
 *
 * @param baseDelay - Initial delay in milliseconds
 * @param maxDelay - Maximum delay cap in milliseconds
 * @param attempt - Current reconnection attempt number (0-indexed)
 * @returns Random delay between 0 and the capped exponential value
 *
 * @example
 * ```typescript
 * // First attempt: returns value between 0 and 1000ms
 * const delay1 = calculateBackoffDelay(1000, 30000, 0)
 *
 * // Third attempt: returns value between 0 and 4000ms (1000 * 2^2)
 * const delay3 = calculateBackoffDelay(1000, 30000, 2)
 *
 * // High attempt: capped at maxDelay
 * const delay10 = calculateBackoffDelay(1000, 30000, 10)
 * ```
 */
export function calculateBackoffDelay(
  baseDelay: number,
  maxDelay: number,
  attempt: number,
): number {
  // Calculate exponential delay: base * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt)

  // Cap at maximum delay
  const cappedDelay = Math.min(maxDelay, exponentialDelay)

  // Full Jitter: random value between 0 and capped delay
  return Math.random() * cappedDelay
}
