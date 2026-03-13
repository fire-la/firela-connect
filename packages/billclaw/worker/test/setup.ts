/**
 * Test helper file for Worker package
 *
 * This file provides common test utilities and helpers for testing
 * the Worker in the actual Workers runtime using vitest-pool-workers.
 */

import { env, SELF } from "cloudflare:test"
import type { Env } from "../src/types/env"

/**
 * Test helper to get the Worker environment
 */
export function getTestEnv(): Env {
  return env as Env
}

/**
 * Wait for Worker to be ready (warm up cold start)
 */
export async function warmUp(): Promise<void> {
  // Make a simple request to warm up the worker
  await SELF.fetch("http://localhost/health")
}
