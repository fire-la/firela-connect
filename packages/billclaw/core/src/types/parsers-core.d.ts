/**
 * Type declarations for @firela/parser-core
 *
 * These types are declared locally because the upstream package
 * does not include .d.ts files in its published distribution.
 */

declare module '@firela/parser-core' {
  import Decimal from 'decimal.js';

  export interface RawTransaction<TCustomFields = Record<string, unknown>> {
    date: Date;
    amount: Decimal;
    currency: string;
    description: string;
    payee?: string;
    metadata?: Record<string, unknown>;
    customFields?: TCustomFields;
  }

  export interface Parser<T> {
    identify(filename: string, content: Buffer): boolean;
    parse(content: Buffer): ParseResult<T[]>;
  }

  export type ParseResult<T> =
    | { success: true; data: T }
    | { success: false; errors: ParseError[] };

  export interface ParseError {
    type: string;
    message: string;
    context?: Record<string, unknown>;
  }

  // Result helpers
  export function ok<T>(value: T): { success: true; value: T };
  export function err<E>(error: E): { success: false; error: E };
  export function isSuccess<T>(
    result: unknown
  ): result is { success: true; value: T };
  export function isFailure<E>(
    result: unknown
  ): result is { success: false; error: E };
}
