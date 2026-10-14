import { describe, it, expect } from 'vitest';
import {
  encryptCredential,
  decryptCredential,
  isEncryptedCredential,
  maskCredential,
} from './crypto';

describe('AES-256-GCM Credential Encryption', () => {
  it('should encrypt plaintext into an enc:v1: formatted string', () => {
    const rawSecret = 'safaricom_consumer_secret_xyz123!';
    const encrypted = encryptCredential(rawSecret);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(rawSecret);
    expect(isEncryptedCredential(encrypted)).toBe(true);
    expect(encrypted?.startsWith('enc:v1:')).toBe(true);
  });

  it('should correctly decrypt ciphertext back to original plaintext', () => {
    const rawPasskey = 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
    const encrypted = encryptCredential(rawPasskey);
    const decrypted = decryptCredential(encrypted);

    expect(decrypted).toBe(rawPasskey);
  });

  it('should be idempotent if encryptCredential is run multiple times on already encrypted text', () => {
    const raw = 'my_daraja_key';
    const firstEnc = encryptCredential(raw);
    const secondEnc = encryptCredential(firstEnc);

    expect(secondEnc).toBe(firstEnc);
    expect(decryptCredential(secondEnc)).toBe(raw);
  });

  it('should return null or empty string gracefully for nullish inputs', () => {
    expect(encryptCredential(null)).toBeNull();
    expect(encryptCredential('')).toBeNull();
    expect(decryptCredential(null)).toBeNull();
    expect(decryptCredential('')).toBeNull();
  });

  it('should return unencrypted legacy strings as-is for backward compatibility', () => {
    const legacyPlain = 'legacy_unencrypted_secret';
    expect(decryptCredential(legacyPlain)).toBe(legacyPlain);
  });

  it('should mask credentials properly', () => {
    expect(maskCredential('secret_key_12345')).toBe('••••••••••••');
    expect(maskCredential(null)).toBe('');
    expect(maskCredential('')).toBe('');
  });
});
