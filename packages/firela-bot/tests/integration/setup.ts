/**
 * Integration Test Setup
 *
 * Test utilities for integration testing:
 * - Mock Discord signature generation
 * - Mock fetch for relay.firela.io responses
 * - Test environment configuration
 */

import nacl from 'tweetnacl';
import type { ChatResponse, RelayErrorResponse } from '../../src/relay/types';
import type { TestEnv } from './test-config';

// Re-export test config for convenience
export * from './test-config';

/**
 * Generate a valid Discord signature for testing
 *
 * @param body - Request body as string
 * @param timestamp - Timestamp string
 * @param publicKey - Public key for verification (hex)
 * @returns Signature and keypair for the request
 */
export function generateDiscordSignature(
  body: string,
  timestamp: string,
  publicKey?: string
): { signature: string; publicKey: string; privateKey: string } {
  // Generate a new keypair for signing
  const keypair = nacl.sign.keyPair();

  // Convert private key to hex for storage
  const privateKeyHex = Buffer.from(keypair.secretKey).toString('hex');

  // Sign the message (timestamp + body)
  const message = new TextEncoder().encode(timestamp + body);
  const signature = nacl.sign.detached(message, keypair.secretKey);

  // Return signature and public key in hex format
  return {
    signature: Buffer.from(signature).toString('hex'),
    publicKey: Buffer.from(keypair.publicKey).toString('hex'),
    privateKey: privateKeyHex,
  };
}

/**
 * Sign a request with an existing keypair
 *
 * @param body - Request body as string
 * @param timestamp - Timestamp string
 * @param privateKeyHex - Private key in hex format
 * @returns Signature in hex format
 */
export function signWithPrivateKey(
  body: string,
  timestamp: string,
  privateKeyHex: string
): string {
  const secretKey = hexToUint8Array(privateKeyHex);
  const message = new TextEncoder().encode(timestamp + body);
  const signature = nacl.sign.detached(message, secretKey);
  return Buffer.from(signature).toString('hex');
}

/**
 * Create mock Discord interaction request
 *
 * @param body - Interaction payload (will be JSON stringified)
 * @param env - Test environment with public key
 * @param options - Optional overrides
 * @returns Request object with valid Discord signature
 */
export function createMockDiscordRequest(
  body: object,
  env: TestEnv,
  options?: {
    timestamp?: string;
    signature?: string;
    tamperBody?: boolean;
  }
): Request {
  const bodyString = JSON.stringify(body);
  const timestamp = options?.timestamp || Date.now().toString();

  // Generate signature using the env's public key (for valid signature tests)
  // Note: This requires the env.DISCORD_PUBLIC_KEY to be from a known keypair
  // For testing purposes, we'll use the generated keypair approach
  let signature: string;

  if (options?.signature) {
    signature = options.signature;
  } else {
    // For testing signature verification, we need to sign with a matching keypair
    // Use a fixed test keypair for consistent testing
    const testKeypair = nacl.sign.keyPair.fromSeed(
      hexToUint8Array(env.DISCORD_PUBLIC_KEY.padEnd(64, '0').slice(0, 64))
    );
    const message = new TextEncoder().encode(timestamp + bodyString);
    signature = Buffer.from(
      nacl.sign.detached(message, testKeypair.secretKey)
    ).toString('hex');
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'x-signature-ed25519': signature,
    'x-signature-timestamp': timestamp,
  });

  // Optionally tamper with body for testing invalid signatures
  const finalBody = options?.tamperBody
    ? bodyString + 'tampered'
    : bodyString;

  return new Request('http://test.local/interactions', {
    method: 'POST',
    headers,
    body: finalBody,
  });
}

/**
 * Create a PING interaction payload
 */
export function createPingInteraction(): DiscordPingInteraction {
  return {
    id: '123456789012345678',
    application_id: '987654321098765432',
    type: 1, // PING
    version: 1,
    token: 'test-interaction-token',
    app_permissions: '2048',
  };
}

/**
 * Create a chat command interaction payload
 */
