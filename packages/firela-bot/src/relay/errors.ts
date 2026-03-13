/**
 * Relay Error Handling
 *
 * Provides user-friendly error messages for common relay errors.
 */

import type { RelayErrorResponse } from './types';

/**
 * Error code to user-friendly message mapping
 */
const ERROR_MESSAGES: Record<string, string> = {
  invalid_api_key: 'API Key 无效，请检查配置',
  api_key_expired: 'API Key 已过期，请访问 firela.io 更新',
  rate_limit_exceeded: '请求过于频繁，请稍后重试',
  insufficient_quota: '配额不足，请升级计划',
  internal_error: '服务暂时不可用，请稍后再试',
  service_unavailable: '服务暂时不可用，请稍后再试',
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

  constructor(errorResponse: RelayErrorResponse) {
    const { message, type, code } = errorResponse.error;
    super(message);
    this.name = 'RelayError';
    this.code = code;
    this.type = type;
    this.userMessage = ERROR_MESSAGES[code] || `服务错误: ${message}`;
  }

  /**
   * Create RelayError from HTTP status code
   *
   * Used when the response body doesn't contain a valid error JSON.
   */
  static fromHttpStatus(status: number, body?: string): RelayError {
    let code = 'internal_error';
    let message = 'Unknown error';

    if (status === 401) {
      code = 'invalid_api_key';
      message = 'Invalid API key';
    } else if (status === 429) {
      code = 'rate_limit_exceeded';
      message = 'Rate limit exceeded';
    } else if (status === 503) {
      code = 'service_unavailable';
      message = 'Service unavailable';
    }

    return new RelayError({
      error: { message, type: 'api_error', code },
    });
  }
}

/**
 * Get user-friendly error message from any error
 *
 * @param error - The error to convert
 * @returns User-friendly error message
 */
export function getUserErrorMessage(error: unknown): string {
  if (error instanceof RelayError) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return `连接失败: ${error.message}`;
  }
  return '连接失败，请稍后重试';
}
