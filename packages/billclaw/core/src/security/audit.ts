/**
 * Security audit logging for BillClaw
 *
 * Provides audit logging for all credential operations:
 * - Credential access (read/write/delete)
 * - Account linking/unlinking
 * - Sync operations
 * - Configuration changes
 *
 * Audit logs are stored locally and can be exported for compliance.
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import type { Logger } from "../errors/errors.js"

/**
 * Audit event types
 */
export enum AuditEventType {
  // Credential operations
  CREDENTIAL_CREATED = "credential.created",
  CREDENTIAL_READ = "credential.read",
  CREDENTIAL_WRITE = "credential.write",
  CREDENTIAL_UPDATED = "credential.updated",
  CREDENTIAL_DELETED = "credential.deleted",
  CREDENTIAL_DELETE = "credential.delete", // Alias for backward compatibility
  CREDENTIAL_EXPORTED = "credential.exported",

  // Account operations
  ACCOUNT_LINKED = "account.linked",
  ACCOUNT_UNLINKED = "account.unlinked",
  ACCOUNT_SYNCED = "account.synced",
  ACCOUNT_SYNC_FAILED = "account.sync_failed",

  // Configuration operations
  CONFIG_UPDATED = "config.updated",
  CONFIG_READ = "config.read",

  // Authentication operations
  AUTH_SUCCESS = "auth.success",
  AUTH_FAILED = "auth.failed",
  AUTH_REFRESHED = "auth.refreshed",

  // Data operations
  DATA_EXPORTED = "data.exported",
  DATA_IMPORTED = "data.imported",
  DATA_DELETED = "data.deleted",

  // Legacy aliases for backward compatibility
  ACCOUNT_ACCESS = "account.access",
  SYNC_STARTED = "sync.started",
  SYNC_COMPLETED = "sync.completed",
  SYNC_FAILED = "sync.failed",
  CONFIG_CHANGE = "config.change",
}

/**
 * Audit event severity
 */
export enum AuditSeverity {
  INFO = "info",
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

/**
 * Audit event entry
 */
export interface AuditEvent {
  id: string
  timestamp: string
  type: AuditEventType
  severity: AuditSeverity
  message: string
  details?: Record<string, unknown>
  userId?: string
  ipAddress?: string
  userAgent?: string
}

/**
 * Audit log configuration
 */
export interface AuditConfig {
  dataDir?: string
  maxEntries?: number
  retentionDays?: number
}

/**
 * Default audit configuration
 */
const DEFAULT_AUDIT_CONFIG: Required<AuditConfig> = {
  dataDir: "~/.firela/billclaw",
  maxEntries: 10000,
  retentionDays: 90,
}

/**
 * Audit logger class
 */
export class AuditLogger {
  private config: Required<AuditConfig>
  private baseDir: string
  private logFilePath: string
  private logger?: Logger

  constructor(configOrPath: AuditConfig | string = {}, logger?: Logger) {
    // Support both old API (string path) and new API (config object)
    if (typeof configOrPath === "string") {
      // Old API: constructor(logFilePath: string, logger?: Logger)
      this.logFilePath = configOrPath
      this.baseDir = path.dirname(configOrPath)
      this.config = DEFAULT_AUDIT_CONFIG
      this.logger = logger
    } else {
      // New API: constructor(config?: AuditConfig, logger?: Logger)
      this.config = { ...DEFAULT_AUDIT_CONFIG, ...configOrPath }
      this.baseDir = this.config.dataDir.replace(/^~/, os.homedir())
      this.logFilePath = path.join(this.baseDir, "audit.log")
      this.logger = logger
    }
  }

  /**
   * Get the audit log file path
   */
  private getAuditFilePath(): string {
    return this.logFilePath
  }