export function createChatInteraction(
  message: string,
  options?: {
    userId?: string;
    channelId?: string;
    guildId?: string;
  }
): DiscordChatInteraction {
  return {
    id: '123456789012345678',
    application_id: '987654321098765432',
    type: 2, // APPLICATION_COMMAND
    data: {
      id: '111222333444555666',
      name: 'chat',
      type: 1,
      options: [
        {
          name: 'message',
          type: 3, // STRING
          value: message,
        },
      ],
    },
    guild_id: options?.guildId,
    channel_id: options?.channelId || '777888999000111222',
    user: {
      id: options?.userId || '987654321098765432',
      username: 'testuser',
      discriminator: '1234',
      avatar: null,
    },
    member: {
      user: {
        id: options?.userId || '987654321098765432',
        username: 'testuser',
        discriminator: '1234',
        avatar: null,
      },
      roles: [],
      permissions: '2048',
    },
    token: 'test-interaction-token',
    version: 1,
    app_permissions: '2048',
  };
}

/**
 * Create an unknown command interaction payload
 */
export function createUnknownCommandInteraction(
  commandName: string
): DiscordChatInteraction {
  const interaction = createChatInteraction('test message');
  return {
    ...interaction,
    data: {
      ...interaction.data!,
      name: commandName,
    },
  };
}

/**
 * Mock fetch responses for relay API
 */
export const mockRelayResponses = {
  /**
   * Successful chat completion response (Claude format)
   */
  success: (content: string = 'Hello! How can I help you today?'): ChatResponse => ({
    id: 'msg-test-123',
    model: 'claude-3-5-sonnet-20241022',
    content: [
      {
        type: 'text',
        text: content,
      },
    ],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 10,
      output_tokens: 20,
    },
  }),

  /**
   * Invalid API key error response
   */
  invalidApiKey: (): RelayErrorResponse => ({
    error: {
      message: 'Invalid API key provided',
      type: 'invalid_request_error',
      code: 'invalid_api_key',
    },
  }),

  /**
   * Rate limit exceeded error response
   */
  rateLimitExceeded: (): RelayErrorResponse => ({
    error: {
      message: 'Rate limit exceeded. Please try again later.',
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded',
    },
  }),

  /**
   * Server error response
   */
  serverError: (): RelayErrorResponse => ({
    error: {
      message: 'Internal server error',
      type: 'server_error',
      code: 'internal_error',
    },
  }),
};

/**
 * Create a mock fetch function for testing relay calls
 *
 * @param responses - Map of URL patterns to responses
 * @returns Mocked fetch function
 */
export function createMockFetch(
  responses: Map<string, MockResponse>
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // Find matching response
    for (const [pattern, response] of responses) {
      if (url.includes(pattern)) {
        const mockResponse = typeof response === 'function' ? response(init) : response;
        return new Response(JSON.stringify(mockResponse.body), {
          status: mockResponse.status,
          headers: {
            'Content-Type': 'application/json',
            ...mockResponse.headers,
          },
        });
      }
    }

    // Default 404 for unmatched requests
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

/**
 * Mock response type
 */
export interface MockResponse {
  body: unknown;
  status: number;
  headers?: Record<string, string>;
}

/**
 * Discord interaction types
 */
export interface DiscordPingInteraction {
  id: string;
  application_id: string;
  type: 1;
  version: number;
  token: string;
  app_permissions: string;
}

export interface DiscordChatInteraction {
  id: string;
  application_id: string;
  type: 2;
  data?: {
    id: string;
    name: string;
    type: number;
    options?: Array<{
      name: string;
      type: number;
      value: string;
    }>;
  };
  guild_id?: string;
  channel_id: string;
  user: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
  };
  member?: {
    user: DiscordChatInteraction['user'];
    roles: string[];
    permissions: string;
  };
  token: string;
  version: number;
  app_permissions: string;
}

/**
 * Convert hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) {
    throw new Error('Invalid hex string');
  }
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

/**
 * Create a mock KV namespace for testing
 */
export function createMockKV(): KVNamespace {
  const store = new Map<string, { value: string; expirationTtl?: number }>();

  return {
    get: async (key: string, options?: string | Partial<KVGetOptions>) => {
      const entry = store.get(key);
      if (!entry) return null;

      const type = typeof options === 'string' ? options : options?.type;
      if (type === 'json') {
        return JSON.parse(entry.value) as unknown;
      }
      return entry.value as unknown;
    },
    put: async (key: string, value: string, options?: KVPutOptions) => {
      store.set(key, { value, expirationTtl: options?.expirationTtl });
      return undefined;
    },
    delete: async (key: string) => {
      store.delete(key);
      return undefined;
    },
    list: async () => ({ keys: [], list_complete: true }),
  } as unknown as KVNamespace;
}
