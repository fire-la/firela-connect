/**
 * Tests for audit logging
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { promises as fs } from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import {
  AuditLogger,
  AuditEventType,
  AuditSeverity,
} from "./audit"

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}

describe("AuditLogger", () => {
  let tempDir: string
  let auditLog: AuditLogger
  const logFilePath = path.join(os.tmpdir(), `audit-test-${Date.now()}.log`)

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `billclaw-audit-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })

    auditLog = new AuditLogger(logFilePath, mockLogger as any)
  })

  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(logFilePath, { force: true })
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe("log", () => {
    it("should log audit event", async () => {
      await auditLog.log(
        AuditEventType.CREDENTIAL_READ,
        "Test credential read",
        { key: "test-key" },
      )

      const events = await auditLog.readEvents(10)
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe(AuditEventType.CREDENTIAL_READ)
      expect(events[0].message).toBe("Test credential read")
      expect(events[0].details).toEqual({ key: "test-key" })
    })

    it("should include timestamp", async () => {
      await auditLog.log(AuditEventType.CREDENTIAL_READ, "Test message")

      const events = await auditLog.readEvents(1)
      expect(events[0].timestamp).toBeDefined()
      expect(typeof events[0].timestamp).toBe("string")
    })

    it("should default to INFO severity", async () => {
      await auditLog.log(AuditEventType.CREDENTIAL_READ, "Test message")

      const events = await auditLog.readEvents(1)
      expect(events[0].severity).toBe(AuditSeverity.INFO)
    })

    it("should accept custom severity", async () => {
      await auditLog.log(
        AuditEventType.CREDENTIAL_READ,
        "Test message",
        {},
        AuditSeverity.HIGH,
      )

      const events = await auditLog.readEvents(1)
      expect(events[0].severity).toBe(AuditSeverity.HIGH)
    })

    it("should handle all event types", async () => {
      const eventTypes = [
        AuditEventType.CREDENTIAL_READ,
        AuditEventType.CREDENTIAL_WRITE,
        AuditEventType.CREDENTIAL_DELETE,
        AuditEventType.ACCOUNT_ACCESS,
        AuditEventType.SYNC_STARTED,
        AuditEventType.SYNC_COMPLETED,
        AuditEventType.SYNC_FAILED,
        AuditEventType.CONFIG_CHANGE,
      ]

      for (const type of eventTypes) {
        await auditLog.log(type, `Test ${type}`)
      }

      const events = await auditLog.readEvents(100)
      expect(events).toHaveLength(eventTypes.length)
    })

    it("should persist events to file", async () => {
      await auditLog.log(AuditEventType.CREDENTIAL_READ, "Test event")

      // Create new logger instance to test persistence
      const newLogger = new AuditLogger(logFilePath, mockLogger as any)
      const events = await newLogger.readEvents(10)

      expect(events).toHaveLength(1)
      expect(events[0].message).toBe("Test event")
    })
  })

  describe("readEvents", () => {
    beforeEach(async () => {
      // Add test events
      await auditLog.log(AuditEventType.CREDENTIAL_READ, "Event 1")
      await auditLog.log(AuditEventType.CREDENTIAL_WRITE, "Event 2")
      await auditLog.log(AuditEventType.CREDENTIAL_DELETE, "Event 3")
    })

    it("should read all events when limit not specified", async () => {
      const events = await auditLog.readEvents()
      expect(events).toHaveLength(3)
    })

    it("should respect limit parameter", async () => {
      const events = await auditLog.readEvents(2)
      expect(events).toHaveLength(2)
    })

    it("should return events in descending order (newest first)", async () => {
      const events = await auditLog.readEvents()
      expect(events[0].message).toBe("Event 3")
      expect(events[2].message).toBe("Event 1")
    })
  })

  describe("queryByType", () => {
    beforeEach(async () => {
      await auditLog.log(AuditEventType.CREDENTIAL_READ, "Read 1")
      await auditLog.log(AuditEventType.CREDENTIAL_WRITE, "Write 1")
      await auditLog.log(AuditEventType.CREDENTIAL_READ, "Read 2")
      await auditLog.log(AuditEventType.SYNC_STARTED, "Sync 1")
    })

    it("should filter events by type", async () => {
      const events = await auditLog.queryByType(AuditEventType.CREDENTIAL_READ)
      expect(events).toHaveLength(2)
      expect(
        events.every((e) => e.type === AuditEventType.CREDENTIAL_READ),
      ).toBe(true)
    })

    it("should return empty array for non-existent type", async () => {
      const events = await auditLog.queryByType(
        AuditEventType.CREDENTIAL_DELETE,
      )
      expect(events).toEqual([])
    })
  })

  describe("clear", () => {
    it("should remove all events", async () => {
      await auditLog.log(AuditEventType.CREDENTIAL_READ, "Event 1")
      await auditLog.log(AuditEventType.CREDENTIAL_WRITE, "Event 2")

      let events = await auditLog.readEvents()
      expect(events).toHaveLength(2)

      await auditLog.clear()

      events = await auditLog.readEvents()
      expect(events).toHaveLength(0)
    })

    it("should create empty file after clear", async () => {
      await auditLog.log(AuditEventType.CREDENTIAL_READ, "Event 1")
      await auditLog.clear()

      const exists = await fs
        .access(logFilePath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })
  })

  describe("getStats", () => {
    beforeEach(async () => {
      await auditLog.log(AuditEventType.CREDENTIAL_READ, "Read 1")
      await auditLog.log(AuditEventType.CREDENTIAL_WRITE, "Write 1")
      await auditLog.log(
        AuditEventType.CREDENTIAL_READ,
        "Read 2",
        {},
        AuditSeverity.HIGH,
      )
      await auditLog.log(
        AuditEventType.SYNC_FAILED,
        "Sync failed",
        {},
        AuditSeverity.CRITICAL,
      )
    })

    it("should return event statistics", async () => {
      const stats = await auditLog.getStats()

      expect(stats.totalEvents).toBe(4)
      expect(stats.byType).toHaveProperty(AuditEventType.CREDENTIAL_READ, 2)
      expect(stats.byType).toHaveProperty(AuditEventType.CREDENTIAL_WRITE, 1)
      expect(stats.bySeverity).toHaveProperty(AuditSeverity.INFO, 2)
      expect(stats.bySeverity).toHaveProperty(AuditSeverity.HIGH, 1)
      expect(stats.bySeverity).toHaveProperty(AuditSeverity.CRITICAL, 1)
    })
  })
})

describe("AuditEventType", () => {
  it("should have all expected event types", () => {
    const expectedTypes = [
      "credential.read",
      "credential.write",
      "credential.delete",
      "account.access",
      "sync.started",
      "sync.completed",
      "sync.failed",
      "config.change",
    ]

    expectedTypes.forEach((type) => {
      expect(Object.values(AuditEventType)).toContain(type)
    })
  })
})

describe("AuditSeverity", () => {
  it("should have all expected severity levels", () => {
    const expectedSeverities = ["info", "low", "medium", "high", "critical"]

    expectedSeverities.forEach((severity) => {
      expect(Object.values(AuditSeverity)).toContain(severity)
    })
  })
})
