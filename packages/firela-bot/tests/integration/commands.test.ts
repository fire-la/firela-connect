/**
 * Slash Command Handling Tests
 *
 * Tests for Discord slash command handling:
 * - PING returns PONG (type: 1)
 * - /chat command triggers relay call
 * - Unknown commands handled gracefully
 * - Missing env vars produce clear errors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import nacl from 'tweetnacl';
import { handleInteraction } from '../../src/interactions/handler';
import {
  handleCommand,
  handleButtonInteraction,
  handleModalSubmit,
  InteractionType,
  InteractionResponseType,
  ChatButtonCustomId,
} from '../../src/interactions/commands';
import {
  createPingInteraction,
  createChatInteraction,
  createUnknownCommandInteraction,
  createTestEnv,
  createMockKV,
  type TestEnv,
} from './setup';

/**
 * Create a mock ExecutionContext with waitUntil method
 */
function createMockCtx(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;
}

/**
 * Create a button interaction for testing
 */
function createButtonInteraction(customId: string): Partial<DiscordInteraction> {
  return {
    id: '999888777666555444',
    application_id: '111222333444555666',
    type: InteractionType.MESSAGE_COMPONENT,
    data: {
      custom_id: customId,
      component_type: 2, // Button
    },
    channel_id: '123456789012345678',
    user: {
      id: '987654321098765432',
      username: 'testuser',
      discriminator: '1234',
    },
    token: 'test_token_for_button_interaction',
    version: 1,
    app_permissions: '0',
  };
}

/**
 * Create a modal submit interaction for testing
 */
function createModalSubmitInteraction(userInput: string): Partial<DiscordInteraction> {
  return {
    id: '888777666555444333',
    application_id: '111222333444555666',
    type: InteractionType.MODAL_SUBMIT,
    data: {
      custom_id: ChatButtonCustomId.MODAL_SUBMIT,
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 4, // Text Input
              custom_id: 'message_input',
              value: userInput,
            },
          ],
        },
      ],
    },
    channel_id: '123456789012345678',
    user: {
      id: '987654321098765432',
      username: 'testuser',
      discriminator: '1234',
    },
    token: 'test_token_for_modal_submit',
    version: 1,
    app_permissions: '0',
  };
}

// Mock the relay module
vi.mock('../../src/relay', () => ({
  createRelayClient: vi.fn(() => ({
    chat: vi.fn().mockResolvedValue({
      id: 'test-id',
      choices: [{ message: { content: 'Test response' } }],
    }),
  })),
  getUserErrorMessage: vi.fn((error: unknown) => {
    if (error instanceof Error) return error.message;
    return 'Unknown error';
  }),
}));

/**
 * Helper to generate a valid keypair and sign messages
 */
function createSigningKeypair() {
  const keypair = nacl.sign.keyPair();
  return {
    publicKey: Buffer.from(keypair.publicKey).toString('hex'),
    secretKey: Buffer.from(keypair.secretKey).toString('hex'),
    keypair,
  };
}

/**
 * Sign a message with a secret key
 */
function signMessage(body: string, timestamp: string, secretKeyHex: string): string {
  const message = new TextEncoder().encode(timestamp + body);
  const secretKey = Buffer.from(secretKeyHex, 'hex');
  const signature = nacl.sign.detached(message, secretKey);
  return Buffer.from(signature).toString('hex');
}

/**
 * Create a properly signed request for testing the handler
 */
function createSignedRequest(body: object, publicKey: string, secretKey: string): Request {
  const bodyString = JSON.stringify(body);
  const timestamp = Date.now().toString();
  const signature = signMessage(bodyString, timestamp, secretKey);

  return new Request('http://test.local/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature-ed25519': signature,
      'x-signature-timestamp': timestamp,
    },
    body: bodyString,
  });
}

