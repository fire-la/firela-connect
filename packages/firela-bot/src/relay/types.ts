/**
 * Relay Client Type Definitions
 *
 * Claude-compatible types for communication with relay service
 */

/**
 * Chat message (Claude format)
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Claude chat request payload
 */
export interface ChatRequest {
  model: string;
  max_tokens: number;
  messages: ChatMessage[];
  stream?: boolean;
  system?: string;
}

/**
 * Claude chat response from API
 */
export interface ChatResponse {
  id: string;
  model: string;
  content: Array<{
    type: 'text';
    text: string;
  }>;
  stop_reason?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Relay error response structure
 */
export interface RelayErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

/**
 * Relay client configuration
 */
export interface RelayClientConfig {
  /** Base URL for relay service (e.g., http://localhost:13000) */
  baseUrl: string;
  /** API Key for authentication */
  apiKey: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}
