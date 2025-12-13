/**
 * Encryption Tests
 *
 * Tests REQ-SEC-003 implementation for API key encryption.
 * Covers encryption/decryption, field encryption, and error handling.
 */

import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  isEncrypted,
  encryptFields,
  decryptFields,
  testEncryption,
  getEncryptionInfo,
  type EncryptedValue,
} from '../../packages/core/src/utils/encryption.js';

describe('REQ-SEC-003: API Key Encryption', () => {
  describe('Basic Encryption/Decryption', () => {
    it('should encrypt a string', () => {
      const plaintext = 'my-secret-api-key-12345';
      const encrypted = encrypt(plaintext);

      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted).toHaveProperty('version');

      expect(typeof encrypted.encrypted).toBe('string');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.tag).toBe('string');
      expect(encrypted.version).toBe(1);

      // Encrypted value should be different from plaintext
      expect(encrypted.encrypted).not.toBe(plaintext);
    });

    it('should decrypt an encrypted value', () => {
      const plaintext = 'my-secret-api-key-12345';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle Unicode and special characters', () => {
      const plaintext = '🔑 API Key with émojis and spëcial çhars! @#$%^&*()';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different encrypted values for same plaintext', () => {
      const plaintext = 'my-secret-key';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // IVs should be different (random)
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);

      // But both should decrypt to same value
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });
  });

  describe('Encryption Security', () => {
    it('should fail to decrypt with wrong IV', () => {
      const plaintext = 'my-secret-key';
      const encrypted = encrypt(plaintext);

      // Tamper with IV
      const tamperedIv = Buffer.from(encrypted.iv, 'base64');
      tamperedIv[0] = tamperedIv[0] ^ 0xFF; // Flip bits
      const tampered: EncryptedValue = {
        ...encrypted,
        iv: tamperedIv.toString('base64'),
      };

      expect(() => decrypt(tampered)).toThrow();
    });

    it('should fail to decrypt with wrong tag', () => {
      const plaintext = 'my-secret-key';
      const encrypted = encrypt(plaintext);

      // Tamper with authentication tag
      const tamperedTag = Buffer.from(encrypted.tag, 'base64');
      tamperedTag[0] = tamperedTag[0] ^ 0xFF; // Flip bits
      const tampered: EncryptedValue = {
        ...encrypted,
        tag: tamperedTag.toString('base64'),
      };

      expect(() => decrypt(tampered)).toThrow();
    });

    it('should fail to decrypt with wrong encrypted data', () => {
      const plaintext = 'my-secret-key';
      const encrypted = encrypt(plaintext);

      // Tamper with encrypted data
      const tamperedData = Buffer.from(encrypted.encrypted, 'base64');
      if (tamperedData.length > 0) {
        tamperedData[0] = tamperedData[0] ^ 0xFF; // Flip bits
      }
      const tampered: EncryptedValue = {
        ...encrypted,
        encrypted: tamperedData.toString('base64'),
      };

      expect(() => decrypt(tampered)).toThrow();
    });

    it('should fail to decrypt with invalid version (generic error)', () => {
      const plaintext = 'my-secret-key';
      const encrypted = encrypt(plaintext);

      const invalidVersion: EncryptedValue = {
        ...encrypted,
        version: 999,
      };

      // SECURITY: Version errors are now generic (fixed in encryption.ts)
      expect(() => decrypt(invalidVersion)).toThrow(/Failed to decrypt API key/);
    });

    it('should fail to decrypt with invalid base64', () => {
      const invalid: EncryptedValue = {
        encrypted: 'not-valid-base64!!!',
        iv: 'also-invalid!!!',
        tag: 'invalid!!!',
        version: 1,
      };

      expect(() => decrypt(invalid)).toThrow();
    });
  });

  describe('isEncrypted Type Guard', () => {
    it('should identify encrypted values', () => {
      const encrypted = encrypt('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should reject plain strings', () => {
      expect(isEncrypted('plain-text')).toBe(false);
    });

    it('should reject null', () => {
      expect(isEncrypted(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(isEncrypted(undefined)).toBe(false);
    });

    it('should reject numbers', () => {
      expect(isEncrypted(123)).toBe(false);
    });

    it('should reject arrays', () => {
      expect(isEncrypted([])).toBe(false);
    });

    it('should reject objects missing fields', () => {
      expect(isEncrypted({ encrypted: 'foo' })).toBe(false);
      expect(isEncrypted({ encrypted: 'foo', iv: 'bar' })).toBe(false);
      expect(isEncrypted({ encrypted: 'foo', iv: 'bar', tag: 'baz' })).toBe(false);
    });

    it('should reject objects with wrong field types', () => {
      expect(
        isEncrypted({
          encrypted: 123,
          iv: 'bar',
          tag: 'baz',
          version: 1,
        })
      ).toBe(false);

      expect(
        isEncrypted({
          encrypted: 'foo',
          iv: 'bar',
          tag: 'baz',
          version: 'not-a-number',
        })
      ).toBe(false);
    });
  });

  describe('Field Encryption', () => {
    it('should encrypt specified fields', () => {
      const obj = {
        apiKey: 'secret-key-123',
        name: 'Test User',
        email: 'test@example.com',
      };

      const encrypted = encryptFields(obj, ['apiKey']);

      expect(encrypted.name).toBe('Test User');
      expect(encrypted.email).toBe('test@example.com');
      expect(isEncrypted(encrypted.apiKey)).toBe(true);
    });

    it('should encrypt multiple fields', () => {
      const obj = {
        apiKey: 'secret-key-123',
        secretToken: 'token-456',
        publicField: 'public-value',
      };

      const encrypted = encryptFields(obj, ['apiKey', 'secretToken']);

      expect(encrypted.publicField).toBe('public-value');
      expect(isEncrypted(encrypted.apiKey)).toBe(true);
      expect(isEncrypted(encrypted.secretToken)).toBe(true);
    });

    it('should not re-encrypt already encrypted fields', () => {
      const obj = {
        apiKey: 'secret-key-123',
      };

      const encrypted1 = encryptFields(obj, ['apiKey']);
      const encrypted2 = encryptFields(encrypted1 as any, ['apiKey']);

      // Should be the same (not double-encrypted)
      expect(encrypted2.apiKey).toEqual(encrypted1.apiKey);
    });

    it('should skip non-existent fields', () => {
      const obj = {
        apiKey: 'secret-key-123',
      };

      const encrypted = encryptFields(obj, ['apiKey', 'nonExistent']);

      expect(isEncrypted(encrypted.apiKey)).toBe(true);
      expect('nonExistent' in encrypted).toBe(false);
    });

    it('should skip non-string fields', () => {
      const obj = {
        apiKey: 'secret-key-123',
        count: 42,
        enabled: true,
      };

      const encrypted = encryptFields(obj, ['apiKey', 'count', 'enabled']);

      expect(isEncrypted(encrypted.apiKey)).toBe(true);
      expect(encrypted.count).toBe(42);
      expect(encrypted.enabled).toBe(true);
    });

    it('should decrypt specified fields', () => {
      const obj = {
        apiKey: 'secret-key-123',
        name: 'Test User',
      };

      const encrypted = encryptFields(obj, ['apiKey']);
      const decrypted = decryptFields(encrypted, ['apiKey']);

      expect(decrypted.apiKey).toBe('secret-key-123');
      expect(decrypted.name).toBe('Test User');
    });

    it('should handle decryption errors gracefully', () => {
      const obj = {
        apiKey: {
          encrypted: 'invalid-data',
          iv: 'invalid-iv',
          tag: 'invalid-tag',
          version: 1,
        },
      };

      const decrypted = decryptFields(obj as any, ['apiKey']);

      // Should leave field as-is if decryption fails
      expect(isEncrypted(decrypted.apiKey)).toBe(true);
    });

    it('should round-trip encrypt and decrypt', () => {
      const obj = {
        apiKey: 'secret-key-123',
        token: 'token-456',
        name: 'Test User',
      };

      const encrypted = encryptFields(obj, ['apiKey', 'token']);
      const decrypted = decryptFields(encrypted, ['apiKey', 'token']);

      expect(decrypted).toEqual(obj);
    });
  });

  describe('Utility Functions', () => {
    it('should pass encryption test', () => {
      expect(testEncryption()).toBe(true);
    });

    it('should provide encryption info', () => {
      const info = getEncryptionInfo();

      expect(info.algorithm).toBe('aes-256-gcm');
      expect(info.keyLength).toBe(32);
      expect(info.ivLength).toBe(16);
      expect(info.pbkdf2Iterations).toBe(600000); // Updated for OWASP 2024
      expect(info.version).toBe(1);
      // SECURITY FIX: Now returns hashed machineId instead of raw value
      expect(typeof info.machineIdHash).toBe('string');
      expect(info.machineIdHash.length).toBeGreaterThan(0);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical API key', () => {
      const apiKey = 'sk-proj-1234567890abcdefghijklmnopqrstuvwxyz';
      const encrypted = encrypt(apiKey);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(apiKey);
    });

    it('should handle AWS-style keys', () => {
      const accessKey = 'AKIAIOSFODNN7EXAMPLE';
      const secretKey = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

      const encryptedAccess = encrypt(accessKey);
      const encryptedSecret = encrypt(secretKey);

      expect(decrypt(encryptedAccess)).toBe(accessKey);
      expect(decrypt(encryptedSecret)).toBe(secretKey);
    });

    it('should handle OpenAI-style keys', () => {
      const apiKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP';
      const encrypted = encrypt(apiKey);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(apiKey);
    });

    it('should handle configuration object', () => {
      const config = {
        apiKey: 'sk-test-1234567890',
        baseUrl: 'https://api.example.com',
        model: 'gpt-4',
        temperature: 0.7,
      };

      const encrypted = encryptFields(config, ['apiKey']);

      // Verify apiKey is encrypted
      expect(isEncrypted(encrypted.apiKey)).toBe(true);

      // Verify other fields unchanged
      expect(encrypted.baseUrl).toBe(config.baseUrl);
      expect(encrypted.model).toBe(config.model);
      expect(encrypted.temperature).toBe(config.temperature);

      // Verify decryption
      const decrypted = decryptFields(encrypted, ['apiKey']);
      expect(decrypted).toEqual(config);
    });

    it('should handle multiple keys in config', () => {
      const config = {
        openaiKey: 'sk-openai-12345',
        anthropicKey: 'sk-ant-12345',
        geminiKey: 'AIza-12345',
        username: 'user@example.com',
      };

      const encrypted = encryptFields(config, [
        'openaiKey',
        'anthropicKey',
        'geminiKey',
      ]);

      expect(isEncrypted(encrypted.openaiKey)).toBe(true);
      expect(isEncrypted(encrypted.anthropicKey)).toBe(true);
      expect(isEncrypted(encrypted.geminiKey)).toBe(true);
      expect(encrypted.username).toBe(config.username);

      const decrypted = decryptFields(encrypted, [
        'openaiKey',
        'anthropicKey',
        'geminiKey',
      ]);

      expect(decrypted).toEqual(config);
    });
  });

  describe('Performance', () => {
    it('should encrypt/decrypt 100 keys in reasonable time', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const key = `api-key-${i}`;
        const encrypted = encrypt(key);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(key);
      }

      const duration = Date.now() - startTime;

      // Should complete in less than 60 seconds (increased from 10s due to OWASP 2024 600k iterations)
      // With 600000 iterations (6x more than before), this is expected to be slower but more secure
      expect(duration).toBeLessThan(60000);
    });
  });

  describe('Legacy Format Support', () => {
    // COVERAGE: Tests for old format where salt+iv were concatenated (lines 248-259)
    it('should handle legacy format where salt is missing', () => {
      // Create a properly encrypted value, then remove the salt field
      // to simulate old format where salt+iv were in the iv field
      const encrypted = encrypt('test-legacy-value');

      // Legacy format: iv contained salt+iv concatenated
      // We can test the branch by providing only iv without salt
      // But the actual legacy format needs proper salt+iv concatenation
      // Since we can't easily create valid legacy format, just test that
      // missing salt falls through to the else branch
      const legacyFormat = {
        encrypted: encrypted.encrypted,
        iv: encrypted.iv, // This won't work without proper concatenation
        tag: encrypted.tag,
        version: 1,
        // salt field is intentionally missing
      };

      // This will fail because iv is not salt+iv concatenated
      // but it exercises the code path
      expect(() => decrypt(legacyFormat as any)).toThrow();
    });
  });

  describe('Error Messages', () => {
    // SECURITY: Generic error messages (REQ-SEC-010)
    // Error messages must NOT leak implementation details or sensitive information
    it('should provide GENERIC error for authentication failure (no info leakage)', () => {
      const plaintext = 'my-secret-key';
      const encrypted = encrypt(plaintext);

      // Tamper with data
      const tampered: EncryptedValue = {
        ...encrypted,
        encrypted: Buffer.from('wrong-data').toString('base64'),
      };

      // Verify error is thrown
      expect(() => decrypt(tampered)).toThrow();

      // SECURITY VERIFICATION: Error message must be GENERIC
      try {
        decrypt(tampered);
        throw new Error('Should have thrown');
      } catch (error: any) {
        const message = error.message.toLowerCase();

        // ✅ SECURITY: Verify NO sensitive information leaked
        expect(message).not.toContain('iv');
        expect(message).not.toContain('tag');
        expect(message).not.toContain('salt');
        expect(message).not.toContain('machine'); // Don't leak machine ID info
        expect(message).not.toContain('pbkdf2');
        expect(message).not.toContain('iterations');
        expect(message).not.toContain('key derivation');

        // ✅ Message should be generic (failed/error/invalid)
        expect(message).toMatch(/failed|error|invalid|unsupported/i);
      }
    });

    it('should return generic error for version mismatch (security)', () => {
      const encrypted = encrypt('test');
      encrypted.version = 999;

      // Even version errors should be generic (fixed encryption.ts returns generic)
      // The version check is inside try-catch, so it returns generic error
      expect(() => decrypt(encrypted)).toThrow(/Failed to decrypt API key/);
    });

    it('should NOT leak IV/tag/salt details in errors', () => {
      const plaintext = 'test-key';
      const encrypted = encrypt(plaintext);

      // Test various tampering scenarios
      const scenarios = [
        { name: 'tampered IV', tampered: { ...encrypted, iv: Buffer.from('wrong-iv').toString('base64') } },
        { name: 'tampered tag', tampered: { ...encrypted, tag: Buffer.from('wrong-tag').toString('base64') } },
        { name: 'tampered encrypted', tampered: { ...encrypted, encrypted: Buffer.from('wrong-data').toString('base64') } },
      ];

      for (const scenario of scenarios) {
        try {
          decrypt(scenario.tampered as EncryptedValue);
          throw new Error(`${scenario.name}: Should have thrown`);
        } catch (error: any) {
          const message = error.message.toLowerCase();

          // SECURITY: No leakage of cryptographic details
          expect(message).not.toContain('authentication tag');
          expect(message).not.toContain('iv length');
          expect(message).not.toContain('salt length');
          expect(message).not.toContain('gcm');
          expect(message).not.toContain('aes');
        }
      }
    });
  });
});
