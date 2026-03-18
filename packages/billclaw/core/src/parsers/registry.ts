/**
 * Parser Registry for CSV file format detection and parsing.
 *
 * Provides auto-detection and manual selection of parsers for various
 * financial file formats (Alipay, HSBC, Degiro, IBKR, etc.)
 *
 * @module @firela/billclaw-core/parsers
 */

import type { Parser, RawTransaction } from '@firela/parser-core';
// Import using namespace imports for CommonJS compatibility
import parserCn from '@firela/parser-cn';
import parserHk from '@firela/parser-hk';
import parserEu from '@firela/parser-eu';

// Extract parsers from namespace imports
const {
  AlipayWebParser,
  AlipayMobileParser,
  CmbcCreditParser,
  CcbDebitParser,
} = parserCn as typeof import('@firela/parser-cn');

const { HsbcHkParser } = parserHk as typeof import('@firela/parser-hk');

const { DegiroParser, InteractiveBrokersParser } = parserEu as typeof import('@firela/parser-eu');

/**
 * Supported parser names.
 */
export type ParserName =
  | 'alipay-web'
  | 'alipay-mobile'
  | 'cmbc-credit'
  | 'ccb-debit'
  | 'hsbc-hk'
  | 'degiro'
  | 'interactive-brokers';

/**
 * Parser class mapping.
 */
const PARSERS: Record<ParserName, new () => Parser<RawTransaction<Record<string, unknown>>>> = {
  'alipay-web': AlipayWebParser,
  'alipay-mobile': AlipayMobileParser,
  'cmbc-credit': CmbcCreditParser,
  'ccb-debit': CcbDebitParser,
  'hsbc-hk': HsbcHkParser,
  degiro: DegiroParser,
  'interactive-brokers': InteractiveBrokersParser,
};

/**
 * Parser registry for detecting and obtaining parsers.
 */
export class ParserRegistry {
  /**
   * Auto-detect parser from file content.
   *
   * @param content - File content as Buffer
   * @returns Parser name if detected, null otherwise
   */
  detect(content: Buffer): ParserName | null {
    const contentStr = content.toString('utf-8');
    for (const [name, ParserClass] of Object.entries(PARSERS)) {
      const parser = new ParserClass();
      if (parser.identify(contentStr, content)) {
        return name as ParserName;
      }
    }
    return null;
  }

  /**
   * Get parser instance by name.
   *
   * @param name - Parser name
   * @returns Parser instance
   * @throws Error if parser name is unknown
   */
  get(name: ParserName): Parser<RawTransaction<Record<string, unknown>>> {
    const ParserClass = PARSERS[name];
    if (!ParserClass) {
      throw new Error(`Unknown parser: ${name}`);
    }
    return new ParserClass();
  }

  /**
   * List all available parser names.
   *
   * @returns Array of parser names
   */
  list(): ParserName[] {
    return Object.keys(PARSERS) as ParserName[];
  }
}

/**
 * Default parser registry instance.
 */
export const parserRegistry = new ParserRegistry();
