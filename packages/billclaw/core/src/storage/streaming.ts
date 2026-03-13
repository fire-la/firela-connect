/**
 * Streaming JSON support for BillClaw
 *
 * Provides streaming JSON parsing and generation for large datasets.
 * This keeps memory usage constant regardless of file size.
 *
 * Use cases:
 * - Reading large transaction files without loading entire file
 * - Writing large datasets incrementally
 * - Processing transactions one at a time
 */

import { createReadStream, createWriteStream } from "node:fs"
import { createInterface } from "node:readline"
import type { Transaction } from "./transaction-storage.js"
import type { Logger } from "../errors/errors.js"

/**
 * Options for streaming JSON write
 */
export interface StreamingWriteOptions {
  batchSize?: number
  logger?: Logger
}

/**
 * Options for streaming JSON read
 */
export interface StreamingReadOptions<T> {
  batchSize?: number
  filter?: (item: T) => boolean
  transform?: (item: T) => T
  logger?: Logger
}

/**
 * Write items to a JSON file incrementally
 *
 * @param filePath - Path to output file
 * @param items - Async iterable of items to write
 * @param options - Write options
 */
export async function writeStreamingJson<T>(
  filePath: string,
  items: AsyncIterable<T>,
  options: StreamingWriteOptions = {},
): Promise<void> {
  const { batchSize = 100, logger } = options

  return new Promise((resolve, reject) => {
    const writeStream = createWriteStream(filePath)
    let first = true
    let count = 0

    writeStream.write("[")

    // Process items as they arrive
    ;(async () => {
      try {
        for await (const item of items) {
          if (!first) {
            writeStream.write(",")
          }

          writeStream.write(JSON.stringify(item))
          first = false
          count++

          if (count % batchSize === 0) {
            logger?.debug?.(`Written ${count} items to ${filePath}`)
          }
        }

        writeStream.write("]")
        writeStream.end()

        logger?.info?.(`Finished writing ${count} items to ${filePath}`)
      } catch (error) {
        writeStream.destroy()
        reject(error)
      }
    })()

    writeStream.on("finish", resolve)
    writeStream.on("error", reject)
  })
}

/**
 * Read items from a JSON file incrementally
 *
 * @param filePath - Path to input file
 * @param options - Read options
 * @returns Async iterable of items
 */
export async function* readStreamingJson<T>(
  filePath: string,
  options: StreamingReadOptions<T> = {},
): AsyncIterable<T> {
  const { filter, transform, logger } = options
  let count = 0

  const fileStream = createReadStream(filePath)
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  let buffer = ""

  for await (const line of rl) {
    buffer += line

    // Find complete JSON objects
    let braceCount = 0
    let objStart = -1
    let inString = false
    let escapeNext = false

    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i]

      if (escapeNext) {
        escapeNext = false
        continue
      }

      if (char === "\\") {
        escapeNext = true
        continue
      }

      if (char === '"') {
        inString = !inString
        continue
      }

      if (inString) {
        continue
      }

      if (char === "{") {
        if (objStart === -1) {
          objStart = i
        }
        braceCount++
      } else if (char === "}") {
        braceCount--

        if (braceCount === 0 && objStart !== -1) {
          const jsonStr = buffer.substring(objStart, i + 1)
          buffer = buffer.substring(i + 1).trim()

          try {
            let item = JSON.parse(jsonStr) as T

            if (transform) {
              item = transform(item)
            }

            if (!filter || filter(item)) {
              count++
              yield item
            }
          } catch (error) {
            logger?.error?.("Failed to parse JSON item", error)
          }

          i = -1 // Reset position
          objStart = -1
        }
      }
    }
  }

  logger?.debug?.(`Read ${count} items from ${filePath}`)
}

/**
 * Stream transactions from a file
 *
 * @param filePath - Path to transaction file
 * @param options - Stream options
 * @returns Async iterable of transactions
 */
export async function* streamTransactions(
  filePath: string,
  options?: StreamingReadOptions<Transaction>,
): AsyncIterable<Transaction> {
  yield* readStreamingJson<Transaction>(filePath, options)
}

/**
 * Write transactions to a file incrementally
 *
 * @param filePath - Path to output file
 * @param transactions - Async iterable of transactions
 * @param options - Write options
 */
export async function writeTransactionsStreaming(
  filePath: string,
  transactions: AsyncIterable<Transaction>,
  options?: StreamingWriteOptions,
): Promise<void> {
  await writeStreamingJson(filePath, transactions, options)
}

/**
 * Map/reduce operations on streaming JSON
 */
export class StreamingJsonOperations<T> {
  constructor(
    private filePath: string,
    private logger?: Logger,
  ) {}

  /**
   * Map each item through a transformation function
   */
  async map<U,>(fn: (item: T) => U): Promise<U[]> {
    const results: U[] = []

    for await (const item of readStreamingJson<T>(this.filePath, {
      logger: this.logger,
    })) {
      results.push(fn(item))
    }

    return results
  }

  /**
   * Filter items
   */
  async filter(fn: (item: T) => boolean): Promise<T[]> {
    const results: T[] = []

    for await (const item of readStreamingJson<T>(this.filePath, {
      filter: fn,
      logger: this.logger,
    })) {
      results.push(item)
    }

    return results
  }

  /**
   * Reduce items to a single value
   */
  async reduce<U,>(fn: (acc: U, item: T) => U, initial: U): Promise<U> {
    let acc = initial

    for await (const item of readStreamingJson<T>(this.filePath, {
      logger: this.logger,
    })) {
      acc = fn(acc, item)
    }

    return acc
  }

  /**
   * Count items matching a predicate
   */
  async count(predicate?: (item: T) => boolean): Promise<number> {
    let count = 0

    for await (const _item of readStreamingJson<T>(this.filePath, {
      filter: predicate,
      logger: this.logger,
    })) {
      count++
    }

    return count
  }

  /**
   * Find the first item matching a predicate
   */
  async find(predicate: (item: T) => boolean): Promise<T | null> {
    for await (const item of readStreamingJson<T>(this.filePath, {
      logger: this.logger,
    })) {
      if (predicate(item)) {
        return item
      }
    }

    return null
  }

  /**
   * Check if any item matches a predicate
   */
  async some(predicate: (item: T) => boolean): Promise<boolean> {
    return (await this.find(predicate)) !== null
  }

  /**
   * Check if all items match a predicate
   */
  async every(predicate: (item: T) => boolean): Promise<boolean> {
    for await (const item of readStreamingJson<T>(this.filePath, {
      logger: this.logger,
    })) {
      if (!predicate(item)) {
        return false
      }
    }

    return true
  }
}

/**
 * Create streaming operations for a file
 */
export function createStreamingOperations<T>(
  filePath: string,
  logger?: Logger,
): StreamingJsonOperations<T> {
  return new StreamingJsonOperations<T>(filePath, logger)
}
