/**
 * Relay Client
 *
 * HTTP client for communicating with relay service.
 * Uses Claude-compatible /v1/messages API with Bearer token authentication.
 */

import type { ChatMessage, ChatResponse, RelayClientConfig } from './types';
import { RelayError } from './errors';

/**
 * Default request timeout in milliseconds
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Default model for chat completions
 */
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022';

/**
 * Default max tokens for responses
 */
const DEFAULT_MAX_TOKENS = 1024;

/**
 * Relay API Client
 *
 * Provides methods for chat completions using Claude-compatible API.
 */
export class RelayClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(config: RelayClientConfig) {
    // Remove trailing slash from baseUrl
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Send a chat completion request using Claude API format
   *
   * @param messages - Array of chat messages
   * @param options - Optional model and max_tokens settings
   * @returns Chat response from API
   * @throws RelayError on API errors
   */
  async chat(
    messages: ChatMessage[],
    options?: { model?: string; max_tokens?: number; stream?: boolean }
  ): Promise<ChatResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options?.model || DEFAULT_MODEL,
          max_tokens: options?.max_tokens || DEFAULT_MAX_TOKENS,
          messages,
          stream: options?.stream ?? false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text();
        try {
          const error = JSON.parse(body) as RelayErrorResponse;
          throw new RelayError(error);
        } catch {
          throw RelayError.fromHttpStatus(response.status, body);
        }
      }

      return response.json() as Promise<ChatResponse>;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof RelayError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('请求超时，请稍后重试');
      }
      throw error;
    }
  }

  /**
   * Verify API Key validity
   *
   * Sends a minimal request to check if the API key is valid.
   *
   * @returns Object with valid status and optional error message
   */
  async verify(): Promise<{ valid: boolean; message?: string }> {
    try {
      // Send minimal request to verify connection
      await this.chat([{ role: 'user', content: 'ping' }], {
        max_tokens: 10,
      });
      return { valid: true };
    } catch (error) {
      if (error instanceof RelayError) {
        return { valid: false, message: error.userMessage };
      }
      return { valid: false, message: '连接验证失败' };
    }
  }

  /**
   * Send a simple message and get response
   *
   * Helper method for single-turn conversations.
   *
   * @param content - User message content
   * @param systemPrompt - Optional system prompt
   * @returns Assistant response text
   */
  async sendMessage(content: string, systemPrompt?: string): Promise<string> {
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content });

    const response = await this.chat(messages);
    // Extract text from Claude response format
    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }
}

// Import type for error handling
import type { RelayErrorResponse } from './types';

/**
 * Create RelayClient from environment variables
 *
 * Factory function for creating clients in Cloudflare Workers.
 *
 * @param env - Environment object with FIRELA_BOT_API_KEY and RELAY_URL
 * @returns Configured RelayClient instance
 * @throws Error if required environment variables are missing
 */
export function createRelayClient(env: {
  FIRELA_BOT_API_KEY: string;
  RELAY_URL: string;
}): RelayClient {
  if (!env.FIRELA_BOT_API_KEY) {
    throw new Error('FIRELA_BOT_API_KEY 未配置');
  }
  if (!env.RELAY_URL) {
    throw new Error('RELAY_URL 未配置');
  }
  return new RelayClient({
    baseUrl: env.RELAY_URL,
    apiKey: env.FIRELA_BOT_API_KEY,
  });
}
