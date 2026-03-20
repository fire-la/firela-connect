/**
 * Type declarations for @firela/parser-cn
 *
 * These types are declared locally because the upstream package
 * does not include .d.ts files in its published distribution.
 */

declare module '@firela/parser-cn' {
  import {
    Parser,
    RawTransaction,
    ParseResult,
  } from '@firela/parser-core';

  // Alipay transaction with custom fields
  export type AlipayTransaction = RawTransaction<{
    status: string;
    orderNo?: string;
  }>;

  // Chinese bank parsers
  export class AlipayWebParser implements Parser<AlipayTransaction> {
    identify(filename: string, content: Buffer): boolean;
    parse(content: Buffer): ParseResult<AlipayTransaction[]>;
  }

  export class AlipayMobileParser implements Parser<AlipayTransaction> {
    identify(filename: string, content: Buffer): boolean;
    parse(content: Buffer): ParseResult<AlipayTransaction[]>;
  }

  export class CmbcCreditParser implements Parser<RawTransaction> {
    identify(filename: string, content: Buffer): boolean;
    parse(content: Buffer): ParseResult<RawTransaction[]>;
  }

  export class CcbDebitParser implements Parser<RawTransaction> {
    identify(filename: string, content: Buffer): boolean;
    parse(content: Buffer): ParseResult<RawTransaction[]>;
  }
}
