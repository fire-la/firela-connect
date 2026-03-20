/**
 * Type declarations for @firela/parser-eu
 *
 * These types are declared locally because the upstream package
 * does not include .d.ts files in its published distribution.
 */

declare module '@firela/parser-eu' {
  import {
    Parser,
    RawTransaction,
    ParseResult,
  } from '@firela/parser-core';

  // European broker parsers
  export class DegiroParser implements Parser<RawTransaction> {
    identify(filename: string, content: Buffer): boolean;
    parse(content: Buffer): ParseResult<RawTransaction[]>;
  }

  export class InteractiveBrokersParser implements Parser<RawTransaction> {
    identify(filename: string, content: Buffer): boolean;
    parse(content: Buffer): ParseResult<RawTransaction[]>;
  }
}