  /**
   * Ensure audit directory exists
   */
  private async ensureAuditDir(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true })
  }

  /**
   * Rotate audit logs if they exceed max entries
   */
  private async rotateIfNeeded(): Promise<void> {
    try {
      const filePath = this.getAuditFilePath()
      const content = await fs.readFile(filePath, "utf-8")
      const lines = content.trim().split("\n")

      if (lines.length > this.config.maxEntries) {
        // Keep only the most recent entries
        const recentLines = lines.slice(-this.config.maxEntries)
        await fs.writeFile(filePath, recentLines.join("\n"), "utf-8")
      }

      // Clean up old entries based on retention
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

      const filteredLines = lines.filter((line) => {
        try {
          const event = JSON.parse(line) as AuditEvent
          const eventDate = new Date(event.timestamp)
          return eventDate >= cutoffDate
        } catch {
          return true // Keep lines that can't be parsed
        }
      })

      if (filteredLines.length < lines.length) {
        await fs.writeFile(filePath, filteredLines.join("\n"), "utf-8")
      }
    } catch {
      // File doesn't exist yet, which is fine
    }
  }

  /**
   * Log an audit event
   */
  async log(
    type: AuditEventType,
    message: string,
    details?: Record<string, unknown>,
    severity: AuditSeverity = AuditSeverity.INFO,
  ): Promise<void> {
    await this.ensureAuditDir()

    const event: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      type,
      severity,
      message,
      details,
    }

    const filePath = this.getAuditFilePath()

    try {
      await this.rotateIfNeeded()
      const logEntry = JSON.stringify(event) + "\n"
      await fs.appendFile(filePath, logEntry, "utf-8")
    } catch (error) {
      this.logger?.error?.("Failed to write audit log:", error)
    }
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Read all audit events
   */
  async readEvents(limit?: number): Promise<AuditEvent[]> {
    const filePath = this.getAuditFilePath()

    try {
      const content = await fs.readFile(filePath, "utf-8")
      const lines = content.trim().split("\n")

      const events: AuditEvent[] = []
      for (const line of lines) {
        try {
          events.push(JSON.parse(line) as AuditEvent)
        } catch {
          // Skip malformed lines
        }
      }

      // Return most recent first
      events.reverse()

      if (limit) {
        return events.slice(0, limit)
      }

      return events
    } catch {
      return []
    }
  }

  /**
   * Query audit events by type
   */
  async queryByType(
    type: AuditEventType,
    limit?: number,
  ): Promise<AuditEvent[]> {
    const events = await this.readEvents()
    const filtered = events.filter((e) => e.type === type)
    return limit ? filtered.slice(0, limit) : filtered
  }

  /**
   * Query audit events by severity
   */
  async queryBySeverity(
    severity: AuditSeverity,
    limit?: number,
  ): Promise<AuditEvent[]> {
    const events = await this.readEvents()
    const filtered = events.filter((e) => e.severity === severity)
    return limit ? filtered.slice(0, limit) : filtered
  }

  /**
   * Clear all audit events
   */
  async clear(): Promise<void> {
    const filePath = this.getAuditFilePath()

    try {
      await fs.unlink(filePath)
    } catch {
      // File doesn't exist, which is fine
    }

    // Create empty file
    await this.ensureAuditDir()
    await fs.writeFile(filePath, "", "utf-8")
    this.logger?.info?.("Audit log cleared")
  }

  /**
   * Get audit log statistics
   */
  async getStats(): Promise<{
    totalEvents: number
    byType: Record<string, number>
    bySeverity: Record<string, number>
  }> {
    const events = await this.readEvents()
    const byType: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}

    for (const event of events) {
      byType[event.type] = (byType[event.type] || 0) + 1
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1
    }

    return {
      totalEvents: events.length,
      byType,
      bySeverity,
    }
  }
}

/**
 * Create an audit logger with the given configuration
 */
export function createAuditLogger(
  config?: AuditConfig,
  logger?: Logger,
): AuditLogger {
  return new AuditLogger(config, logger)
}

/**
 * Convenience functions for common audit events
 */
export class AuditHelpers {
  constructor(private audit: AuditLogger) {}

  async logCredentialCreated(
    credentialType: string,
    accountId: string,
  ): Promise<void> {
    await this.audit.log(
      AuditEventType.CREDENTIAL_CREATED,
      `Credential created for ${credentialType}`,
      { credentialType, accountId },
      AuditSeverity.INFO,
    )
  }

  async logCredentialRead(
    credentialType: string,
    accountId: string,
  ): Promise<void> {
    await this.audit.log(
      AuditEventType.CREDENTIAL_READ,
      `Credential read for ${credentialType}`,
      { credentialType, accountId },
      AuditSeverity.INFO,
    )
  }

  async logCredentialDeleted(
    credentialType: string,
    accountId: string,
  ): Promise<void> {
    await this.audit.log(
      AuditEventType.CREDENTIAL_DELETED,
      `Credential deleted for ${credentialType}`,
      { credentialType, accountId },
      AuditSeverity.WARNING,
    )
  }

  async logAccountLinked(
    accountType: string,
    accountId: string,
  ): Promise<void> {
    await this.audit.log(
      AuditEventType.ACCOUNT_LINKED,
      `Account linked: ${accountType}`,
      { accountType, accountId },
      AuditSeverity.INFO,
    )
  }

  async logAccountUnlinked(
    accountType: string,
    accountId: string,
  ): Promise<void> {
    await this.audit.log(
      AuditEventType.ACCOUNT_UNLINKED,
      `Account unlinked: ${accountType}`,
      { accountType, accountId },
      AuditSeverity.WARNING,
    )
  }

  async logAuthFailed(accountType: string, reason: string): Promise<void> {
    await this.audit.log(
      AuditEventType.AUTH_FAILED,
      `Authentication failed for ${accountType}`,
      { accountType, reason },
      AuditSeverity.ERROR,
    )
  }

  async logDataExported(dataType: string, count: number): Promise<void> {
    await this.audit.log(
      AuditEventType.DATA_EXPORTED,
      `Data exported: ${dataType}`,
      { dataType, count },
      AuditSeverity.INFO,
    )
  }
}
