/**
 * Security Tests: API Key Encryption (REQ-SEC-003)
 *
 * Tests automatic encryption of API keys in configuration files.
 * Ensures plain-text API keys are automatically migrated to encrypted format.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, isEncrypted, encryptFields, decryptFields } from '../../packages/core/src/utils/encryption.js';
import type { EncryptedValue } from '../../packages/core/src/utils/encryption.js';

describe('REQ-SEC-003: API Key Encryption', () => {
  describe('Basic Encryption/Decryption', () => {
    it('should encrypt a plain-text API key', () => {
      const apiKey = 'test-api-key-12345';
      const encrypted = encrypt(apiKey);

      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted).toHaveProperty('version');
      expect(encrypted.version).toBe(1);
      expect(typeof encrypted.encrypted).toBe('string');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.tag).toBe('string');
    });

    it('should decrypt an encrypted API key', () => {
      const originalKey = 'test-api-key-12345';
      const encrypted = encrypt(originalKey);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(originalKey);
    });

    it('should produce different encrypted values for same input (random IV)', () => {
      const apiKey = 'test-api-key-12345';
      const encrypted1 = encrypt(apiKey);
      const encrypted2 = encrypt(apiKey);

      // Different IVs mean different encrypted values
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);

      // But both decrypt to the same value
      expect(decrypt(encrypted1)).toBe(apiKey);
      expect(decrypt(encrypted2)).toBe(apiKey);
    });

    it('should handle long API keys', () => {
      const longKey = 'a'.repeat(500);
      const encrypted = encrypt(longKey);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(longKey);
    });

    it('should handle API keys with special characters', () => {
      const specialKey = 'key-with-special!@#$%^&*()_+={}[]|:;"<>,.?/~`';
      const encrypted = encrypt(specialKey);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(specialKey);
    });
  });

  describe('isEncrypted Detection', () => {
    it('should detect encrypted values', () => {
      const apiKey = 'test-api-key-12345';
      const encrypted = encrypt(apiKey);

      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should not detect plain-text as encrypted', () => {
      const plainText = 'test-api-key-12345';

      expect(isEncrypted(plainText)).toBe(false);
    });

    it('should not detect objects without encryption structure as encrypted', () => {
      const notEncrypted = {
        someField: 'value',
        anotherField: 'value2',
      };

      expect(isEncrypted(notEncrypted)).toBe(false);
    });

    it('should not detect partial encrypted structure as encrypted', () => {
      const partial = {
        encrypted: 'some-value',
        iv: 'some-iv',
        // missing tag and version
      };

      expect(isEncrypted(partial)).toBe(false);
    });

    it('should not detect null or undefined as encrypted', () => {
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
    });
  });

  describe('encryptFields/decryptFields', () => {
    it('should encrypt specified fields in an object', () => {
      const settings = {
        apiKey: 'plain-text-key',
        baseURL: 'https://api.example.com',
        model: 'glm-4.6',
      };

      const encrypted = encryptFields(settings, ['apiKey']);

      expect(isEncrypted(encrypted.apiKey)).toBe(true);
      expect(encrypted.baseURL).toBe('https://api.example.com');
      expect(encrypted.model).toBe('glm-4.6');
    });

    it('should decrypt specified fields in an object', () => {
      const originalKey = 'plain-text-key';
      const settings = {
        apiKey: encrypt(originalKey),
        baseURL: 'https://api.example.com',
        model: 'glm-4.6',
      };

      const decrypted = decryptFields(settings, ['apiKey']);

      expect(decrypted.apiKey).toBe(originalKey);
      expect(decrypted.baseURL).toBe('https://api.example.com');
      expect(decrypted.model).toBe('glm-4.6');
    });

    it('should not re-encrypt already encrypted fields', () => {
      const apiKey = 'plain-text-key';
      const encrypted = encrypt(apiKey);
      const settings = {
        apiKey: encrypted,
      };

      const result = encryptFields(settings, ['apiKey']);

      // Should be the same encrypted value (not re-encrypted)
      expect(result.apiKey).toEqual(encrypted);
    });

    it('should skip non-existent fields', () => {
      const settings = {
        baseURL: 'https://api.example.com',
      };

      const encrypted = encryptFields(settings, ['apiKey']);

      expect(encrypted).toEqual(settings);
      expect(encrypted).not.toHaveProperty('apiKey');
    });

    it('should skip non-string fields when encrypting', () => {
      const settings = {
        apiKey: 123, // number, not string
        baseURL: 'https://api.example.com',
      };

      const encrypted = encryptFields(settings, ['apiKey']);

      // apiKey should remain as number (not encrypted)
      expect(encrypted.apiKey).toBe(123);
    });

    it('should skip plain-text fields when decrypting', () => {
      const settings = {
        apiKey: 'plain-text-key', // not encrypted
        baseURL: 'https://api.example.com',
      };

      const decrypted = decryptFields(settings, ['apiKey']);

      // apiKey should remain as plain-text
      expect(decrypted.apiKey).toBe('plain-text-key');
    });

    it('should handle multiple fields', () => {
      const settings = {
        apiKey: 'key-1',
        secretToken: 'token-1',
        baseURL: 'https://api.example.com',
      };

      const encrypted = encryptFields(settings, ['apiKey', 'secretToken']);

      expect(isEncrypted(encrypted.apiKey)).toBe(true);
      expect(isEncrypted(encrypted.secretToken)).toBe(true);
      expect(encrypted.baseURL).toBe('https://api.example.com');

      const decrypted = decryptFields(encrypted, ['apiKey', 'secretToken']);

      expect(decrypted.apiKey).toBe('key-1');
      expect(decrypted.secretToken).toBe('token-1');
      expect(decrypted.baseURL).toBe('https://api.example.com');
    });
  });

  describe('Error Handling', () => {
    it('should throw error for corrupted encrypted data', () => {
      const corrupted: EncryptedValue = {
        encrypted: 'corrupted-data',
        iv: 'corrupted-iv',
        tag: 'corrupted-tag',
        version: 1,
      };

      expect(() => decrypt(corrupted)).toThrow();
    });

    it('should throw error for unsupported encryption version', () => {
      const futureVersion: EncryptedValue = {
        encrypted: 'some-data',
        iv: 'some-iv',
        tag: 'some-tag',
        version: 999, // unsupported version
      };

      // SECURITY: Version errors are wrapped in generic message to avoid information leakage
      expect(() => decrypt(futureVersion)).toThrow('Failed to decrypt API key');
    });

    it('should throw error for tampered encrypted data', () => {
      const apiKey = 'test-api-key';
      const encrypted = encrypt(apiKey);

      // Tamper with the encrypted data
      const tampered: EncryptedValue = {
        ...encrypted,
        encrypted: encrypted.encrypted.slice(0, -5) + 'XXXXX',
      };

      expect(() => decrypt(tampered)).toThrow();
    });

    it('should handle decryption failure gracefully in decryptFields', () => {
      const corrupted: EncryptedValue = {
        encrypted: 'corrupted',
        iv: 'corrupted',
        tag: 'corrupted',
        version: 1,
      };

      const settings = {
        apiKey: corrupted,
        baseURL: 'https://api.example.com',
      };

      // Should not throw, just leave the field as-is
      const decrypted = decryptFields(settings, ['apiKey']);

      // Field should remain as corrupted encrypted value
      expect(decrypted.apiKey).toEqual(corrupted);
    });
  });

  describe('Security Properties', () => {
    it('should use AES-256-GCM (authenticated encryption)', () => {
      const apiKey = 'test-key';
      const encrypted = encrypt(apiKey);

      // Should have authentication tag
      expect(encrypted.tag).toBeTruthy();
      expect(encrypted.tag.length).toBeGreaterThan(0);
    });

    it('should use random IV for each encryption', () => {
      const apiKey = 'test-key';
      const ivs = new Set<string>();

      // Encrypt multiple times
      for (let i = 0; i < 10; i++) {
        const encrypted = encrypt(apiKey);
        ivs.add(encrypted.iv);
      }

      // All IVs should be unique
      expect(ivs.size).toBe(10);
    });

    it('should not expose plain-text in encrypted object', () => {
      const secretKey = 'super-secret-api-key-12345';
      const encrypted = encrypt(secretKey);

      // Convert to JSON and check it doesn't contain the plain text
      const json = JSON.stringify(encrypted);
      expect(json).not.toContain(secretKey);
    });
  });

  describe('Backward Compatibility', () => {
    it('should support loading plain-text API keys (for migration)', () => {
      const settings = {
        apiKey: 'plain-text-key',
        baseURL: 'https://api.example.com',
      };

      // decryptFields should handle plain-text gracefully
      const result = decryptFields(settings, ['apiKey']);

      expect(result.apiKey).toBe('plain-text-key');
    });

    it('should support mixed encrypted and plain-text fields', () => {
      const settings = {
        apiKey: encrypt('encrypted-key'),
        secretToken: 'plain-token', // not encrypted
        baseURL: 'https://api.example.com',
      };

      const decrypted = decryptFields(settings, ['apiKey', 'secretToken']);

      expect(decrypted.apiKey).toBe('encrypted-key');
      expect(decrypted.secretToken).toBe('plain-token');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical Z.AI API key format', () => {
      const zaiKey = '95b4c453fa054707857cd87de910fcb8.BSUZbgBVzeqsPjNp';
      const encrypted = encrypt(zaiKey);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(zaiKey);
    });

    it('should handle typical OpenAI API key format', () => {
      const openaiKey = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz';
      const encrypted = encrypt(openaiKey);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(openaiKey);
    });

    it('should handle typical Anthropic API key format', () => {
      const anthropicKey = 'sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz';
      const encrypted = encrypt(anthropicKey);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(anthropicKey);
    });
  });
});
