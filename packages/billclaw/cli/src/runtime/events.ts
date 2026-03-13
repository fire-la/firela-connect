/**
 * CLI event emitter implementation
 *
 * Simple in-memory event emitter for CLI usage.
 */

import type { EventEmitter } from "@firela/billclaw-core"

/**
 * CLI event emitter implementation
 */
export class CliEventEmitter implements EventEmitter {
  private listeners = new Map<string, Set<(...args: any[]) => void>>()

  emit(event: string, data?: unknown): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data)
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error)
        }
      }
    }
  }

  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: (...args: any[]) => void): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      handlers.delete(handler)
    }
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAll(event?: string): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  /**
   * Get the count of listeners for an event
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0
  }
}
