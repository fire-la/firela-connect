/**
 * Integration Test Configuration
 *
 * Test constants and configuration for integration tests.
 * Uses environment variables for sensitive data.
 */

/**
 * Test Discord credentials
 *
 * These can be overridden via environment variables for local testing.
 * In CI, these should be set as secrets.
 */
export const TEST_DISCORD = {
  /** Test public key for signature verification (32 bytes hex) */
  PUBLIC_KEY:
    process.env.TEST_DISCORD_PUBLIC_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  /** Test bot token */
  BOT_TOKEN: process.env.TEST_DISCORD_BOT_TOKEN || 'test-bot-token',
  /** Test application ID */
  APPLICATION_ID: process.env.TEST_DISCORD_APPLICATION_ID || '123456789012345678',
  /** Test setup password for register-commands endpoint */
  SETUP_PASSWORD: process.env.TEST_SETUP_PASSWORD || 'test-setup-password',
};

/**
 * Test relay configuration
 *
 * These are used for mock relay server configuration.
 */
export const TEST_RELAY = {
  /** Mock relay URL (used in tests) */
  URL: 'https://mock-relay.test.local',
  /** Test API key */
  API_KEY: process.env.TEST_FIRELA_BOT_API_KEY || 'test-api-key-12345',
  /** Default timeout for requests (ms) */
  TIMEOUT: 5000,
};

/**
 * Test timeout configurations
 */
export const TEST_TIMEOUTS = {
  /** Default test timeout (ms) */
  DEFAULT: 10000,
  /** Extended timeout for slow operations (ms) */
  EXTENDED: 30000,
  /** Short timeout for quick checks (ms) */
  SHORT: 1000,
};

/**
 * Mock Discord user data for tests
 */
export const TEST_USER = {
  id: '987654321098765432',
  username: 'testuser',
  discriminator: '1234',
  avatar: null,
};

/**
 * Mock Discord guild data for tests
 */
export const TEST_GUILD = {
  id: '111222333444555666',
  channel_id: '777888999000111222',
};

/**
 * Test environment configuration
 */
export function createTestEnv(overrides?: Partial<TestEnv>): TestEnv {
  return {
    DISCORD_PUBLIC_KEY: TEST_DISCORD.PUBLIC_KEY,
    DISCORD_BOT_TOKEN: TEST_DISCORD.BOT_TOKEN,
    DISCORD_APPLICATION_ID: TEST_DISCORD.APPLICATION_ID,
    FIRELA_BOT_API_KEY: TEST_RELAY.API_KEY,
    RELAY_URL: TEST_RELAY.URL,
    ENVIRONMENT: 'test',
    SETUP_PASSWORD: TEST_DISCORD.SETUP_PASSWORD,
    ...overrides,
  };
}

/**
 * Test environment interface
 */
export interface TestEnv {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_APPLICATION_ID: string;
  FIRELA_BOT_API_KEY: string;
  RELAY_URL: string;
  ENVIRONMENT?: string;
  SETUP_PASSWORD?: string;
  CONVERSATION_KV?: KVNamespace;
  DB?: D1Database;
  VECTORIZE?: VectorizeIndex;
}
