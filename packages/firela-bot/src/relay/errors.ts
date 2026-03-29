/**
 * Relay Error Handling
 *
 * Provides user-friendly error messages for common relay errors.
 */

import type { RelayErrorResponse } from './types';
import { getMessage, type MessageKey } from '../i18n/index.js';

/**
 * Error code to i18n message key mapping
 */
const ERROR_CODE_TO_KEY: Record<string, MessageKey> = {
  invalid_api_key: 'errors.invalid_api_key',
  api_key_expired: 'errors.api_key_expired',
  rate_limit_exceeded: 'errors.rate_limit_exceeded',
  insufficient_quota: 'errors.insufficient_quota',
  internal_error: 'errors.service_unavailable',
  service_unavailable: 'errors.service_unavailable',
};

/**
 * Relay API Error
 *
 * Wraps API error responses with user-friendly messages.
 */
export class RelayError extends Error {
  /** Error code from API */
  public readonly code: string;
  /** Error type from API */
  public readonly type: string;
  /** User-friendly error message */
  public readonly userMessage: string;

  constructor(errorResponse: RelayErrorResponse, locale?: string) {
    const { message, type, code } = errorResponse.error;
    super(message);
    this.name = 'RelayError';
    this.code = code ?? 'unknown';
    this.type = type;
    const messageKey = code ? ERROR_CODE_TO_KEY[code] : undefined;
    this.userMessage = messageKey
      ? getMessage(messageKey, locale)
      : getMessage('errors.internal_error', locale, { message });
  }

  /**
   * Create RelayError from HTTP status code
   *
   * Used when the response body doesn't contain a valid error JSON.
   */
  static fromHttpStatus(status: number, _body?: string, locale?: string): RelayError {
    let code = 'internal_error';
    let message = 'Unknown error';

    if (status === 401) {
      code = 'invalid_api_key';
      message = 'Invalid API key';
    } else if (status === 408) {
      code = 'request_timeout';
      message = 'Request timed out';
    } else if (status === 429) {
      code = 'rate_limit_exceeded';
      message = 'Rate limit exceeded';
    } else if (status === 503) {
      code = 'service_unavailable';
      message = 'Service unavailable';
    }

    return new RelayError(
      {
        error: { message, type: 'api_error', code },
      },
      locale
    );
  }
}

/**
 * Get user-friendly error message from any error
 *
 * @param error - The error to convert
 * @param locale - Optional locale for localized messages
 * @returns User-friendly error message
 */
export function getUserErrorMessage(error: unknown, locale?: string): string {
  if (error instanceof RelayError) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return getMessage('errors.connection_failed', locale, { message: error.message });
  }
  return getMessage('errors.connection_failed_generic', locale);
}
