/**
 * API Key Encryption Utilities
 *
 * Provides secure encryption/decryption for API keys stored in configuration
 * files (REQ-SEC-003).
 *
 * Uses Node.js crypto module with:
 * - AES-256-GCM for encryption (authenticated encryption)
 * - PBKDF2 for key derivation from machine-specific identifier
 * - Random IV for each encryption
 * - Authentication tag verification
 *
 * @module encryption
 */

import crypto from 'crypto';
import os from 'os';

/**
 * Encrypted value format
 */
export interface EncryptedValue {
  encrypted: string; // Base64-encoded encrypted data
  iv: string; // Base64-encoded initialization vector
  tag: string; // Base64-encoded authentication tag
  version: number; // Encryption version for future upgrades
}

/**
 * Encryption configuration
 */
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm' as const,
  keyLength: 32, // 256 bits
  ivLength: 16, // 128 bits
  saltLength: 32, // 256 bits
  tagLength: 16, // 128 bits
  pbkdf2Iterations: 100000, // OWASP recommendation
  version: 1,
};

/**
 * Get a machine-specific identifier for key derivation.
 * Uses hostname + platform + arch to create a unique-per-machine string.
 *
 * Note: This is not cryptographically strong protection (attacker with file
 * access can derive the key), but it prevents casual browsing of config files
 * and provides defense in depth.
 */
function getMachineIdentifier(): string {
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();

  // Combine machine-specific data
  return `${hostname}-${platform}-${arch}`;
}

/**
 * Derive an encryption key from machine identifier and salt using PBKDF2.
 *
 * @param salt - Salt for key derivation
 * @returns Derived encryption key
 */
function deriveKey(salt: Buffer): Buffer {
  const machineId = getMachineIdentifier();

  return crypto.pbkdf2Sync(
    machineId,
    salt,
    ENCRYPTION_CONFIG.pbkdf2Iterations,
    ENCRYPTION_CONFIG.keyLength,
    'sha256'
  );
}

/**
 * Encrypt a string value (typically an API key).
 *
 * @param plaintext - The value to encrypt
 * @returns Encrypted value object with iv, tag, and encrypted data
 */
export function encrypt(plaintext: string): EncryptedValue {
  // Generate random salt and IV
  const salt = crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);
  const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);

  // Derive key from machine identifier
  const key = deriveKey(salt);

  // Create cipher
  const cipher = crypto.createCipheriv(
    ENCRYPTION_CONFIG.algorithm,
    key,
    iv
  );

  // Encrypt the plaintext
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get authentication tag
  const tag = cipher.getAuthTag();

  // Return encrypted value with metadata
  // Store salt in the IV field for simplicity (both are public)
  const saltAndIv = Buffer.concat([salt, iv]);

  return {
    encrypted,
    iv: saltAndIv.toString('base64'),
    tag: tag.toString('base64'),
    version: ENCRYPTION_CONFIG.version,
  };
}

/**
 * Decrypt an encrypted value.
 *
 * @param encryptedValue - The encrypted value object
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong machine, corrupted data, etc.)
 */
export function decrypt(encryptedValue: EncryptedValue): string {
  try {
    // Check version
    if (encryptedValue.version !== ENCRYPTION_CONFIG.version) {
      throw new Error(
        `Unsupported encryption version: ${encryptedValue.version}`
      );
    }

    // Extract salt and IV
    const saltAndIv = Buffer.from(encryptedValue.iv, 'base64');
    if (saltAndIv.length !== ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength) {
      throw new Error('Invalid encrypted data: incorrect salt/IV length');
    }

    const salt = saltAndIv.subarray(0, ENCRYPTION_CONFIG.saltLength);
    const iv = saltAndIv.subarray(ENCRYPTION_CONFIG.saltLength);

    // Derive key from machine identifier
    const key = deriveKey(salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_CONFIG.algorithm,
      key,
      iv
    );

    // Set authentication tag
    const tag = Buffer.from(encryptedValue.tag, 'base64');
    decipher.setAuthTag(tag);

    // Decrypt
    let decrypted = decipher.update(encryptedValue.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Provide a user-friendly error message
    if (error instanceof Error) {
      if (error.message.includes('Unsupported state or unable to authenticate data')) {
        throw new Error(
          'Failed to decrypt API key. This may be due to: ' +
          '(1) moving config to a different machine, ' +
          '(2) corrupted config file, or ' +
          '(3) config file was manually edited. ' +
          'Please re-enter your API key.'
        );
      }
      throw new Error(`Decryption failed: ${error.message}`);
    }
    throw new Error('Decryption failed: Unknown error');
  }
}

/**
 * Check if a value is encrypted (has the expected structure).
 *
 * @param value - Value to check
 * @returns True if value appears to be encrypted
 */
export function isEncrypted(value: unknown): value is EncryptedValue {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as any;
  return (
    typeof obj.encrypted === 'string' &&
    typeof obj.iv === 'string' &&
    typeof obj.tag === 'string' &&
    typeof obj.version === 'number'
  );
}

/**
 * Encrypt an object's sensitive fields.
 *
 * @param obj - Object containing sensitive fields
 * @param fieldsToEncrypt - Array of field names to encrypt
 * @returns New object with encrypted fields
 */
export function encryptFields<T extends Record<string, any>>(
  obj: T,
  fieldsToEncrypt: string[]
): T {
  const result: Record<string, any> = { ...obj };

  for (const field of fieldsToEncrypt) {
    if (field in result && typeof result[field] === 'string') {
      // Don't re-encrypt already encrypted values
      if (!isEncrypted(result[field])) {
        result[field] = encrypt(result[field]);
      }
    }
  }

  return result as T;
}

/**
 * Decrypt an object's encrypted fields.
 *
 * @param obj - Object containing encrypted fields
 * @param fieldsToDecrypt - Array of field names to decrypt
 * @returns New object with decrypted fields
 */
export function decryptFields<T extends Record<string, any>>(
  obj: T,
  fieldsToDecrypt: string[]
): T {
  const result: Record<string, any> = { ...obj };

  for (const field of fieldsToDecrypt) {
    if (field in result && isEncrypted(result[field])) {
      try {
        result[field] = decrypt(result[field]);
      } catch (error) {
        // If decryption fails, leave the field as-is and let caller handle it
        console.error(`Failed to decrypt field "${field}":`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  return result as T;
}

/**
 * Test if encryption is working (for diagnostics).
 *
 * @returns True if encryption/decryption round-trip works
 */
export function testEncryption(): boolean {
  try {
    const testValue = 'test-api-key-12345';
    const encrypted = encrypt(testValue);
    const decrypted = decrypt(encrypted);
    return decrypted === testValue;
  } catch {
    return false;
  }
}

/**
 * Get encryption info for diagnostics.
 */
export function getEncryptionInfo(): {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  pbkdf2Iterations: number;
  version: number;
  machineId: string;
} {
  return {
    algorithm: ENCRYPTION_CONFIG.algorithm,
    keyLength: ENCRYPTION_CONFIG.keyLength,
    ivLength: ENCRYPTION_CONFIG.ivLength,
    pbkdf2Iterations: ENCRYPTION_CONFIG.pbkdf2Iterations,
    version: ENCRYPTION_CONFIG.version,
    machineId: getMachineIdentifier(),
  };
}
