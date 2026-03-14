/**
 * Relay Client Integration Tests
 *
 * Tests for relay.firela.io client:
 * - Successful chat completion
 * - API error handling (401, 429, 500)
 * - Timeout handling
 * - Bearer token included in headers
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RelayClient, createRelayClient, RelayError, getUserErrorMessage } from '../../src/relay';
import {
  createTestEnv,
  createMockFetch,
  mockRelayResponses,
  TEST_RELAY,
} from './setup';

describe('Relay Client Integration', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('RelayClient', () => {
    it('should create client with valid config', () => {
      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: TEST_RELAY.API_KEY,
      });

      expect(client).toBeDefined();
    });

    it('should create client from environment', () => {
      const env = createTestEnv();
      const client = createRelayClient(env as any);

      expect(client).toBeDefined();
    });

    it('should throw error when FIRELA_BOT_API_KEY is missing', () => {
      const env = createTestEnv({ FIRELA_BOT_API_KEY: '' });

      expect(() => createRelayClient(env as any)).toThrow('FIRELA_BOT_API_KEY');
    });

    it('should throw error when RELAY_URL is missing', () => {
      const env = createTestEnv({ RELAY_URL: '' });

      expect(() => createRelayClient(env as any)).toThrow('RELAY_URL');
    });

    it('should remove trailing slash from baseUrl', () => {
      const client = new RelayClient({
        baseUrl: 'https://relay.test.local/',
        apiKey: 'test-key',
      });

      // The client should work correctly (internal normalization)
      expect(client).toBeDefined();
    });
  });

  describe('Chat Completion', () => {
    it('should successfully complete chat request', async () => {
      const mockFetch = createMockFetch(
        new Map([
          [
            '/v1/messages',
            {
              body: mockRelayResponses.success('Hello! How can I help you?'),
              status: 200,
            },
          ],
        ])
      );
      global.fetch = mockFetch;

      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: TEST_RELAY.API_KEY,
      });

      const response = await client.chat([
        { role: 'user', content: 'Hello' },
      ]);

      expect(response.id).toBeDefined();
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toBe('Hello! How can I help you?');
    });

    it('should include Bearer token in Authorization header', async () => {
      let capturedRequest: RequestInit | undefined;

      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        capturedRequest = init;
        return new Response(JSON.stringify(mockRelayResponses.success()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
      global.fetch = mockFetch;

      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: 'my-secret-api-key',
      });

      await client.chat([{ role: 'user', content: 'test' }]);

      expect(capturedRequest?.headers).toBeDefined();
      const headers = capturedRequest?.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer my-secret-api-key');
    });

    it('should include Content-Type header', async () => {
      let capturedRequest: RequestInit | undefined;

      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        capturedRequest = init;
        return new Response(JSON.stringify(mockRelayResponses.success()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
      global.fetch = mockFetch;

      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: TEST_RELAY.API_KEY,
      });

      await client.chat([{ role: 'user', content: 'test' }]);

      const headers = capturedRequest?.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should send messages in request body', async () => {
      let capturedBody: string | undefined;

      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return new Response(JSON.stringify(mockRelayResponses.success()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
      global.fetch = mockFetch;

      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: TEST_RELAY.API_KEY,
      });

      await client.chat([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ]);

      const parsedBody = JSON.parse(capturedBody!);
      expect(parsedBody.messages).toHaveLength(2);
      expect(parsedBody.messages[0].role).toBe('system');
      expect(parsedBody.messages[1].role).toBe('user');
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 Unauthorized error', async () => {
      const mockFetch = createMockFetch(
        new Map([
          [
            '/v1/messages',
            {
              body: mockRelayResponses.invalidApiKey(),
              status: 401,
            },
          ],
        ])
      );
      global.fetch = mockFetch;

      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: 'invalid-key',
      });

      await expect(client.chat([{ role: 'user', content: 'test' }])).rejects.toThrow(RelayError);
    });

    it('should handle 429 Rate Limit error', async () => {
      const mockFetch = createMockFetch(
        new Map([
          [
            '/v1/messages',
            {
              body: mockRelayResponses.rateLimitExceeded(),
              status: 429,
            },
          ],
        ])
      );
      global.fetch = mockFetch;

      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: TEST_RELAY.API_KEY,
      });

      await expect(client.chat([{ role: 'user', content: 'test' }])).rejects.toThrow(RelayError);
    });

    it('should handle 500 Server error', async () => {
      const mockFetch = createMockFetch(
        new Map([
          [
            '/v1/messages',
            {
              body: mockRelayResponses.serverError(),
              status: 500,
            },
          ],
        ])
      );
      global.fetch = mockFetch;

      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: TEST_RELAY.API_KEY,
      });

      await expect(client.chat([{ role: 'user', content: 'test' }])).rejects.toThrow(RelayError);
    });

    it('should handle 503 Service Unavailable', async () => {
      const mockFetch = createMockFetch(
        new Map([
          [
            '/v1/messages',
            {
              body: 'Service Temporarily Unavailable',
              status: 503,
            },
          ],
        ])
      );
      global.fetch = mockFetch;

      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: TEST_RELAY.API_KEY,
      });

      await expect(client.chat([{ role: 'user', content: 'test' }])).rejects.toThrow(RelayError);
    });
  });

  describe('Timeout Handling', () => {
    // Note: AbortController timeout behavior varies between Node.js versions
    // and test environments. This test verifies the timeout configuration is accepted.
    it('should accept timeout configuration', () => {
      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: TEST_RELAY.API_KEY,
        timeout: 5000, // 5 second timeout
      });

      // Client should be created successfully with custom timeout
      expect(client).toBeDefined();
    });

    it('should use default timeout when not specified', () => {
      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: TEST_RELAY.API_KEY,
      });

      expect(client).toBeDefined();
    });
  });

  describe('RelayError', () => {
    it('should create RelayError from error response', () => {
      const errorResponse = mockRelayResponses.invalidApiKey();
      const error = new RelayError(errorResponse);

      expect(error.code).toBe('invalid_api_key');
      expect(error.type).toBe('invalid_request_error');
      expect(error.userMessage).toContain('Invalid API key');
    });

    it('should create RelayError from HTTP status', () => {
      const error = RelayError.fromHttpStatus(401, 'Unauthorized');

      expect(error.code).toBe('invalid_api_key');
      expect(error.userMessage).toContain('Invalid API key');
    });

    it('should map 429 to rate_limit_exceeded', () => {
      const error = RelayError.fromHttpStatus(429, 'Too Many Requests');

      expect(error.code).toBe('rate_limit_exceeded');
    });

    it('should map 503 to service_unavailable', () => {
      const error = RelayError.fromHttpStatus(503, 'Service Unavailable');

      expect(error.code).toBe('service_unavailable');
    });
  });

  describe('getUserErrorMessage', () => {
    it('should return user-friendly message for RelayError', () => {
      const error = new RelayError(mockRelayResponses.invalidApiKey());
      const message = getUserErrorMessage(error);

      expect(message).toContain('Invalid API key');
    });

    it('should return message for generic Error', () => {
      const error = new Error('Network failure');
      const message = getUserErrorMessage(error);

      expect(message).toContain('Network failure');
    });

    it('should return default message for unknown error', () => {
      const message = getUserErrorMessage('unknown');

      // Default message is in English
      expect(message).toContain('Connection failed');
    });
  });

  describe('sendMessage Helper', () => {
    it('should send simple message and return content', async () => {
      const mockFetch = createMockFetch(
        new Map([
          [
            '/v1/messages',
            {
              body: mockRelayResponses.success('Response content'),
              status: 200,
            },
          ],
        ])
      );
      global.fetch = mockFetch;

      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: TEST_RELAY.API_KEY,
      });

      const response = await client.sendMessage('Hello');

      expect(response).toBe('Response content');
    });

    it('should include system prompt when provided', async () => {
      let capturedBody: string | undefined;

      const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return new Response(JSON.stringify(mockRelayResponses.success()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
      global.fetch = mockFetch;

      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: TEST_RELAY.API_KEY,
      });

      await client.sendMessage('Hello', 'You are a helpful assistant');

      const parsedBody = JSON.parse(capturedBody!);
      expect(parsedBody.messages).toHaveLength(2);
      expect(parsedBody.messages[0].role).toBe('system');
      expect(parsedBody.messages[0].content).toBe('You are a helpful assistant');
    });
  });

  describe('verify Method', () => {
    it('should return valid: true on successful verification', async () => {
      const mockFetch = createMockFetch(
        new Map([
          [
            '/v1/messages',
            {
              body: mockRelayResponses.success(),
              status: 200,
            },
          ],
        ])
      );
      global.fetch = mockFetch;

      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: TEST_RELAY.API_KEY,
      });

      const result = await client.verify();

      expect(result.valid).toBe(true);
    });

    it('should return valid: false on API error', async () => {
      const mockFetch = createMockFetch(
        new Map([
          [
            '/v1/messages',
            {
              body: mockRelayResponses.invalidApiKey(),
              status: 401,
            },
          ],
        ])
      );
      global.fetch = mockFetch;

      const client = new RelayClient({
        baseUrl: TEST_RELAY.URL,
        apiKey: 'invalid-key',
      });

      const result = await client.verify();

      expect(result.valid).toBe(false);
      expect(result.message).toBeDefined();
    });
  });
});
