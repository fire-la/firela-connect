/**
 * Type declarations for @firela/parser-hk
 *
 * These types are declared locally because the upstream package
 * does not include .d.ts files in its published distribution.
 */

declare module '@firela/parser-hk' {
  import {
    Parser,
    RawTransaction,
    ParseResult,
  } from '@firela/parser-core';

  // Hong Kong bank parsers
  export class HsbcHkParser implements Parser<RawTransaction> {
    identify(filename: string, content: Buffer): boolean;
    parse(content: Buffer): ParseResult<RawTransaction[]>;
  }
}
