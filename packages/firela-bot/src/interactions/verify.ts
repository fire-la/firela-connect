/**
 * Discord Request Signature Verification
 *
 * Validates that incoming requests are genuinely from Discord
 * using Ed25519 cryptographic signatures.
 */

import nacl from 'tweetnacl';

/**
 * Verifies Discord request signature
 *
 * @param body - Raw request body as string
 * @param signature - x-signature-ed25519 header value (hex)
 * @param timestamp - x-signature-timestamp header value
 * @param publicKey - Discord application public key (hex)
 * @returns true if signature is valid
 */
export function verifyDiscordSignature(
  body: string,
  signature: string,
  timestamp: string,
  publicKey: string
): boolean {
  try {
    const message = new TextEncoder().encode(timestamp + body);
    const sigBytes = hexToUint8Array(signature);
    const pubKeyBytes = hexToUint8Array(publicKey);

    return nacl.sign.detached.verify(message, sigBytes, pubKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Converts a hexadecimal string to Uint8Array
 *
 * @param hex - Hexadecimal string (e.g., "a1b2c3...")
 * @returns Uint8Array representation
 */
function hexToUint8Array(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) {
    throw new Error('Invalid hex string');
  }
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}
