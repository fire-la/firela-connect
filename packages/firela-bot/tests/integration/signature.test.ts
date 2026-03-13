/**
 * Discord Signature Verification Tests
 *
 * Tests for Discord request signature verification flow:
 * - Valid signature accepted
 * - Invalid signature rejected (401)
 * - Missing signature headers rejected
 * - Tampered body rejected
 */

import { describe, it, expect, beforeEach } from 'vitest';
import nacl from 'tweetnacl';
import { verifyDiscordSignature } from '../../src/interactions/verify';
import { createPingInteraction, createTestEnv, type TestEnv } from './setup';

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

describe('Discord Signature Verification', () => {
  let testEnv: TestEnv;
  let signingData: ReturnType<typeof createSigningKeypair>;

  beforeEach(() => {
    // Generate a fresh keypair for each test
    signingData = createSigningKeypair();

    testEnv = createTestEnv({
      DISCORD_PUBLIC_KEY: signingData.publicKey,
    });
  });

  describe('verifyDiscordSignature', () => {
    it('should return true for valid signature', () => {
      const body = JSON.stringify(createPingInteraction());
      const timestamp = Date.now().toString();
      const signature = signMessage(body, timestamp, signingData.secretKey);

      const isValid = verifyDiscordSignature(
        body,
        signature,
        timestamp,
        signingData.publicKey
      );

      expect(isValid).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const body = JSON.stringify(createPingInteraction());
      const timestamp = Date.now().toString();

      // Use completely wrong signature
      const invalidSignature = 'a'.repeat(128);

      const isValid = verifyDiscordSignature(
        body,
        invalidSignature,
        timestamp,
        signingData.publicKey
      );

      expect(isValid).toBe(false);
    });

    it('should return false for tampered body', () => {
      const body = JSON.stringify(createPingInteraction());
      const timestamp = Date.now().toString();

      // Sign the original body
      const signature = signMessage(body, timestamp, signingData.secretKey);

      // Verify with tampered body
      const tamperedBody = body + 'tampered';
      const isValid = verifyDiscordSignature(
        tamperedBody,
        signature,
        timestamp,
        signingData.publicKey
      );

      expect(isValid).toBe(false);
    });

    it('should return false for wrong timestamp', () => {
      const body = JSON.stringify(createPingInteraction());
      const timestamp = Date.now().toString();
      const wrongTimestamp = (Date.now() - 10000).toString();

      // Sign with correct timestamp
      const signature = signMessage(body, timestamp, signingData.secretKey);

      // Verify with wrong timestamp
      const isValid = verifyDiscordSignature(
        body,
        signature,
        wrongTimestamp,
        signingData.publicKey
      );

      expect(isValid).toBe(false);
    });

    it('should return false for wrong public key', () => {
      const body = JSON.stringify(createPingInteraction());
      const timestamp = Date.now().toString();

      // Sign with original keypair
      const signature = signMessage(body, timestamp, signingData.secretKey);

      // Verify with wrong public key (generate a different one)
      const otherKeypair = createSigningKeypair();
      const isValid = verifyDiscordSignature(
        body,
        signature,
        timestamp,
        otherKeypair.publicKey
      );

      expect(isValid).toBe(false);
    });

    it('should return false for malformed signature', () => {
      const body = JSON.stringify(createPingInteraction());
      const timestamp = Date.now().toString();

      // Malformed signature (not valid hex)
      const malformedSignature = 'not-valid-hex!@#$';

      const isValid = verifyDiscordSignature(
        body,
        malformedSignature,
        timestamp,
        signingData.publicKey
      );

      expect(isValid).toBe(false);
    });

    it('should return false for malformed public key', () => {
      const body = JSON.stringify(createPingInteraction());
      const timestamp = Date.now().toString();
      const signature = signMessage(body, timestamp, signingData.secretKey);

      // Malformed public key (not valid hex)
      const malformedPublicKey = 'not-valid-hex!@#$';

      const isValid = verifyDiscordSignature(
        body,
        signature,
        timestamp,
        malformedPublicKey
      );

      expect(isValid).toBe(false);
    });
  });
});
