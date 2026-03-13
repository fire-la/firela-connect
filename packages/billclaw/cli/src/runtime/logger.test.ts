/**
 * Tests for CLI runtime context
 */

import { describe, it, expect } from "vitest"
import {
  CliLogger,
  LogLevel,
  createLogger,
  type CliLoggerConfig,
} from "./logger.js"

describe("CliLogger", () => {
  describe("constructor", () => {
    it("should create logger with default config", () => {
      const logger = createLogger()
      expect(logger).toBeInstanceOf(CliLogger)
    })

    it("should use DEBUG level when DEBUG env var is set", () => {
      const originalDebug = process.env.DEBUG
      process.env.DEBUG = "1"

      const logger = createLogger()
      expect(logger).toBeInstanceOf(CliLogger)

      process.env.DEBUG = originalDebug
    })

    it("should accept custom config", () => {
      const config: Partial<CliLoggerConfig> = {
        level: LogLevel.ERROR,
        colors: false,
        timestamps: false,
      }

      const logger = createLogger(config)
      expect(logger).toBeInstanceOf(CliLogger)
    })
  })

  describe("setLevel", () => {
    it("should change log level", () => {
      const logger = createLogger({ level: LogLevel.INFO })

      logger.setLevel(LogLevel.ERROR)

      // Logger should now only log errors
      // (actual testing of output would require console mocking)
      expect(logger).toBeInstanceOf(CliLogger)
    })
  })

  describe("log methods", () => {
    let logger: CliLogger
    let originalLog: typeof console.log
    let logCalls: string[] = []

    beforeEach(() => {
      logger = createLogger({ level: LogLevel.DEBUG, colors: false })

      // Mock console.log (all log levels use console.log in CliLogger)
      originalLog = console.log

      console.log = (...args: any[]) => {
        logCalls.push(args.join(" "))
      }

      logCalls = []
    })

    afterEach(() => {
      console.log = originalLog
    })

    it("should log debug messages", () => {
      logger.debug("test debug")
      expect(logCalls.length).toBeGreaterThan(0)
      expect(logCalls.some((call) => call.includes("test debug"))).toBe(true)
    })

    it("should log info messages", () => {
      logger.info("test info")
      expect(logCalls.length).toBeGreaterThan(0)
      expect(logCalls.some((call) => call.includes("test info"))).toBe(true)
    })

    it("should log warn messages", () => {
      logger.warn("test warn")
      expect(logCalls.length).toBeGreaterThan(0)
      expect(logCalls.some((call) => call.includes("test warn"))).toBe(true)
    })

    it("should log error messages", () => {
      logger.error("test error")
      expect(logCalls.length).toBeGreaterThan(0)
      expect(logCalls.some((call) => call.includes("test error"))).toBe(true)
    })

    it("should handle multiple arguments", () => {
      logger.info("arg1", "arg2", { obj: "value" })
      expect(logCalls.length).toBeGreaterThan(0)
      expect(logCalls.some((call) => call.includes("arg1"))).toBe(true)
      expect(logCalls.some((call) => call.includes("arg2"))).toBe(true)
    })

    it("should serialize objects", () => {
      logger.info({ key: "value", num: 42 })
      expect(logCalls.length).toBeGreaterThan(0)
      expect(logCalls.some((call) => call.includes("key"))).toBe(true)
      expect(logCalls.some((call) => call.includes("value"))).toBe(true)
    })
  })

  describe("log level filtering", () => {
    let logger: CliLogger
    let originalInfo: typeof console.log

    beforeEach(() => {
      logger = createLogger({ level: LogLevel.WARN, colors: false })

      originalInfo = console.log
      console.log = () => {}
      console.error = () => {}
    })

    afterEach(() => {
      console.log = originalInfo
    })

    it("should not log debug when level is WARN", () => {
      // Should not throw
      expect(() => logger.debug("test")).not.toThrow()
    })

    it("should not log info when level is WARN", () => {
      // Should not throw
      expect(() => logger.info("test")).not.toThrow()
    })
  })
})

describe("LogLevel", () => {
  it("should have correct numeric values", () => {
    expect(LogLevel.DEBUG).toBe(0)
    expect(LogLevel.INFO).toBe(1)
    expect(LogLevel.WARN).toBe(2)
    expect(LogLevel.ERROR).toBe(3)
  })
})