describe('Slash Command Handling', () => {
  let testEnv: TestEnv;
  let signingData: ReturnType<typeof createSigningKeypair>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Generate a fresh keypair for each test
    signingData = createSigningKeypair();

    testEnv = createTestEnv({
      DISCORD_PUBLIC_KEY: signingData.publicKey,
      CONVERSATION_KV: createMockKV(),
    });
  });

  describe('PING Interaction', () => {
    it('should return PONG (type: 1) for PING interaction', async () => {
      const interaction = createPingInteraction();
      const request = createSignedRequest(
        interaction,
        signingData.publicKey,
        signingData.secretKey
      );

      const response = await handleInteraction(request, testEnv);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ type: 1 }); // PONG
    });
  });

  describe('Unknown Commands', () => {
    it('should handle unknown command gracefully', async () => {
      const interaction = createUnknownCommandInteraction('unknown_command');

      // Direct call to handleCommand (skipping signature verification)
      const response = await handleCommand(interaction as any, testEnv, createMockCtx());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(body.data.content).toContain('Unknown command');
    });

    it('should handle command without data gracefully', async () => {
      const interaction = {
        ...createChatInteraction('test'),
        data: undefined,
      };

      const response = await handleCommand(interaction as any, testEnv, createMockCtx());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.content).toContain('Unknown command');
    });
  });

  describe('/chat Command', () => {
    it('should require message content', async () => {
      const interaction = {
        ...createChatInteraction(''),
        data: {
          id: '111222333444555666',
          name: 'chat',
          type: 1,
          options: [], // No message option
        },
      };

      const response = await handleCommand(interaction as any, testEnv, createMockCtx());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      // Error message is in English by default
      expect(body.data.content).toContain('provide a message');
    });

    it('should handle chat command with message', async () => {
      // This test verifies the command structure is correct
      const interaction = createChatInteraction('Hello, bot!');

      // The relay client is mocked, so we just verify the response structure
      const response = await handleCommand(interaction as any, testEnv, createMockCtx());

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.type).toBe(InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE);
    });
  });

  describe('Environment Variables', () => {
    it('should handle missing FIRELA_BOT_API_KEY', () => {
      // We need to use the actual createRelayClient, not the mock
      vi.doMock('../../src/relay', () => ({
        createRelayClient: vi.fn(), // Will use actual implementation
        getUserErrorMessage: vi.fn(),
      }));

      const envWithoutKey = createTestEnv({
        DISCORD_PUBLIC_KEY: signingData.publicKey,
        FIRELA_BOT_API_KEY: '',
      });

      // The actual createRelayClient throws synchronously
      expect(() => {
        // Import the actual implementation
        const { createRelayClient: actualCreateRelayClient } = require('../../src/relay');
        actualCreateRelayClient(envWithoutKey as any);
      }).toThrow();
    });

    it('should handle missing RELAY_URL', () => {
      const envWithoutUrl = createTestEnv({
        DISCORD_PUBLIC_KEY: signingData.publicKey,
        RELAY_URL: '',
      });

      // The actual createRelayClient throws synchronously
      expect(() => {
        const { createRelayClient: actualCreateRelayClient } = require('../../src/relay');
        actualCreateRelayClient(envWithoutUrl as any);
      }).toThrow();
    });
  });

  describe('Signature Verification in Handler', () => {
    it('should reject request with missing signature headers', async () => {
      const interaction = createPingInteraction();
      const request = new Request('http://test.local/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Missing x-signature-ed25519 and x-signature-timestamp
        },
        body: JSON.stringify(interaction),
      });

      const response = await handleInteraction(request, testEnv);

      expect(response.status).toBe(401);
      expect(await response.text()).toContain('Missing signature headers');
    });

    it('should reject request with invalid signature', async () => {
      const interaction = createPingInteraction();
      const request = new Request('http://test.local/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-signature-ed25519': 'a'.repeat(128), // Invalid signature
          'x-signature-timestamp': Date.now().toString(),
        },
        body: JSON.stringify(interaction),
      });

      const response = await handleInteraction(request, testEnv);

      expect(response.status).toBe(401);
      expect(await response.text()).toContain('Invalid signature');
    });

    it('should reject request with invalid JSON body', async () => {
      const request = new Request('http://test.local/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-signature-ed25519': 'a'.repeat(128),
          'x-signature-timestamp': Date.now().toString(),
        },
        body: 'not valid json',
      });

      // Even with invalid JSON, the signature verification happens first
      // and fails, so we get 401
      const response = await handleInteraction(request, testEnv);

      expect(response.status).toBe(401);
    });
  });

  describe('Button Interactions', () => {
    it('should return modal for continue button click', async () => {
      const interaction = createButtonInteraction(ChatButtonCustomId.CONTINUE);
      const ctx = createMockCtx();

      const response = await handleButtonInteraction(interaction as any, testEnv, ctx);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.type).toBe(InteractionResponseType.MODAL);
      expect(body.data.custom_id).toBe(ChatButtonCustomId.MODAL_SUBMIT);
      // Default title is in English
      expect(body.data.title).toBe('Continue Chat');
    });

    it('should return ephemeral message for clear context button', async () => {
      const interaction = createButtonInteraction(ChatButtonCustomId.CLEAR);
      const ctx = createMockCtx();

      const response = await handleButtonInteraction(interaction as any, testEnv, ctx);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      // Default message is in English
      expect(body.data.content).toContain('cleared');
      expect(body.data.flags).toBe(64); // Ephemeral
      expect(ctx.waitUntil).toHaveBeenCalled();
    });

    it('should handle unknown button custom_id', async () => {
      const interaction = createButtonInteraction('unknown_button');
      const ctx = createMockCtx();

      const response = await handleButtonInteraction(interaction as any, testEnv, ctx);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      // Default message is in English
      expect(body.data.content).toContain('Unknown');
    });
  });

  describe('Modal Submit Interactions', () => {
    it('should return deferred response for modal submit with input', async () => {
      const interaction = createModalSubmitInteraction('Hello from modal!');
      const ctx = createMockCtx();

      const response = await handleModalSubmit(interaction as any, testEnv, ctx);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.type).toBe(InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE);
      expect(ctx.waitUntil).toHaveBeenCalled();
    });

    it('should return error for modal submit without input', async () => {
      const interaction = createModalSubmitInteraction('');
      // Simulate missing components
      interaction.data!.components = [];

      const ctx = createMockCtx();

      const response = await handleModalSubmit(interaction as any, testEnv, ctx);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      // Default message is in English
      expect(body.data.content).toContain('No input');
      expect(body.data.flags).toBe(64); // Ephemeral
    });
  });
});
