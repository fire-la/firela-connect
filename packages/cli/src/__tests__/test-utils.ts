/**
 * Test utilities and factory functions for CLI tests
 *
 * This module provides reusable mock factories and test utilities
 * following the patterns from TESTING.md.
 */

import { vi } from "vitest"
import type { CliContext } from "../commands/registry.js"
import type { BillclawConfig, AccountConfig, StorageConfig, Logger, ConfigProvider } from "@firela/billclaw-core"
import { MockLogger, MockConfigProvider } from "./mocks/runtime.js"
import { Command } from "commander"

/**
 * Create a mock logger for testing
 */
export function createMockLogger(): Logger {
  return new MockLogger()
}

/**
 * Create a mock config provider for testing
 */
export function createMockConfigProvider(
  initialConfig?: Partial<BillclawConfig>,
): ConfigProvider {
  return new MockConfigProvider(initialConfig)
}

/**
 * Create a mock CliContext for testing
 *
 * Note: This creates a minimal mock context suitable for unit testing.
 * The runtime.logger is a MockLogger (implements Logger interface),
 * and runtime.config is a MockConfigProvider (implements ConfigProvider).
 */
export function createMockCliContext(
  configOverrides?: Partial<BillclawConfig>,
): CliContext {
  const logger = new MockLogger()
  const config = new MockConfigProvider(configOverrides)
  return {
    runtime: {
    logger,
    config,
  } as any,
    program: new Command(),
  }
}

/**
 * Create a mock BillclawConfig for testing
 */
export function createMockConfig(
  overrides?: Partial<BillclawConfig>,
): BillclawConfig {
  return {
    version: 1,
    accounts: [],
    webhooks: [],
    storage: {
      path: "~/.firela/billclaw",
      format: "json",
      encryption: { enabled: false },
    },
    sync: {
      defaultFrequency: "daily",
      retryOnFailure: true,
      maxRetries: 3,
    },
    plaid: {
      environment: "sandbox",
    },
    connect: {
      port: 4456,
      host: "localhost",
    },
    export: {
      format: "beancount",
      outputPath: "~/.firela/billclaw/exports",
      filePrefix: "transactions",
      includePending: false,
      currencyColumn: true,
    },
    ...overrides,
  }
}

/**
 * Create a mock AccountConfig for testing
 */
export function createMockAccount(
  overrides?: Partial<AccountConfig>,
): AccountConfig {
  return {
    id: `test-account-${Date.now()}`,
    type: "plaid",
    name: "Test Account",
    enabled: true,
    syncFrequency: "daily",
    ...overrides,
  }
}

/**
 * Create a mock StorageConfig for testing
 */
export function createMockStorageConfig(
  overrides?: Partial<StorageConfig>,
): StorageConfig {
  return {
    path: "~/.firela/billclaw",
    format: "json",
    encryption: { enabled: false },
    ...overrides,
  }
}

/**
 * Create a mock sync result
 */
export function createMockSyncResult(overrides?: {
  transactionsAdded?: number
  transactionsUpdated?: number
  errors?: Array<{ type: "UserError"; errorCode: string; humanReadable: { title: string; message: string; suggestions: string[] } }>
  accountId?: string
}) {
  return {
    accountId: overrides?.accountId ?? `test-account-${Date.now()}`,
    transactionsAdded: overrides?.transactionsAdded ?? 0,
    transactionsUpdated: overrides?.transactionsUpdated ?? 0,
    errors: overrides?.errors ?? [],
  }
}

/**
 * Mock console methods and capture output
 */
export function mockConsole() {
  const output: string[] = []
  const originalLog = console.log
  const originalError = console.error
  const originalWarn = console.warn

  console.log = (...args: unknown[]) => {
    output.push(args.join(" "))
  }
  console.error = (...args: unknown[]) => {
    output.push(args.join(" "))
  }
  console.warn = (...args: unknown[]) => {
    output.push(args.join(" "))
  }

  return {
    output,
    restore: () => {
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
    },
  }
}

/**
 * Create mock inquirer prompt function
 */
export function createMockPrompt<T extends Record<string, unknown>>(
  answers: T,
) {
  return vi.fn().mockResolvedValue(answers)
}

/**
 * Re-export mock classes for convenience
 */
export { MockLogger, MockConfigProvider } from "./mocks/runtime.js"
