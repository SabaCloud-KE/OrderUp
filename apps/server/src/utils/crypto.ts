import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const IV_LENGTH = 12; // Standard 96-bit IV recommended for AES-GCM

/**
 * Derives a deterministic 32-byte cryptographic key for AES-256.
 */
function getEncryptionKey(): Buffer {
  const secretSource =
    process.env.CREDENTIALS_ENCRYPTION_KEY ||
    env.JWT_ACCESS_SECRET ||
    'orderup-daraja-credentials-encryption-key-2026';
  return crypto.createHash('sha256').update(secretSource).digest();
}

/**
 * Checks whether a given string is already encrypted with our format.
 */
export function isEncryptedCredential(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/**
 * Encrypts a sensitive credential (e.g. Daraja Consumer Secret or Passkey) using AES-256-GCM.
 * Stored format: enc:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 * Idempotent: If value is already encrypted, returns it unchanged.
 */
export function encryptCredential(plaintext: string | null | undefined): string | null {
  if (!plaintext || typeof plaintext !== 'string') {
    return null;
  }

  const trimmed = plaintext.trim();
  if (!trimmed) {
    return null;
  }

  // Already encrypted
  if (isEncryptedCredential(trimmed)) {
    return trimmed;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (error: any) {
    logger.error(`[Crypto] Encryption failure: ${error.message}`);
    throw new Error('Failed to encrypt sensitive credential');
  }
}

/**
 * Decrypts an AES-256-GCM encrypted credential back to plaintext.
 * If the string was not encrypted (legacy plain string), returns it as-is.
 */
export function decryptCredential(ciphertext: string | null | undefined): string | null {
  if (!ciphertext || typeof ciphertext !== 'string') {
    return null;
  }

  const trimmed = ciphertext.trim();
  if (!trimmed) {
    return null;
  }

  // If not encrypted, return as-is for backward compatibility
  if (!isEncryptedCredential(trimmed)) {
    return trimmed;
  }

  try {
    const key = getEncryptionKey();
    const payload = trimmed.slice(PREFIX.length);
    const parts = payload.split(':');

    if (parts.length !== 3) {
      logger.warn('[Crypto] Invalid encrypted payload structure');
      return null;
    }

    const [ivHex, tagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const encryptedText = Buffer.from(cipherHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (error: any) {
    logger.error(`[Crypto] Decryption failure (auth tag mismatch or corruption): ${error.message}`);
    return null;
  }
}

/**
 * Masks a sensitive credential so that it can be safely sent to the frontend without exposing plaintext.
 */
export function maskCredential(value: string | null | undefined): string {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return '';
  }
  return '••••••••••••';
}
