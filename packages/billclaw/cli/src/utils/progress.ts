/**
 * Progress utilities for CLI operations
 *
 * Provides spinner and progress bar functionality.
 */

import ora, { Ora } from "ora"

/**
 * Progress spinner options
 */
export interface SpinnerOptions {
  text: string
  color?: typeof ora.prototype["color"]
  hideCursor?: boolean
  interval?: number
}

/**
 * Progress spinner wrapper
 */
export class Spinner {
  private ora: Ora

  constructor(options: SpinnerOptions) {
    this.ora = ora({
      text: options.text,
      color: options.color ?? "cyan",
      hideCursor: options.hideCursor ?? true,
      interval: options.interval,
    })
  }

  start(): Spinner {
    this.ora.start()
    return this
  }

  stop(): Spinner {
    this.ora.stop()
    return this
  }

  succeed(text?: string): Spinner {
    this.ora.succeed(text)
    return this
  }

  fail(text?: string): Spinner {
    this.ora.fail(text)
    return this
  }

  warn(text?: string): Spinner {
    this.ora.warn(text)
    return this
  }

  info(text?: string): Spinner {
    this.ora.info(text)
    return this
  }

  update(text: string): Spinner {
    this.ora.text = text
    return this
  }

  /**
   * Execute an async function with loading indicator
   */
  static async withLoading<T,>(text: string, fn: () => Promise<T>): Promise<T> {
    const spinner = new Spinner({ text }).start()
    try {
      const result = await fn()
      spinner.succeed()
      return result
    } catch (err) {
      spinner.fail()
      throw err
    }
  }
}

/**
 * Create a progress spinner
 */
export function createSpinner(options: SpinnerOptions): Spinner {
  return new Spinner(options)
}
